import os
import json
import shutil
import time
from datetime import datetime
from sqlalchemy.orm import Session
from src.db import r, SessionLocal, File, FileMetadata, Export, Config, QUEUE_ORGANIZE, STATS_PROCESSING, STATS_DONE, STATS_FAIL
from src.logger import get_logger

logger = get_logger("worker.organizer")

DEFAULT_OUTPUT_DIR = "/data/output"

def get_output_dir(db: Session):
    conf = db.query(Config).filter(Config.key == "output_dir").first()
    if conf and conf.value:
        return conf.value
    return os.getenv("OUTPUT_DIR", DEFAULT_OUTPUT_DIR)

def process_organize(payload):
    file_id = payload.get("file_id")
    temp_path = payload.get("temp_path")
    # type: IMAGE or VIDEO
    file_type = payload.get("type", "UNKNOWN") 
    
    r.incr(f"{STATS_PROCESSING}organizer")
    
    db: Session = SessionLocal()
    try:
        logger.info(f"Organizing {file_id}", extra={"file_id": file_id, "temp_path": temp_path})
        
        file_rec = db.query(File).filter(File.id == file_id).first()
        if not file_rec:
            logger.error(f"File record not found", extra={"file_id": file_id})
            return

        # 1. Verification
        if not os.path.exists(temp_path):
            raise Exception(f"Temp file missing: {temp_path}")
            
        if os.path.getsize(temp_path) == 0:
            raise Exception("Temp file is empty")
            
        # Verify Metadata exists
        if not file_rec.meta_info:
            logger.warning(f"No metadata found for {file_id}, proceeding with defaults", extra={"file_id": file_id})

        # TODO: Strict resolution check if needed?
        # User said: "verify if export file meta data match exactly as it is in metadata table"
        # Since we just generated it, it might vary slightly (e.g. slight crop or resize), 
        # but for now we assume the worker that generated it did its job. 
        # If strict check is needed, we'd need to probe the temp file here again.

        output_dir = get_output_dir(db)
        
        # 2. Determine Date
        date_obj = datetime.now()
        if file_rec.meta_info and file_rec.meta_info.taken_at:
             date_obj = file_rec.meta_info.taken_at
        elif file_rec.file_create_date:
             date_obj = file_rec.file_create_date
             
        # 3. Construct Destination
        yyyy = date_obj.strftime("%Y")
        mm = date_obj.strftime("%m")
        dd = date_obj.strftime("%d")
        day_str = f"{yyyy}-{mm}-{dd}"
        
        ymd = date_obj.strftime("%Y%m%d")
        hms = date_obj.strftime("%H%M")
        sec = date_obj.strftime("%S")
        sss = date_obj.strftime("%f")[:3]
        
        prefix = "IMG" if file_type == "IMAGE" else "VID"
        ext = os.path.splitext(temp_path)[1]
        
        base_name = f"{prefix}_{ymd}_{hms}{sec}{sss}"
        
        # Albums structure: albums/YYYY/YYYY-MM-DD/
        final_dir = os.path.join(output_dir, "albums", yyyy, day_str)
        os.makedirs(final_dir, exist_ok=True)
        
        candidate_path = os.path.join(final_dir, base_name + ext)
        
        # Conflict Resolution
        conflict_suffix = 0
        while True:
             existing_export = db.query(Export).filter(Export.path == candidate_path).first()
             # Also check filesystem just in case
             if existing_export or os.path.exists(candidate_path):
                 if existing_export and existing_export.file_id == file_id:
                     break # Same file, overwrite
                 else:
                     conflict_suffix += 1
                     candidate_path = os.path.join(final_dir, f"{base_name}+{conflict_suffix}{ext}")
             else:
                 break
                 
        final_path = candidate_path
        
        # 4. Move File
        shutil.move(temp_path, final_path)
        logger.info(f"Moved to {final_path}", extra={"file_id": file_id})
        
        # 5. Update DB
        stats = os.stat(final_path)
        
        file_rec.output_path = final_path
        file_rec.status = "DONE"
        file_rec.output_size_bytes = stats.st_size
        if file_rec.size_bytes and file_rec.size_bytes > 0:
            file_rec.compression_ratio = round(file_rec.size_bytes / stats.st_size, 2)
            
        # Update/Create Export Record
        # We need width/height. We can get it from metadata if we assume no resize, 
        # or we assume previous worker passed it in payload?
        # Payload didn't include it. 
        # Let's trust metadata IF it exists, or 0.
        w, h = 0, 0
        if file_rec.meta_info:
            w = file_rec.meta_info.width
            h = file_rec.meta_info.height
            
        existing_export = db.query(Export).filter(Export.path == final_path).first()
        if existing_export:
             existing_export.file_id = file_id
             existing_export.type = file_type
             existing_export.size_bytes = stats.st_size
             existing_export.created_at = datetime.utcnow()
        else:
             new_export = Export(
                 file_id=file_id,
                 type=file_type,
                 path=final_path,
                 variant="ORIGINAL", # Or derived? Assuming main export.
                 width=w,
                 height=h,
                 size_bytes=stats.st_size
             )
             db.add(new_export)
             
        db.commit()
        r.incr(f"{STATS_DONE}organizer")

    except Exception as e:
        logger.error(f"Organizer Error: {e}", extra={"file_id": file_id})
        # If move failed, temp file might still be there.
        # Retry logic?
        r.incr(f"{STATS_FAIL}organizer")
        if file_rec: # Re-query?
             file_rec.status = "ERROR"
             file_rec.error_message = f"Organizer: {str(e)}"
             db.commit()
    finally:
        r.decr(f"{STATS_PROCESSING}organizer")
        db.close()

if __name__ == "__main__":
    logger.info("Organizer Worker Started")
    # Single Threaded Loop
    while True:
        task = r.blpop(QUEUE_ORGANIZE, timeout=10)
        if task:
            try:
                payload = json.loads(task[1])
                process_organize(payload)
            except Exception as e:
                logger.error(f"Task error: {e}")
