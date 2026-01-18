# Project Roadmap

This document outlines the development roadmap for the Fotu Pipeline, tracking completed milestones and future goals.

## Phase 1: Foundation (Completed) ✅
*Focus: Core ingestion, processing, and basic UI.*
- [x] **Event-Driven Architecture**: Redis-based message queues for loose coupling between Scanner and Workers.
- [x] **Multi-Type Support**:
    -   **Scanner**: Recursive directory scanning with sidecar detection.
    -   **Photo Worker**: Exif extraction, AVIF conversion.
    -   **Video Worker**: Split-Encode-Join workflow (AV1/Opus), thumbnail generation.
    -   **RAW Worker**: Darktable CLI integration for RAW development.
    -   **Metadata**: Centralized metadata extraction (ExifTool, FFprobe, Python-Magic).
- [x] **Storage**:
    -   **Thumbnails**: Trie-based hashing storage (`thumbs/ab/cd/{id}.webp`).
    -   **Exports**: Date-based hierarchy (`exports/YYYY/YYYY-MM-DD/`).
    -   **Database**: PostgreSQL schema for Files, Thumbnails, Exports.
- [x] **Frontend MVP**: React/Tailwind Dashboard, File Explorer, Overview Stats.

## Phase 2: Reliability & Observability (Current) 🚧
*Focus: Stability, monitoring, and quality of life.*
- [x] **Live Monitoring**: 
    -   Real-time "Workers" page with Redis-backed stats (Queued/Processing/Done/Fail).
    -   Loki/Promtail integration for centralized logging.
- [x] **Robust Metadata**: Content-based MimeType detection, GPS extraction refinement.
- [x] **Schema Refinement**: Split `DerivedFile` into explicit `Thumbnail` and `Export` tables.
- [ ] **Work Directory**: Move work directories for videos chunks into root/.cache/chunks/(trie structure), set job id as uuid, use uuid for trie structure, update db to refer properly, 
- [ ] **Seperate Organizer worker**: Organizer worker should seperate from image and video worker, once a image/video export is generated, it should be added to organizer queue which will do the organization into YYYY/YYYY-MM-DD dir, it should also verify if export file meta data match exactly as it is in metadata table. It should also be ensured there is only one instance of organizer worker because this operation is not concurrency safe.
so videos and image exports by image worker and video workers should be generated first in .cache/images/{trie}, .cache/videos/{trie} and organizer worker should move it safely into "albums/YYYY/YY-MM-DD/{defined image, video file name} path

- [ ] Improving the logs

- [ ] **Updating metadata**: User should be allowed to modify/ fix photo taken date, add/ fix location


- [ ] **Error Handling**: Dead Letter Queues (DLQ) for failed jobs, auto-retry policies.
- [ ] **Tests**: Comprehensive integration tests for the full pipeline.

## Phase 3: Discovery & Organization (Q2 2026) 🔮
*Focus: Finding and organizing content.*
- [ ] **Search Engine**: Full-text search on metadata (Lens, Camera, Location, Date).
- [ ] **Geospatial Features**: Map view with clustering for photos/videos.
- [ ] **Albums**: Virtual collections of files.
- [ ] **Tagging**: 
    -   Manual tagging UI.
    -   **AI Tagging**: Integration with CLIP/ResNet for auto-tagging (Objects, Scenes).
- [ ] **Face Recognition**: Clustering faces and naming people.

## Phase 4: Scale & Distribution (Q3 2026) 🚀
*Focus: Performance and multi-node support.*
- [ ] **Distributed Workers**: Deploy workers across multiple physical machines.
- [ ] **Hardware Acceleration**: NVENC/QSV support for Video Worker.
- [ ] **Transcoding Variants**: Auto-generate multiple quality levels (1080p, 720p) for different bandwidths.
- [ ] **Mobile App**: Native or PWA mobile client for browsing and backup.
- [ ] **Multi-User**: Authentication, granular permissions, and sharing.

## Phase 5: Polish & Ecosystem (Future) ✨
- [ ] **Plex/Jellyfin Plugin**: Expose library to external media servers.
- [ ] **Auto-Import**: Watch folder support (inotify) for instant ingestion.
- [ ] **Cloud Sync**: Encrypted backup to S3/B2.
