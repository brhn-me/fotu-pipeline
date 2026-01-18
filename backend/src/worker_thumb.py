import os
import json
import subprocess
from sqlalchemy.orm import Session
from sqlalchemy.orm import Session
from src.db import r, SessionLocal, File, Thumbnail, QUEUE_THUMB, STATS_PROCESSING, STATS_DONE, STATS_FAIL, Config
from src.utils import get_trie_path
from src.logger import get_logger

logger = get_logger("worker.thumb")

DEFAULT_OUTPUT_DIR = "/data/output"

def get_output_dir(db: Session):
    conf = db.query(Config).filter(Config.key == "output_dir").first()
    if conf and conf.value:
        return conf.value
    return os.getenv("OUTPUT_DIR", DEFAULT_OUTPUT_DIR)

def process_thumb(payload):
    file_id = payload.get("id")
    file_path = payload.get("path")
    
    r.incr(f"{STATS_PROCESSING}thumb")
    
    db: Session = SessionLocal()
    try:
        output_dir = get_output_dir(db)
        
        # Trie Storage Logic: thumbs/ab/cd/abcdef...webp
        # Use first 2 chars, then next 2 chars of file_id
        # Trie Storage Logic: thumbs/ab/cd/abcdef...webp
        # Use first 2 chars, then next 2 chars of file_id
        # Use shared utils
        trie_path = get_trie_path(file_id)
        # trie_path is like "ab/cd/abcdef..." so we need to split it or just join
        # Actually get_trie_path returns "ab/cd/{id}". We just need the dir.
        
        # But wait, get_trie_path returns "ab/cd/id". 
        # So dirname(get_trie_path(id)) gives "ab/cd".
        rel_path = get_trie_path(file_id)
        thumb_dir = os.path.join(output_dir, "thumbs", os.path.dirname(rel_path))
            
        os.makedirs(thumb_dir, exist_ok=True)
        
        thumb_path = os.path.join(thumb_dir, f"{file_id}.webp")
        
        # Check if already exists in DB (idempotency)
        existing_thumb = db.query(Thumbnail).filter(Thumbnail.path == thumb_path).first()
        if existing_thumb and os.path.exists(thumb_path):
             logger.info(f"Thumb already exists for {file_id}", extra={"file_id": file_id})
             return

        logger.info(f"Generating thumb: {file_path}", extra={"file_id": file_id})
        
        # Generate Thumb using ImageMagick
        # consistent with worker_photo
        # convert input[0] -resize x240 -quality 80 output.webp
        # [0] selects first frame for videos/multipage
        try:
            logger.info(f"Generating thumb with ImageMagick: {file_path}", extra={"file_id": file_id})
            subprocess.run([
                "convert", f"{file_path}[0]", 
                "-resize", "x240", 
                "-quality", "80", 
                thumb_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError as e:
            logger.warning(f"ImageMagick thumb failed, trying ffmpeg fallback: {e}", extra={"file_id": file_id})
            subprocess.run([
                 "ffmpeg", "-y", "-i", file_path,
                 "-vf", "scale=-1:240",
                 "-c:v", "libwebp",
                 "-q:v", "80", 
                 "-frames:v", "1",
                 thumb_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Get stats
        width, height, size = 0, 0, 0
        if os.path.exists(thumb_path):
             size = os.path.getsize(thumb_path)
             # Try getting dim via ffprobe or similar if critical, 
             # but "ffmpeg scale=-1:240" means height=240, width is auto.
             # User requested "store its size and resolution".
             try:
                 # Quick verify with ffprobe
                 p = subprocess.check_output([
                     "ffprobe", "-v", "error", "-select_streams", "v:0",
                     "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", 
                     thumb_path
                 ]).decode().strip()
                 parts = p.split('x')
                 if len(parts) == 2:
                     width, height = int(parts[0]), int(parts[1])
             except:
                 pass

        # Update Thumbnail Table
        new_thumb = Thumbnail(
            file_id=file_id,
            path=thumb_path,
            width=width,
            height=height,
            size_bytes=size
        )
        db.add(new_thumb)
        db.commit()
        r.incr(f"{STATS_DONE}thumb")
        # Backward compatibility for API
        file_rec = db.query(File).filter(File.id == file_id).first()
        if file_rec:
            file_rec.thumbnail_path = thumb_path
        
        db.commit()

    except Exception as e:
        logger.error(f"Error processing thumb {file_id}: {e}", extra={"file_id": file_id})
        r.incr(f"{STATS_FAIL}thumb")
    finally:
        r.decr(f"{STATS_PROCESSING}thumb")
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
