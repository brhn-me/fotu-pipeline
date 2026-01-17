import os
import time
import json
import shutil
import subprocess
from PIL import Image
from sqlalchemy.orm import Session
from src.db import r, engine, SessionLocal, File, QUEUE_PHOTO, Config
from src.logger import get_logger

logger = get_logger("worker.photo")

DEFAULT_OUTPUT_DIR = "/data/output"

def get_output_dir(db: Session):
    conf = db.query(Config).filter(Config.key == "output_dir").first()
    if conf and conf.value:
        return conf.value
    return os.getenv("OUTPUT_DIR", DEFAULT_OUTPUT_DIR)

def process_photo(file_path, file_id):
    db: Session = SessionLocal()
    try:
        logger.info(f"Processing photo: {file_path}", file_id=file_id)
        
        file_rec = db.query(File).filter(File.id == file_id).first()
        if file_rec:
            file_rec.status = "PROCESSING"
            db.commit()

        output_dir = get_output_dir(db)
        
        rel_name = os.path.basename(file_path)
        output_path = os.path.join(output_dir, "photos", os.path.splitext(rel_name)[0] + ".avif")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Try Pillow first
        try:
            with Image.open(file_path) as img:
                img.save(output_path, "AVIF", quality=85)
        except Exception as e:
            logger.warning(f"Pillow failed for {file_path}, trying ffmpeg: {e}", file_id=file_id)
            subprocess.run([
                "ffmpeg", "-y", "-i", file_path, 
                "-compression_level", "6", 
                output_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
        if not os.path.exists(output_path):
            raise Exception("Output file not created")
            
        # Metadata
        subprocess.run([
            "exiftool", "-Overwrite_Original", 
            "-TagsFromFile", file_path, 
            "-all:all>all:all", 
            output_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        shutil.copystat(file_path, output_path)
        
        # Stats
        stats = os.stat(output_path)
        if file_rec:
            file_rec.status = "DONE"
            file_rec.output_path = output_path
            file_rec.output_size_bytes = stats.st_size
            if file_rec.size_bytes and file_rec.size_bytes > 0:
                file_rec.compression_ratio = round(file_rec.size_bytes / stats.st_size, 2)
            
            # Extract basic EXIF (Date, Camera) via exiftool json
            try:
                meta = subprocess.check_output(["exiftool", "-json", file_path])
                meta_json = json.loads(meta)[0]
                
                # Camera
                make = meta_json.get("Make", "")
                model = meta_json.get("Model", "")
                file_rec.meta_camera = f"{make} {model}".strip() or None
                
                # Date (CreateDate or DateTimeOriginal)
                date_str = meta_json.get("CreateDate") or meta_json.get("DateTimeOriginal")
                if date_str:
                    # Exif format: YYYY:MM:DD HH:MM:SS
                    try:
                        file_rec.meta_create_date = datetime.strptime(date_str[:19], "%Y:%m:%d %H:%M:%S")
                    except:
                        pass
                
                # GPS
                lat = meta_json.get("GPSLatitude")
                lon = meta_json.get("GPSLongitude")
                if lat and lon:
                    file_rec.meta_gps = f"{lat}, {lon}"

            except Exception as e:
                logger.warning(f"Metadata extraction warning: {e}", file_id=file_id)

            db.commit()
            
        logger.info(f"Encoded photo: {output_path}", file_id=file_id)

    except Exception as e:
        logger.error(f"Error processing {file_path}: {e}", file_id=file_id)
        if file_rec:
            file_rec.status = "ERROR"
            file_rec.error_message = str(e)
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Photo Worker Started")
    while True:
        task = r.blpop(QUEUE_PHOTO, timeout=10)
        if task:
            try:
                payload = json.loads(task[1])
                process_photo(payload["path"], payload["id"])
            except Exception as e:
                logger.error(f"Task error: {e}")
