import os
import redis
from sqlalchemy import create_engine, Column, String, Integer, DateTime, ForeignKey, Float, BigInteger
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

# Redis Connection (Queues only)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
r = redis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)

# Queues
QUEUE_SCAN = "queue:scan"
QUEUE_PHOTO = "queue:photo"
QUEUE_VIDEO_SPLIT = "queue:video_split"
QUEUE_VIDEO_ENCODE = "queue:video_encode"
QUEUE_VIDEO_JOIN = "queue:video_join"
QUEUE_RAW = "queue:raw"
QUEUE_THUMB = "queue:thumb"

# Postgres Connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pipeline:pipeline@localhost:5432/pipeline")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class Config(Base):
    __tablename__ = "config"
    key = Column(String, primary_key=True)
    value = Column(String)

class Source(Base):
    __tablename__ = "sources"
    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, unique=True)
    status = Column(String, default="IDLE") # IDLE, SCANNING
    last_scanned = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)

class File(Base):
    __tablename__ = "files"
    
    id = Column(String, primary_key=True, index=True)
    path = Column(String, unique=True, index=True)
    status = Column(String, default="QUEUED") # QUEUED, PROCESSING, DONE, ERROR, REVIEW
    type = Column(String) # PHOTO, VIDEO, RAW, UNKNOWN
    
    # Paths
    output_path = Column(String, nullable=True)
    sidecar_path = Column(String, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    
    # Stats
    size_bytes = Column(BigInteger, nullable=True)
    output_size_bytes = Column(BigInteger, nullable=True)
    compression_ratio = Column(Float, nullable=True)
    
    # Metadata
    file_create_date = Column(DateTime, nullable=True)
    file_update_date = Column(DateTime, nullable=True)
    meta_create_date = Column(DateTime, nullable=True) # From EXIF
    meta_camera = Column(String, nullable=True)
    meta_gps = Column(String, nullable=True)
    
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    video_job = relationship("VideoJob", back_populates="file", uselist=False, cascade="all, delete-orphan")

class VideoJob(Base):
    __tablename__ = "video_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String, ForeignKey("files.id"), unique=True)
    total_chunks = Column(Integer, default=0)
    job_dir = Column(String)
    
    file = relationship("File", back_populates="video_job")
    chunks = relationship("VideoChunk", back_populates="job", cascade="all, delete-orphan")

class VideoChunk(Base):
    __tablename__ = "video_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("video_jobs.id"))
    chunk_index = Column(Integer)
    chunk_path = Column(String)
    status = Column(String, default="PENDING") # PENDING, ENCODING, DONE, ERROR
    retry_count = Column(Integer, default=0)
    
    job = relationship("VideoJob", back_populates="chunks")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
