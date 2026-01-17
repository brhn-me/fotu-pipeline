# Fotu Pipeline

An advanced, event-driven content ingestion and processing pipeline built with Python, FastAPI, Redis, Postgres, and Docker.

## Overview

Fotu Pipeline is designed to ingest massive amounts of media files (Photos, Videos, RAWs) from various sources, process them efficiently using a distributed worker architecture, and provide a unified interface for management and observability.

### Key Features
-   **Event-Driven Architecture**: Uses Redis queues for high-throughput, decoupled task processing.
-   **Distributed Workers**: Specialized workers for Scanning, Metadata, Thumbnails, Photos, and Videos.
-   **Chunked Video Processing**: Splits large video files into small chunks for parallel encoding, then joins them back (Map-Reduce pattern).
-   **Observability First**: Full integration with Loki, Promtail, and Grafana for structured logs and dashboards.
-   **State Management**: Postgres for reliable job tracking and file status (SQLAlchemy ORM).
-   **Modern Tech Stack**: FastAPI Backend, React/Vite Frontend, Docker Compose infrastructure.

## Architecture

### Services
*   **API (`api`)**: FastAPI Gateway. Manages sources, files, configuration, and exposes logs/metrics.
*   **Scanner (`worker-scanner`)**: Crawls directories, detects new files, and dispatches tasks.
*   **Metadata (`worker-metadata`)**: Extracts EXIF/XMP/Video metadata using `exiftool`.
*   **Thumb (`worker-thumb`)**: Generates optimized WebP thumbnails.
*   **Photo (`worker-photo`)**: Processes images (resize, convert).
*   **Video (`worker-video`)**: Handles complex split-encode-join pipeline for videos.
*   **Raw (`worker-raw`)**: Processes RAW photo formats.
*   **Frontend**: React + Tailwind dashboard for viewing file status and logs.

### Infrastructure
*   **Redis**: Task queues (`queue:scan`, `queue:thumb`, `queue:video_split`, etc.).
*   **Postgres**: Persistent storage for `Files`, `FileMetadata`, `VideoJobs`.
*   **Loki & Promtail**: Log aggregation stack.
*   **Grafana**: Visualization of logs and metrics.

## Quick Start

### Prerequisites
*   Docker & Docker Compose
*   Make (optional, but recommended)

### specific commands

1.  **Start the stack**:
    ```bash
    make up
    # OR
    docker compose up -d
    ```

2.  **Run Migrations** (First time setup):
    ```bash
    make db-migrate
    ```

3.  **Access the interfaces**:
    *   **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
    *   **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
    *   **Grafana**: [http://localhost:3000](http://localhost:3000) (User: `admin`, Pass: `pipeline` - dependent on config)

4.  **Add Content**:
    Place files into `./data/source` or configure a new source via the API/UI.

5.  **Stop**:
    ```bash
    make down
    ```

6.  **Reset** (Wipe DB and Output):
    ```bash
    make reset
    ```

## Video Processing Pipeline

The video worker uses a sophisticated **Split-Encode-Join** strategy:

1.  **Split**: Large video is segmented into 10-second chunks. A `VideoJob` is created in Postgres.
2.  **Encode**: Each chunk is queued individually (`queue:video_encode`). Multiple workers can process these in parallel.
3.  **Join**: Once all chunks are `DONE`, a final Join task stitches them together (`queue:video_join`) and updates the final file record.

This ensures that a failure in one chunk doesn't require restarting the whole job (retries are granular), and allows horizontal scaling.

## Development

-   **Backend**: `backend/src` - Python code.
    -   Shared logic: `db.py`, `logger.py`.
    -   Workers: `worker_*.py`.
-   **Frontend**: `frontend/` - React/Vite app.
-   **Logs**: Use `src.logger.get_logger("service_name")`. Logs are automatically shipped to Loki as JSON.
