import os
import time
import hashlib
import json
from sqlalchemy.orm import Session
from src.db import r, engine, SessionLocal, init_db, File
from src.db import QUEUE_PHOTO, QUEUE_VIDEO_SPLIT

# Initialize DB tables
init_db()

SOURCE_DIR = os.getenv("SOURCE_DIR", "/data/source")

# Expanded formats
PHOTO_EXTS = {
    '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp', 
    '.heic', '.heif', '.avif', 
    '.raw', '.cr2', '.nef', '.arw', '.dng' # RAW formats
}
VIDEO_EXTS = {
    '.mp4', '.mov', '.avi', '.mkv', '.webm', 
    '.wmv', '.flv', '.3gp', '.ts', '.m4v'
}

def get_file_id(path):
    return hashlib.md5(path.encode()).hexdigest()

def scan():
    print(f"Scanning {SOURCE_DIR}...")
    if not os.path.exists(SOURCE_DIR):
        print(f"Source dir {SOURCE_DIR} does not exist.")
        return

    db: Session = SessionLocal()
    
    try:
        known_files = set()

        for root, _, files in os.walk(SOURCE_DIR):
            for file_name in files:
                file_path = os.path.join(root, file_name)
                
                # Skip output dir if it's inside source
                if "/output" in file_path:
                    continue

                file_id = get_file_id(file_path)
                known_files.add(file_id)
                
                ext = os.path.splitext(file_name)[1].lower()
                
                # Check DB
                existing = db.query(File).filter(File.id == file_id).first()
                if existing:
                    continue # Already known

                # Create Record
                new_file = File(id=file_id, path=file_path)
                
                # Identify type
                if ext in PHOTO_EXTS:
                    print(f"Queuing Photo: {file_name}")
                    new_file.type = "PHOTO"
                    new_file.status = "QUEUED"
                    db.add(new_file)
                    db.commit()
                    
                    # Push to Redis
                    payload = json.dumps({"path": file_path, "id": file_id})
                    r.rpush(QUEUE_PHOTO, payload)
                    
                elif ext in VIDEO_EXTS:
                    print(f"Queuing Video: {file_name}")
                    new_file.type = "VIDEO"
                    new_file.status = "QUEUED"
                    db.add(new_file)
                    db.commit()
                    
                    payload = json.dumps({"path": file_path, "id": file_id})
                    r.rpush(QUEUE_VIDEO_SPLIT, payload)
                else:
                    # Mark for review
                    new_file.type = "UNKNOWN"
                    new_file.status = "REVIEW"
                    db.add(new_file)
                    db.commit()

    except Exception as e:
        print(f"Scan error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    while True:
        scan()
        time.sleep(10)
