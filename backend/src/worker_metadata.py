import os
import json
import time
import subprocess
from datetime import datetime
from sqlalchemy.orm import Session
from src.db import r, SessionLocal, File, FileMetadata, QUEUE_METADATA
from src.logger import get_logger
import exiftool

logger = get_logger("worker.metadata")

def parse_date(date_str):
    """Parse various EXIF date formats."""
    if not date_str or not isinstance(date_str, str):
        return None
    
    # Common formats: "2023:10:27 12:34:56", "2023-10-27 12:34:56", "2023:10:27 12:34:56+02:00"
    clean_str = date_str.split('+')[0].split('-')[0].strip()
    formats = ["%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"]
    
    for fmt in formats:
        try:
            return datetime.strptime(clean_str[:len("2023:10:27 12:34:56")], fmt)
        except ValueError:
            continue
    return None

def get_int(value):
    if value is None:
        return None
    if isinstance(value, int):
        return value
    s = str(value).replace('x', ' ').replace(':', ' ').replace(',', ' ').split()
    for part in s:
        try:
            return int(float(part))
        except (ValueError, TypeError):
            continue
    return None

def get_float(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).replace('x', ' ').replace(':', ' ').replace(',', ' ').split()
    for part in s:
        try:
            return float(part)
        except (ValueError, TypeError):
            continue
    return None

def get_video_info(path):
    """Get video and audio info using ffprobe."""
    try:
        cmd = [
            "ffprobe", 
            "-v", "error", 
            "-show_entries", "stream=width,height,codec_name,avg_frame_rate,duration,channels,sample_rate,codec_type,bit_rate", 
            "-of", "json", 
            path
        ]
        output = subprocess.check_output(cmd).decode()
        data = json.loads(output)
        
        info = {}
        if "streams" in data:
            for stream in data["streams"]:
                if stream.get("codec_type") == "video" and "video_stream" not in info:
                    info["video_stream"] = stream
                elif stream.get("codec_type") == "audio" and "audio_stream" not in info:
                    info["audio_stream"] = stream
        return info

    except Exception as e:
        logger.error(f"FFPROBE Error {path}: {e}")
    return {}

def process_metadata(payload):
    file_id = payload.get("id")
    file_path = payload.get("path")
    
    db: Session = SessionLocal()
    try:
        file_rec = db.query(File).filter(File.id == file_id).first()
        if not file_rec:
            logger.error(f"File {file_id} not found in DB")
            return

        logger.info(f"Extracting metadata: {file_path}", extra={"file_id": file_id})
        
        # Determine strict type
        is_video = file_rec.type == "VIDEO" or file_path.lower().endswith(('.mp4', '.mov', '.mkv', '.avi', '.webm'))
        
        # 1. Use ExifTool for General + Photo tags
        exif_meta = {}
        try:
            with exiftool.ExifToolHelper() as et:
                metadata_list = et.get_metadata(file_path)
                if metadata_list:
                    exif_meta = metadata_list[0]
        except Exception as e:
            logger.warning(f"ExifTool failed for {file_path}: {e}", extra={"file_id": file_id})

        # Find or create metadata record
        target = db.query(FileMetadata).filter(FileMetadata.file_id == file_id).first()
        if not target:
            target = FileMetadata(file_id=file_id)
            db.add(target)

        # Source Key Tracking
        source_keys = {}

        def extract(field_name, candidates, transform=None):
            """Helper to extract value and track source key."""
            for key in candidates:
                val = exif_meta.get(key)
                if val is not None:
                    try:
                        final_val = transform(val) if transform else val
                        if final_val is not None:
                            source_keys[field_name] = key
                            return final_val
                    except:
                        continue
            return None

        # Global info
        target.mime_type = extract("mime_type", ["File:MIMEType"])
        
        # Dimensions (complex logic, handle manually)
        w, h = None, None
        img_size = exif_meta.get("Composite:ImageSize") or exif_meta.get("File:ImageSize")
        if img_size:
            source_keys["width"] = "Composite:ImageSize" if "Composite:ImageSize" in exif_meta else "File:ImageSize"
            source_keys["height"] = source_keys["width"]
            if isinstance(img_size, str):
                parts = img_size.replace('x', ' ').split()
                if len(parts) >= 2:
                    w, h = get_int(parts[0]), get_int(parts[1])

        target.width = extract("width", ["File:ImageWidth", "EXIF:ExifImageWidth"], get_int) or w
        if not target.width and w: target.width = w # Restore composite if direct failed

        target.height = extract("height", ["File:ImageHeight", "EXIF:ExifImageHeight"], get_int) or h
        if not target.height and h: target.height = h

        # Taken At
        target.taken_at = extract("taken_at", ["EXIF:DateTimeOriginal", "QuickTime:CreateDate", "File:FileModifyDate"], parse_date)
        
        # GPS
        target.lat = extract("lat", ["Composite:GPSLatitude", "EXIF:GPSLatitude"], get_float)
        target.lon = extract("lon", ["Composite:GPSLongitude", "EXIF:GPSLongitude"], get_float)

        # Photo Specific
        target.make = extract("make", ["EXIF:Make"])
        target.model = extract("model", ["EXIF:Model"])
        target.lens = extract("lens", ["EXIF:LensModel", "EXIF:LensInfo"])
        target.iso = extract("iso", ["EXIF:ISO"], get_int)
        target.aperture = extract("aperture", ["Composite:Aperture", "EXIF:FNumber"], get_float)
        target.exposure_time = extract("exposure_time", ["EXIF:ExposureTime"], str)
        target.focal_length = extract("focal_length", ["EXIF:FocalLength"], get_float)

        # Video Specific overrides using FFPROBE
        if is_video:
            ff_data = get_video_info(file_path)
            
            # Video Stream
            v_stream = ff_data.get("video_stream", {})
            if v_stream:
                if "codec_name" in v_stream:
                    target.codec = v_stream["codec_name"]
                    source_keys["codec"] = "ffprobe:video:codec_name"
                
                if "duration" in v_stream:
                    target.duration = get_float(v_stream["duration"])
                    source_keys["duration"] = "ffprobe:video:duration"
                    
                if "width" in v_stream and "height" in v_stream:
                    target.width = get_int(v_stream["width"])
                    target.height = get_int(v_stream["height"])
                    source_keys["width"] = "ffprobe:video:width"
                    source_keys["height"] = "ffprobe:video:height"
                    
                if "avg_frame_rate" in v_stream:
                    try:
                        num, den = v_stream["avg_frame_rate"].split('/')
                        if int(den) > 0:
                            target.framerate = round(int(num) / int(den), 2)
                            source_keys["framerate"] = "ffprobe:video:avg_frame_rate"
                    except:
                        target.framerate = get_float(v_stream["avg_frame_rate"])
                        source_keys["framerate"] = "ffprobe:video:avg_frame_rate"

            # Audio Stream
            a_stream = ff_data.get("audio_stream", {})
            if a_stream:
                target.audio_codec = a_stream.get("codec_name")
                if target.audio_codec: source_keys["audio_codec"] = "ffprobe:audio:codec_name"

                target.audio_channels = get_int(a_stream.get("channels"))
                if target.audio_channels: source_keys["audio_channels"] = "ffprobe:audio:channels"

                target.audio_sample_rate = get_int(a_stream.get("sample_rate"))
                if target.audio_sample_rate: source_keys["audio_sample_rate"] = "ffprobe:audio:sample_rate"
                
                target.audio_bitrate = get_int(a_stream.get("bit_rate"))
                if target.audio_bitrate: source_keys["audio_bitrate"] = "ffprobe:audio:bit_rate"

            # Fallback duration from container if stream duration missing
            if not target.duration and exif_meta:
                 target.duration = extract("duration", ["QuickTime:Duration", "Composite:Duration"], get_float)
        
        # Fallback fields if Exiftool had them and ffprobe failed/skipped
        if target.codec is None: 
             target.codec = extract("codec", ["Composite:VideoCodec", "Video:CompressorID"])

        target.source_keys = source_keys # Save map to DB
        db.commit()

    except Exception as e:
        logger.error(f"Error processing metadata for {file_id}: {e}", extra={"file_id": file_id})
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Metadata Worker Started")
    while True:
        task = r.blpop(QUEUE_METADATA, timeout=10)
        if task:
            try:
                payload = json.loads(task[1])
                process_metadata(payload)
            except Exception as e:
                logger.error(f"Metadata loop error: {e}")
