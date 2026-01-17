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
    """Get video info using ffprobe."""
    try:
        cmd = [
            "ffprobe", 
            "-v", "error", 
            "-select_streams", "v:0", 
            "-show_entries", "stream=width,height,codec_name,avg_frame_rate,duration", 
            "-of", "json", 
            path
        ]
        output = subprocess.check_output(cmd).decode()
        data = json.loads(output)
        if "streams" in data and len(data["streams"]) > 0:
            return data["streams"][0]
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

        # Global info
        target.mime_type = exif_meta.get("File:MIMEType")
        
        # Dimensions (ExifTool fallback)
        w, h = None, None
        img_size = exif_meta.get("Composite:ImageSize") or exif_meta.get("File:ImageSize")
        if img_size and isinstance(img_size, str):
            parts = img_size.replace('x', ' ').split()
            if len(parts) >= 2:
                w, h = get_int(parts[0]), get_int(parts[1])
        
        target.width = get_int(exif_meta.get("File:ImageWidth")) or get_int(exif_meta.get("EXIF:ExifImageWidth")) or w
        target.height = get_int(exif_meta.get("File:ImageHeight")) or get_int(exif_meta.get("EXIF:ExifImageHeight")) or h
        
        # Taken At
        taken_at_str = exif_meta.get("EXIF:DateTimeOriginal") or exif_meta.get("QuickTime:CreateDate") or exif_meta.get("File:FileModifyDate")
        target.taken_at = parse_date(taken_at_str)
        
        # GPS
        target.lat = get_float(exif_meta.get("Composite:GPSLatitude") or exif_meta.get("EXIF:GPSLatitude"))
        target.lon = get_float(exif_meta.get("Composite:GPSLongitude") or exif_meta.get("EXIF:GPSLongitude"))

        # Photo Specific
        target.make = exif_meta.get("EXIF:Make")
        target.model = exif_meta.get("EXIF:Model")
        target.lens = exif_meta.get("EXIF:LensModel") or exif_meta.get("EXIF:LensInfo")
        target.iso = get_int(exif_meta.get("EXIF:ISO"))
        target.aperture = get_float(exif_meta.get("Composite:Aperture") or exif_meta.get("EXIF:FNumber"))
        target.exposure_time = str(exif_meta.get("EXIF:ExposureTime")) if exif_meta.get("EXIF:ExposureTime") else None
        target.focal_length = get_float(exif_meta.get("EXIF:FocalLength"))

        # Video Specific overrides using FFPROBE
        if is_video:
            ff_info = get_video_info(file_path)
            
            if "codec_name" in ff_info:
                target.codec = ff_info["codec_name"] # e.g. "h264"
                
            if "duration" in ff_info:
                target.duration = get_float(ff_info["duration"])
            elif "duration" not in ff_info and exif_meta:
                 target.duration = get_float(exif_meta.get("QuickTime:Duration") or exif_meta.get("Composite:Duration"))

            if "width" in ff_info and "height" in ff_info:
                target.width = get_int(ff_info["width"])
                target.height = get_int(ff_info["height"])
                
            if "avg_frame_rate" in ff_info:
                # Format is often "30000/1001"
                try:
                    num, den = ff_info["avg_frame_rate"].split('/')
                    if int(den) > 0:
                        target.framerate = round(int(num) / int(den), 2)
                except:
                    target.framerate = get_float(ff_info["avg_frame_rate"])
        
        # Fallback fields if Exiftool had them and ffprobe failed/skipped
        if target.codec is None and exif_meta: 
             target.codec = exif_meta.get("Composite:VideoCodec") or exif_meta.get("Video:CompressorID")

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
