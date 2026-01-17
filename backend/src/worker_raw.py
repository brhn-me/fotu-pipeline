import os
import json
import shutil
import subprocess
from sqlalchemy.orm import Session
from src.db import r, engine, SessionLocal, File, Config, QUEUE_RAW

# Default output dir if config not set
DEFAULT_OUTPUT_DIR = "/data/output"

def get_output_dir(db: Session):
    conf = db.query(Config).filter(Config.key == "output_dir").first()
    if conf and conf.value:
        return conf.value
    return os.getenv("OUTPUT_DIR", DEFAULT_OUTPUT_DIR)

def process_raw(payload):
    file_path = payload["path"]
    file_id = payload["id"]
    print(f"Processing RAW: {file_path}")
    
    db: Session = SessionLocal()
    try:
        file_rec = db.query(File).filter(File.id == file_id).first()
        if file_rec:
            file_rec.status = "PROCESSING"
            db.commit()
            
        output_dir = get_output_dir(db)
        
        # Determine relative path from Source? 
        # Since we have multiple sources, we need to find which source this file belongs to 
        # effectively, or just flatten/preserve folder structure?
        # A simple heuristic: if path starts with a known source, use relpath.
        # But for now let's just use basename to avoid complexity or flattened structure.
        # User asked for "output should be only one entry".
        
        rel_name = os.path.basename(file_path)
        name_no_ext = os.path.splitext(rel_name)[0]
        output_path = os.path.join(output_dir, "raw", name_no_ext + ".jpg")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Darktable CLI
        # usage: darktable-cli <input> <xmp> <output>
        # or darktable-cli <input> <output>
        # If sidecar exists, we should pass it. 
        # But darktable-cli usually auto-detects sidecar if it's named same as input.xmp
        # We explicitly found sidecar in scanner, so we can ensure it's there.
        
        cmd = ["darktable-cli", file_path, output_path, "--core", "--conf", "plugins/imageio/format/jpeg/quality=95"]
        
        # If sidecar explicitly known and different name (unlikely for darktable), check it.
        # Let's trust darktable auto-loading co-located xmp.
        
        print(f"Running darktable-cli for {file_path}")
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        if not os.path.exists(output_path):
            raise Exception("Output JPG not created")
            
        # Update DB
        stats = os.stat(output_path)
        if file_rec:
            file_rec.status = "DONE"
            file_rec.output_path = output_path
            file_rec.output_size_bytes = stats.st_size
            if file_rec.size_bytes and file_rec.size_bytes > 0:
                file_rec.compression_ratio = round(file_rec.size_bytes / stats.st_size, 2)
            db.commit()
            
        print(f"Done RAW: {output_path}")

    except Exception as e:
        print(f"RAW Error: {e}")
        if file_rec:
            file_rec.status = "ERROR"
            file_rec.error_message = str(e)
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    print("RAW Worker Started")
    # Check darktable
    try:
        subprocess.run(["darktable-cli", "--version"], stdout=subprocess.DEVNULL)
    except FileNotFoundError:
        print("WARNING: darktable-cli not found!")

    while True:
        task = r.blpop(QUEUE_RAW, timeout=10)
        if task:
            try:
                payload = json.loads(task[1])
                process_raw(payload)
            except Exception as e:
                print(f"Task error: {e}")
