import os
import time
import hashlib
import json
import glob
from datetime import datetime
from sqlalchemy.orm import Session
from src.db import r, engine, SessionLocal, File, Source, Config
from src.db import (
    QUEUE_SCAN, QUEUE_PHOTO, QUEUE_VIDEO_SPLIT, QUEUE_RAW, QUEUE_THUMB,
    QUEUE_METADATA
)
from src.logger import get_logger

logger = get_logger("worker.scanner")

# Expanded formats
PHOTO_EXTS = {
    '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp', 
    '.heic', '.heif', '.avif'
}
RAW_EXTS = {
    '.raw', '.cr2', '.nef', '.arw', '.dng', '.gpr', '.orf', '.rw2'
}
VIDEO_EXTS = {
    '.mp4', '.mov', '.avi', '.mkv', '.webm', 
    '.wmv', '.flv', '.3gp', '.ts', '.m4v'
}

def get_file_id(path):
    return hashlib.md5(path.encode()).hexdigest()

def calculate_hash(path):
    """Calculate SHA256 of file content."""
    sha256_hash = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except Exception as e:
        logger.error(f"Error hashing {path}: {e}")
        return None

def get_file_stats(path):
    stats = os.stat(path)
    return {
        "size_bytes": stats.st_size,
        "created_at": datetime.fromtimestamp(stats.st_ctime),
        "updated_at": datetime.fromtimestamp(stats.st_mtime)
    }

def find_sidecar(path):
    # Check for .xmp or .XMP
    base = os.path.splitext(path)[0]
    for ext in ['.xmp', '.XMP']:
        candidate = base + ext
        if os.path.exists(candidate):
            return candidate
    return None

def process_scan(payload):
    source_id = payload.get("source_id")
    # Query source first to get path for logging
    db: Session = SessionLocal()
    try:
        source = db.query(Source).filter(Source.id == source_id).first()
        if not source:
            logger.error(f"Source {source_id} not found")
            return
            
        logger.info(f"Scanning source: {source.path}...", extra={"source_id": source_id, "path": source.path})
            
        source.status = "SCANNING"
        source.error_message = None # Clear previous error
        db.commit()
        
        source_dir = source.path
        if not os.path.exists(source_dir):
            msg = f"Path {source_dir} does not exist"
            logger.error(msg, extra={"source_id": source_id})
            source.status = "ERROR"
            source.error_message = msg
            db.commit()
            return

        cnt = 0
        for root, _, files in os.walk(source_dir):
            for file_name in files:
                file_path = os.path.join(root, file_name)
                if "/output" in file_path: continue

                ext = os.path.splitext(file_name)[1].lower()
                
                # Check DB
                file_id = get_file_id(file_path)
                existing = db.query(File).filter(File.id == file_id).first()
                if existing:
                    continue

                stats = get_file_stats(file_path)
                sidecar = find_sidecar(file_path)
                file_hash = calculate_hash(file_path)
                
                new_file = File(
                    id=file_id, 
                    path=file_path,
                    hash=file_hash,
                    size_bytes=stats["size_bytes"],
                    file_create_date=stats["created_at"],
                    file_update_date=stats["updated_at"],
                    sidecar_path=sidecar
                )
                
                queue_name = None
                
                if ext in PHOTO_EXTS:
                    new_file.type = "PHOTO"
                    new_file.status = "QUEUED"
                    queue_name = QUEUE_PHOTO
                elif ext in VIDEO_EXTS:
                    new_file.type = "VIDEO"
                    new_file.status = "QUEUED"
                    queue_name = QUEUE_VIDEO_SPLIT
                elif ext in RAW_EXTS:
                    new_file.type = "RAW"
                    new_file.status = "QUEUED"
                    queue_name = QUEUE_RAW
                else:
                    new_file.type = "UNKNOWN"
                    new_file.status = "REVIEW"
                
                db.add(new_file)
                db.commit()
                
                if queue_name:
                    logger.info(f"Queuing {new_file.type.lower()}: {file_name}", extra={"file_id": file_id})
                    payload = json.dumps({"path": file_path, "id": file_id})
                    r.rpush(queue_name, payload)
                    # Queue Thumb
                    r.rpush(QUEUE_THUMB, payload)
                    # Queue Metadata extraction
                    r.rpush(QUEUE_METADATA, payload)
                    cnt += 1
                elif new_file.type == "UNKNOWN":
                    # Even UNKNOWN might have some metadata (MIME, stats)
                    payload = json.dumps({"path": file_path, "id": file_id})
                    r.rpush(QUEUE_METADATA, payload)
                    
        source.last_scanned = datetime.utcnow()
        source.status = "IDLE"
        db.commit()
        logger.info(f"Scan complete. Queued {cnt} files.", extra={"source_id": source_id, "count": cnt})

    except Exception as e:
        logger.error(f"Scan error: {e}", extra={"source_id": source_id})
        if source:
             source.status = "ERROR"
             source.error_message = str(e)
             db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Scanner Worker Started")
    while True:
        task = r.blpop(QUEUE_SCAN, timeout=10)
        if task:
            try:
                payload = json.loads(task[1])
                process_scan(payload)
            except Exception as e:
                logger.error(f"Task error: {e}")
