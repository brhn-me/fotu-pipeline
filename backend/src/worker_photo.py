import os
import time
import json
import shutil
import subprocess
from sqlalchemy.orm import Session
from src.db import r, engine, SessionLocal, File, QUEUE_PHOTO, Config, Export, STATS_PROCESSING, STATS_DONE, STATS_FAIL, QUEUE_ORGANIZE
from src.utils import get_trie_path
from src.logger import get_logger
from datetime import datetime

logger = get_logger("worker.photo")

DEFAULT_OUTPUT_DIR = "/data/output"

def get_output_dir(db: Session):
    conf = db.query(Config).filter(Config.key == "output_dir").first()
    if conf and conf.value:
        return conf.value
    return os.getenv("OUTPUT_DIR", DEFAULT_OUTPUT_DIR)

def process_photo(payload):
    file_id = payload.get("id")
    file_path = payload.get("path")
    
    # Stats: Start
    r.incr(f"{STATS_PROCESSING}photo")
    
    db: Session = SessionLocal()
    try:
        logger.info(f"Processing photo: {file_path}", file_id=file_id)
        
        file_rec = db.query(File).filter(File.id == file_id).first()
        if file_rec:
            file_rec.status = "PROCESSING"
            db.commit()

        output_dir = get_output_dir(db)
        
        # Intermediate: .cache/images/{trie}/{id}.avif
        rel_path = get_trie_path(file_id) # ab/cd/id
        cache_dir = os.path.join(output_dir, ".cache", "images", os.path.dirname(rel_path))
        os.makedirs(cache_dir, exist_ok=True)
        
        temp_path = os.path.join(cache_dir, f"{file_id}.avif")
        
        # Convert/Save
        # Convert/Save using ImageMagick
        # convert input -quality 85 output.avif
        try:
            logger.info(f"Converting with ImageMagick: {file_path} -> {temp_path}", file_id=file_id)
            subprocess.run([
                "convert", file_path, 
                "-quality", "85", 
                temp_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError as e:
            logger.warning(f"ImageMagick failed for {file_path}, trying ffmpeg fallback: {e}", file_id=file_id)
            subprocess.run([
                "ffmpeg", "-y", "-i", file_path, 
                "-compression_level", "6", 
                temp_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
        if not os.path.exists(temp_path):
            raise Exception("Output file not created")
            
        # Metadata Copy to Temp
        subprocess.run([
            "exiftool", "-Overwrite_Original", 
            "-TagsFromFile", file_path, 
            "-all:all>all:all", 
            temp_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Enqueue to Organizer
        logger.info(f"Photo encoded, queueing organize: {temp_path}", file_id=file_id)
        
        org_payload = json.dumps({
            "file_id": file_id,
            "temp_path": temp_path,
            "type": "IMAGE"
        })
        r.rpush(QUEUE_ORGANIZE, org_payload)

        # Stats: Done
        r.incr(f"{STATS_DONE}photo")

    except Exception as e:
        logger.error(f"Error processing {file_path}: {e}", file_id=file_id)
        # Stats: Fail
        r.incr(f"{STATS_FAIL}photo")
        
        if file_rec:
            file_rec.status = "ERROR"
            file_rec.error_message = str(e)
            db.commit()
    finally:
        # Stats: Finish Processing
        r.decr(f"{STATS_PROCESSING}photo")
        db.close()

if __name__ == "__main__":
    logger.info("Photo Worker Started")
    while True:
        task = r.blpop(QUEUE_PHOTO, timeout=10)
        if task:
            try:
                payload = json.loads(task[1])
                # We need to know if it succeeded to increment DONE.
                # process_photo doesn't return status. 
                # I'll update process_photo to increment DONE on success inside the try block.
                process_photo(payload)
            except Exception as e:
                logger.error(f"Photo loop error: {e}")
