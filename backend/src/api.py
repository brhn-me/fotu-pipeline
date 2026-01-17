from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from src.db import SessionLocal, File, VideoJob, VideoChunk, Source, Config, init_db
from src.db import r, QUEUE_VIDEO_ENCODE, QUEUE_SCAN
import logging
import requests
from src.logger import get_logger

logger = get_logger("api")
from pydantic import BaseModel
import os
import json
from datetime import datetime

app = FastAPI()

@app.on_event("startup")
def startup_event():
    # init_db()  # Rely on Alembic migrations
    pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ConfigRequest(BaseModel):
    key: str
    value: str

class SourceRequest(BaseModel):
    path: str

@app.get("/api/config")
def get_config(db: Session = Depends(get_db)):
    configs = db.query(Config).all()
    return {c.key: c.value for c in configs}

@app.post("/api/config")
def set_config(conf: ConfigRequest, db: Session = Depends(get_db)):
    c = db.query(Config).filter(Config.key == conf.key).first()
    if not c:
        c = Config(key=conf.key, value=conf.value)
        db.add(c)
    else:
        c.value = conf.value
    db.commit()
    return {"status": "ok", "key": conf.key, "value": conf.value}

@app.get("/api/sources")
def list_sources(db: Session = Depends(get_db)):
    return db.query(Source).all()

@app.post("/api/sources")
def add_source(req: SourceRequest, db: Session = Depends(get_db)):
    # Check if exists
    existing = db.query(Source).filter(Source.path == req.path).first()
    if existing:
        raise HTTPException(400, "Source already exists")

    if not os.path.exists(req.path):
        raise HTTPException(400, f"Path '{req.path}' does not exist on server")
    
    # Init source
    new_source = Source(path=req.path, status="QUEUED")
    db.add(new_source)
    db.commit()
    
    # Trigger scan
    r.rpush(QUEUE_SCAN, json.dumps({"source_id": new_source.id}))
    return new_source

@app.post("/api/sources/{source_id}/scan")
def scan_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(404, "Source not found")
        
    source.status = "QUEUED"
    db.commit()
    
    # Trigger scan
    r.rpush(QUEUE_SCAN, json.dumps({"source_id": source_id}))
    return {"status": "scanning", "id": source_id}

@app.delete("/api/sources/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(404, "Source not found")
        
    # Cascade delete files and physical outputs
    # Since we have cascade delete on DB side (conceptually), we assume DB cleanup is fine?
    # Actually we just added cascade="all, delete-orphan" to relationships in code, checks db.py.
    # But we still need to delete physical files!
    
    files = db.query(File).filter(File.path.startswith(source.path)).all()
    count = 0
    for f in files:
        # Delete output
        if f.output_path and os.path.exists(f.output_path):
            try:
                os.remove(f.output_path)
            except OSError:
                pass
        
        # Delete thumb
        if f.thumbnail_path and os.path.exists(f.thumbnail_path):
            try:
                os.remove(f.thumbnail_path)
            except OSError:
                pass
                
        # Delete sidecar if generated? Usually sidecar is source side, but we might have generated one?
        # If sidecar_path is in source directory, we should probably leave it alone or follow spec?
        # User said "if a source is deleted all output, thumbs, db entries are to be removed".
        # If sidecar is metadata we created, remove it. If it's source file sidecar, keep it?
        # Assuming we only delete generated stuff.
        # But if we delete the File record, we lose track.
        
        count += 1
        
    # Delete source record. 
    # Because we don't have a direct relationship between Source and File in DB (just path prefix logic),
    # verifying if we need to manually delete files.
    # Yes, we do.
    
    for f in files:
        db.delete(f)
        
    db.delete(source)
    db.commit()
    return {"status": "deleted", "id": source_id, "files_removed": count}

@app.get("/api/files")
def list_files(db: Session = Depends(get_db)):
    files = db.query(File).order_by(File.created_at.desc()).all()
    results = []
    
    for f in files:
        progress = 0
        chunks_total = 0
        chunks_done = 0
        
        if f.type == "VIDEO" and f.video_job:
            chunks_total = f.video_job.total_chunks
            if chunks_total > 0:
                chunks_done = db.query(VideoChunk).filter(
                    VideoChunk.job_id == f.video_job.id,
                    VideoChunk.status == "DONE"
                ).count()
                progress = round((chunks_done / chunks_total) * 100)
            elif f.status == "DONE":
                progress = 100
        
        # Prepare metadata
        meta_dict = {}
        if f.meta_info:
            m = f.meta_info
            meta_dict = {
                "mime_type": m.mime_type,
                "width": m.width,
                "height": m.height,
                "taken_at": m.taken_at,
                "lat": m.lat,
                "lon": m.lon,
                "make": m.make,
                "model": m.model,
                "lens": m.lens,
                "iso": m.iso,
                "aperture": m.aperture,
                "exposure_time": m.exposure_time,
                "focal_length": m.focal_length,
                "duration": m.duration,
                "codec": m.codec,
                "framerate": m.framerate
            }

        results.append({
            "id": f.id,
            "name": os.path.basename(f.path) if f.path else f.id,
            "path": f.path,
            "hash": f.hash,
            "status": f.status,
            "output_path": f.output_path,
            "error_message": f.error_message,
            "type": f.type,
            "video_progress": progress,
            "chunks_done": chunks_done,
            "chunks_total": chunks_total,
            "size_bytes": f.size_bytes,
            "output_size_bytes": f.output_size_bytes,
            "compression_ratio": f.compression_ratio,
            "file_create_date": f.file_create_date,
            "file_update_date": f.file_update_date,
            "sidecar_path": f.sidecar_path,
            "thumbnail_path": f.thumbnail_path,
            "metadata": meta_dict
        })
    return results

@app.post("/api/files/{fid}/retry")
def retry_file(fid: str, db: Session = Depends(get_db)):
    file_rec = db.query(File).filter(File.id == fid).first()
    if not file_rec:
        raise HTTPException(404, "File not found")
        
    if file_rec.type == "VIDEO" and file_rec.video_job:
        failed_chunks = db.query(VideoChunk).filter(
            VideoChunk.job_id == file_rec.video_job.id,
            VideoChunk.status.in_(["ERROR", "PENDING"]) 
        ).all()
        
        count = 0
        for chunk in failed_chunks:
            chunk.status = "PENDING"
            chunk.retry_count = 0 
            
            payload = json.dumps({
                "chunk_path": chunk.chunk_path,
                "job_id": chunk.job_id,
                "index": chunk.chunk_index
            })
            r.rpush(QUEUE_VIDEO_ENCODE, payload)
            count += 1
            
        return {"message": f"Retried {count} chunks"}
        
    return {"message": "Not a video or no job found"}

@app.get("/api/files/{fid}/view/{kind}")
def view_file(fid: str, kind: str, db: Session = Depends(get_db)):
    file_rec = db.query(File).filter(File.id == fid).first()
    if not file_rec:
        raise HTTPException(404, "File not found")

    if kind == "input":
        path = file_rec.path
    elif kind == "output":
         path = file_rec.output_path
    elif kind == "sidecar":
         path = file_rec.sidecar_path
    elif kind == "thumb":
         path = file_rec.thumbnail_path
    else:
        raise HTTPException(400, "Invalid kind")
        
    if not path or not os.path.exists(path):
        raise HTTPException(404, "File not found")
        
    return FileResponse(path)

LOKI_URL = "http://loki:3100/loki/api/v1/query_range"

def parse_loki_entry(entry):
    try:
        raw = json.loads(entry[1])
        log_entry = raw.copy()
        # Docker logs often wrap the app log in a 'log' field
        if isinstance(raw, dict) and "log" in raw:
            if isinstance(raw["log"], str):
                try:
                    inner = json.loads(raw["log"])
                    if isinstance(inner, dict):
                        log_entry.update(inner)
                except:
                    # Inner log is just text
                    log_entry["message"] = raw["log"].strip()
        
        if not log_entry.get("timestamp"):
             log_entry["timestamp"] = entry[0]
        return log_entry
    except:
        return {"message": entry[1], "timestamp": entry[0]}

@app.get("/api/logs/service/{service_name}")
def get_service_logs(service_name: str, limit: int = 100):
    # Query: {service="service_name"}
    query = f'{{service="{service_name}"}}'
    try:
        res = requests.get(LOKI_URL, params={"query": query, "limit": limit})
        res.raise_for_status()
        data = res.json()
        logs = []
        if "data" in data and "result" in data["data"]:
            for stream in data["data"]["result"]:
                for entry in stream["values"]:
                    logs.append(parse_loki_entry(entry))
        logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return logs
    except Exception as e:
        logger.error(f"Loki Error: {e}")
        return []

@app.get("/api/fs/ls")
def list_fs(path: str = ""):
    MEDIA_ROOT = "/media_root"
    
    # Sanitize path
    # Remove leading slashes to join correctly
    clean_path = path.lstrip("/")
    full_path = os.path.normpath(os.path.join(MEDIA_ROOT, clean_path))
    
    # Security check: Ensure we are stuck in MEDIA_ROOT
    if not full_path.startswith(MEDIA_ROOT):
         raise HTTPException(400, "Invalid path")
         
    if not os.path.exists(full_path):
        raise HTTPException(404, "Path not found")
        
    if not os.path.isdir(full_path):
        raise HTTPException(400, "Not a directory")
        
    try:
        entries = os.listdir(full_path)
        dirs = [d for d in entries if os.path.isdir(os.path.join(full_path, d))]
        dirs.sort()
        return dirs
    except Exception as e:
        logger.error(f"FS Error: {e}")
        raise HTTPException(500, str(e))

@app.get("/api/logs/file/{file_id}")
def get_file_logs(file_id: str, limit: int = 100):
    # Query: {file_id="file_id"}
    query = f'{{file_id="{file_id}"}}'
    try:
        res = requests.get(LOKI_URL, params={"query": query, "limit": limit})
        res.raise_for_status()
        data = res.json()
        logs = []
        if "data" in data and "result" in data["data"]:
            for stream in data["data"]["result"]:
                for entry in stream["values"]:
                    logs.append(parse_loki_entry(entry))
        logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return logs
    except Exception as e:
        logger.error(f"Loki Error: {e}")
        return []
