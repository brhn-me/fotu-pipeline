import os
import json
import subprocess
import shutil
import glob
import uuid
from sqlalchemy.orm import Session
from sqlalchemy.orm import Session
from src.db import r, engine, SessionLocal, File, VideoJob, VideoChunk, Config, Export, STATS_PROCESSING, STATS_DONE, STATS_FAIL, QUEUE_ORGANIZE
from src.db import QUEUE_VIDEO_SPLIT, QUEUE_VIDEO_ENCODE, QUEUE_VIDEO_JOIN
from datetime import datetime
from src.utils import get_trie_path
from src.logger import get_logger

logger = get_logger("worker.video")

DEFAULT_OUTPUT_DIR = "/data/output"

def get_output_dir(db: Session):
    conf = db.query(Config).filter(Config.key == "output_dir").first()
    if conf and conf.value:
        return conf.value
    return os.getenv("OUTPUT_DIR", DEFAULT_OUTPUT_DIR)
TEMP_DIR = "/data/temp_video"

os.makedirs(TEMP_DIR, exist_ok=True)

def get_rel_path(file_path):
    if file_path.startswith(SOURCE_DIR):
        return os.path.relpath(file_path, SOURCE_DIR)
    return os.path.basename(file_path)

def process_split(payload):
    file_path = payload["path"]
    file_id = payload["id"]
    logger.info(f"Splitting: {file_path}", file_id=file_id)
    
    r.incr(f"{STATS_PROCESSING}video_split")
    
    db: Session = SessionLocal()
    try:
        # Update Status
        file_rec = db.query(File).filter(File.id == file_id).first()
        if file_rec:
            file_rec.status = "SPLITTING"
            db.commit()

        # Create distinct temp dir via Trie
        # .cache/chunks/{trie}
        # get_trie_path returns ab/cd/{file_id}
        rel_path = get_trie_path(file_id)
        job_dir = os.path.join(TEMP_DIR, "chunks", os.path.dirname(rel_path), file_id)
        
        if os.path.exists(job_dir):
            shutil.rmtree(job_dir)
        os.makedirs(job_dir, exist_ok=True)

        # Split
        segment_pattern = os.path.join(job_dir, "chunk_%03d.mp4")
        subprocess.run([
            "ffmpeg", "-i", file_path, 
            "-c", "copy", 
            "-map", "0", 
            "-f", "segment", 
            "-segment_time", "10", 
            "-reset_timestamps", "1", 
            segment_pattern
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        chunks = sorted(glob.glob(os.path.join(job_dir, "chunk_*.mp4")))
        total_chunks = len(chunks)
        logger.info(f"Split {file_path} into {total_chunks} chunks", file_id=file_id)

        # Create Job Record
        job_uuid = str(uuid.uuid4())
        job = VideoJob(file_id=file_id, total_chunks=total_chunks, job_dir=job_dir, job_uuid=job_uuid)
        db.add(job)
        db.commit() # Commit to get ID
        
        # Bulk Insert Chunks
        chunk_objects = []
        for i, chunk_path in enumerate(chunks):
             chunk_objects.append(VideoChunk(
                 job_id=job.id,
                 chunk_index=i,
                 chunk_path=chunk_path,
                 status="PENDING"
             ))
        db.add_all(chunk_objects)
        db.commit()

        # Enqueue Chunks
        for i, chunk_path in enumerate(chunks):
            chunk_payload = json.dumps({
                "chunk_path": chunk_path,
                "job_id": job.id,
                "index": i
            })
            r.rpush(QUEUE_VIDEO_ENCODE, chunk_payload)
            
        # Update File Status
        if file_rec:
            file_rec.status = "PROCESSING"
            db.commit()
        r.incr(f"{STATS_DONE}video_split")

    except Exception as e:
        db.rollback()
        logger.error(f"Split Error: {e}", file_id=file_id)
        if file_rec:
            file_rec.status = "ERROR"
            file_rec.error_message = str(e)
            db.commit()
    finally:
        db.close()

def process_encode(payload):
    chunk_path = payload["chunk_path"]
    job_id = payload["job_id"]
    index = payload["index"]
    
    r.incr(f"{STATS_PROCESSING}video_encode")
    
    db: Session = SessionLocal()
    try:
        # Get Chunk Record
        chunk = db.query(VideoChunk).filter(
            VideoChunk.job_id == job_id, 
            VideoChunk.chunk_index == index
        ).first()
        
        # Determine file_id from job for consistent logging context (optional, but good)
        job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
        file_id = job.file_id if job else None
        
        if not chunk:
            logger.error(f"Chunk record not found for job {job_id} index {index}", file_id=file_id)
            return
            
        chunk.status = "ENCODING"
        db.commit()
        
        encoded_chunk_path = chunk_path.replace(".mp4", ".av1.mkv")
        
        try:
            # Encode
            subprocess.run([
                "ffmpeg", "-y", "-i", chunk_path,
                "-c:v", "libaom-av1", "-cpu-used", "6", "-crf", "30",
                "-c:a", "libopus",
                encoded_chunk_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            chunk.status = "DONE"
            db.commit()
            r.incr(f"{STATS_DONE}video_encode")
            
            # Check if all done
            pending_count = db.query(VideoChunk).filter(
                VideoChunk.job_id == job_id, 
                VideoChunk.status != "DONE"
            ).count()
            
            # Detailed Logging
            try:
                # Fetch job details if we didn't already
                if not job:
                     job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
                
                # Fetch file path
                file_path = "Unknown"
                if job:
                     frec = db.query(File).filter(File.id == job.file_id).first()
                     if frec: file_path = frec.path

                total = job.total_chunks if job else 0
                done_count = total - pending_count
                pct = int((done_count / total) * 100) if total > 0 else 0
                
                logger.info(f"Encoded chunk {index+1}/{total} ({pct}%) for {file_path}", file_id=file_id)
            except:
                pass
            
            if pending_count == 0:
                logger.info(f"Job {job_id} complete. Queuing join.", file_id=file_id)
                r.rpush(QUEUE_VIDEO_JOIN, json.dumps({"job_id": job_id}))
                
        except Exception as e:
            db.rollback()
            logger.error(f"Encode Error (Job {job_id} Index {index}): {e}", file_id=file_id)
            chunk.retry_count += 1
            if chunk.retry_count < 3:
                logger.info("Retrying...", file_id=file_id)
                chunk.status = "PENDING"
                db.commit()
                # Re-queue
                r.rpush(QUEUE_VIDEO_ENCODE, json.dumps(payload))
            else:
                chunk.status = "ERROR"
                db.commit()
                r.incr(f"{STATS_FAIL}video_encode")
                
    except Exception: # Top level exception outside logic block if needed? 
        # Actually logic inside try/except block handles retry count but let's count persistent failures?
        # The logic handles chunk.retry_count < 3. 
        # If it retries, it's effectively a "fail" but maybe we don't count it as FAIL yet?
        # The user said "fail". If we retry, it's not a final fail.
        # But if we execute 'r.rpush', it goes back to queue. status pending.
        # If we hit chunk.status = "ERROR", that's a FAIL.
        pass

    finally:
        r.decr(f"{STATS_PROCESSING}video_encode")
        db.close()

def process_join(payload):
    job_id = payload["job_id"]
    
    r.incr(f"{STATS_PROCESSING}video_join")
    
    db: Session = SessionLocal()
    try:
        job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
        if not job: 
            return
            
        file_rec = db.query(File).filter(File.id == job.file_id).first()
        file_id = file_rec.id if file_rec else None
        if file_rec:
            file_rec.status = "JOINING"
            db.commit()
            
        logger.info(f"Joining job {job_id} for {file_rec.path if file_rec else 'Unknown'}", file_id=file_id)
        
        job_dir = job.job_dir
        original_path = file_rec.path
        
        chunks = sorted(glob.glob(os.path.join(job_dir, "*.av1.mkv")))
        
        # Verify count
        if len(chunks) != job.total_chunks:
            logger.warning("Chunk count mismatch during join", file_id=file_id)
            
        list_path = os.path.join(job_dir, "files.txt")
        with open(list_path, "w") as f:
            for chunk in chunks:
                f.write(f"file '{chunk}'\n")
                
        # Join Logic
        # Output to .cache/videos/{trie}/{id}.mkv
        
        output_dir = get_output_dir(db)
        rel_path = get_trie_path(file_id) # ab/cd/id
        video_cache_dir = os.path.join(output_dir, ".cache", "videos", os.path.dirname(rel_path))
        os.makedirs(video_cache_dir, exist_ok=True)
        
        output_path = os.path.join(video_cache_dir, f"{file_id}.mkv")
        
        # ffmpeg concat
        subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path,
            "-c", "copy", output_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Metadata
        subprocess.run([
            "exiftool", "-Overwrite_Original", 
            "-TagsFromFile", original_path, 
            "-all:all>all:all", 
            output_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        shutil.copystat(original_path, output_path)
        
        # Cleanup
        shutil.rmtree(job_dir)
        db.delete(job) 
        
        # Enqueue Organizer
        logger.info(f"Video joined, queueing organize: {output_path}", file_id=file_id)
        org_payload = json.dumps({
            "file_id": file_id,
            "temp_path": output_path,
            "type": "VIDEO"
        })
        r.rpush(QUEUE_ORGANIZE, org_payload)
              
        db.commit()
        r.incr(f"{STATS_DONE}video_join")
        
        logger.info(f"Done video join: {output_path}", file_id=file_id)

    except Exception as e:
        db.rollback()
        logger.error(f"Join Error: {e}")
        if file_rec:
            file_rec.status = "ERROR"
            file_rec.error_message = str(e)
            db.commit()
    finally:
        r.decr(f"{STATS_PROCESSING}video_join")
        db.close()

if __name__ == "__main__":
    logger.info("Video Worker Started")
    while True:
        task = r.blpop([QUEUE_VIDEO_JOIN, QUEUE_VIDEO_ENCODE, QUEUE_VIDEO_SPLIT], timeout=10)
        if task:
            queue_name = task[0]
            payload = json.loads(task[1])
            try:
                if queue_name == QUEUE_VIDEO_SPLIT:
                    process_split(payload)
                elif queue_name == QUEUE_VIDEO_ENCODE:
                    process_encode(payload)
                elif queue_name == QUEUE_VIDEO_JOIN:
                    process_join(payload)
            except Exception as e:
                logger.error(f"Critical Worker Error: {e}")
