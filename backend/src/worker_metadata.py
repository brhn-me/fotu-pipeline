import os
import json
import time
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
    # We'll try to strip timezone for simplicity in DB for now, or use dateutil if needed.
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
    # Handle various formats by splitting on common separators and finding the first number
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

def process_metadata(payload):
    file_id = payload.get("id")
    file_path = payload.get("path")
    
    db: Session = SessionLocal()
    try:
        file_rec = db.query(File).filter(File.id == file_id).first()
        if not file_rec:
            logger.error(f"File {file_id} not found in DB")
            return

        logger.info(f"Extracting metadata for {file_path}", extra={"file_id": file_id})
        
        with exiftool.ExifToolHelper() as et:
            # metadata is a list of dicts (one per file)
            metadata_list = et.get_metadata(file_path)
            if not metadata_list:
                logger.warning(f"No metadata found for {file_path}", extra={"file_id": file_id})
                return
            
            meta = metadata_list[0]
            
            # Find or create metadata record
            target = db.query(FileMetadata).filter(FileMetadata.file_id == file_id).first()
            if not target:
                target = FileMetadata(file_id=file_id)
                db.add(target)

            # Global info
            target.mime_type = meta.get("File:MIMEType")
            
            # Width / Height logic
            img_size = meta.get("Composite:ImageSize") or meta.get("File:ImageSize")
            w, h = None, None
            if img_size and isinstance(img_size, str):
                parts = img_size.replace('x', ' ').split()
                if len(parts) >= 2:
                    w, h = get_int(parts[0]), get_int(parts[1])
            
            target.width = get_int(meta.get("File:ImageWidth")) or get_int(meta.get("EXIF:ExifImageWidth")) or get_int(meta.get("Video:ImageWidth")) or w
            target.height = get_int(meta.get("File:ImageHeight")) or get_int(meta.get("EXIF:ExifImageHeight")) or get_int(meta.get("Video:ImageHeight")) or h
            
            # Taken At - prioritize EXIF
            taken_at_str = meta.get("EXIF:DateTimeOriginal") or meta.get("QuickTime:CreateDate") or meta.get("H264:DateTimeOriginal") or meta.get("File:FileModifyDate")
            target.taken_at = parse_date(taken_at_str)
            
            # GPS
            target.lat = get_float(meta.get("Composite:GPSLatitude") or meta.get("EXIF:GPSLatitude"))
            target.lon = get_float(meta.get("Composite:GPSLongitude") or meta.get("EXIF:GPSLongitude"))

            # Photo Specific
            target.make = meta.get("EXIF:Make")
            target.model = meta.get("EXIF:Model")
            target.lens = meta.get("EXIF:LensModel") or meta.get("EXIF:LensInfo")
            target.iso = get_int(meta.get("EXIF:ISO"))
            target.aperture = get_float(meta.get("Composite:Aperture") or meta.get("EXIF:FNumber"))
            target.exposure_time = str(meta.get("EXIF:ExposureTime")) if meta.get("EXIF:ExposureTime") else None
            target.focal_length = get_float(meta.get("EXIF:FocalLength"))

            # Video Specific
            target.duration = get_float(meta.get("QuickTime:Duration") or meta.get("Composite:Duration"))
            target.codec = meta.get("QuickTime:HandlerDescription") or meta.get("Video:Codec") or meta.get("Video:VideoCodec")
            target.framerate = get_float(meta.get("Composite:VideoFrameRate") or meta.get("QuickTime:VideoFrameRate"))

            db.commit()
            logger.info(f"Metadata stored for {file_id}", extra={"file_id": file_id})

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
