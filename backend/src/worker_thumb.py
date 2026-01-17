import os
import json
import subprocess
from sqlalchemy.orm import Session
from src.db import r, engine, SessionLocal, File, Config, QUEUE_THUMB
from src.logger import get_logger

logger = get_logger("worker.thumb")

DEFAULT_OUTPUT_DIR = "/data/output"

def get_output_dir(db: Session):
    conf = db.query(Config).filter(Config.key == "output_dir").first()
    if conf and conf.value:
        return conf.value
    return os.getenv("OUTPUT_DIR", DEFAULT_OUTPUT_DIR)

def process_thumb(payload):
    file_path = payload["path"]
    file_id = payload["id"]
    
    db: Session = SessionLocal()
    try:
        output_dir = get_output_dir(db)
        thumb_dir = os.path.join(output_dir, ".cache", "thumbs")
        os.makedirs(thumb_dir, exist_ok=True)
        
        # Consistent hash based naming or just file_id
        thumb_path = os.path.join(thumb_dir, f"{file_id}.jpg")
        
        if os.path.exists(thumb_path):
            # Already exists, skip or overwrite?
            # If we want to be safe, maybe check mtime? For now skip if exists to save CPU.
             pass
        else:
             logger.info(f"Generating thumb for {file_path}", file_id=file_id)
             # Generate 240p height, auto width
             # ffmpeg -i input -vf "scale=-1:240" -q:v 5 output.jpg
             subprocess.run([
                 "ffmpeg", "-y", "-i", file_path,
                 "-vf", "scale=-1:240",
                 "-q:v", "5",
                 "-frames:v", "1",
                 thumb_path
             ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Update DB
        file_rec = db.query(File).filter(File.id == file_id).first()
        if file_rec:
            file_rec.thumbnail_path = thumb_path
            db.commit()

    except Exception as e:
        logger.error(f"Thumb Error {file_path}: {e}", file_id=file_id)
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Thumb Worker Started")
    while True:
        task = r.blpop(QUEUE_THUMB, timeout=10)
        if task:
            try:
                payload = json.loads(task[1])
                process_thumb(payload)
            except Exception as e:
                logger.error(f"Task error: {e}")
