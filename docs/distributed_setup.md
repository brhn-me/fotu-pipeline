# Distributed Pipeline Setup

This guide explains how to scale the Fotu Pipeline by running worker services on multiple devices (nodes). This is useful for offloading heavy tasks like video encoding to powerful servers while keeping the main application on a lighter device.

## Prerequisites

1.  **Network Visibility**: All nodes must be able to communicate with the **Central Node** (where Redis and Postgres run).
2.  **Shared Storage**: All nodes **MUST** have access to the exact same files at the exact same paths. This is non-negotiable because workers pass file paths (e.g., `/data/source/video.mp4`) to each other.
    *   **Recommendation**: Use NFS (Network File System) or SMB.
    *   Example: Mount your NAS media folder to `/mnt/media` on *all* nodes.

## 1. Central Node Setup

The Central Node hosts the core infrastructure: Database, Redis Queue, API, and Frontend.

1.  Configure your `docker-compose.yaml` as usual.
2.  Ensure Redis and Postgres ports are exposed to the local network (or use an overlay network).
    *   *Note: The default `docker-compose.yaml` binds ports to `0.0.0.0`, so they should be accessible.*
3.  Run the central stack:
    ```bash
    docker compose up -d loki promtail grafana redis db api frontend worker-scanner
    # You can also run lightweight workers (like metadata/thumb) here if desired.
    ```
4.  Find the IP address of this node (e.g., `192.168.1.10`).

## 2. Worker Node Setup

Worker Nodes will run processing containers (e.g., `worker-video`, `worker-photo`) and connect back to the Central Node.

### Step A: Mount Storage
Ensure your media and data directories are mounted.
*   **Media**: Must be RW.
*   **Data**: Must be RW (for temp processing files).

### Step B: Create Worker Config
Create a `docker-compose.worker.yaml` on the worker machine:

```yaml
services:
  # Heavy Video Worker
  worker-video:
    image: ghcr.io/your-username/fotu-pipeline:latest # Or build locally
    build: ./backend  # If building from source
    restart: always
    environment:
      - REDIS_HOST=192.168.1.10       # IP of Central Node
      - DATABASE_URL=postgresql://pipeline:pipeline@192.168.1.10:5442/pipeline # IP & Port of Central DB
    volumes:
      - /mnt/nfs/data:/data           # SHARED storage for temp files
      - /mnt/nfs/media:/media_root    # SHARED media storage
    command: python -u -m src.worker_video

  # You can add other workers similarly (worker-raw, worker-photo)
```

### Step C: Run Workers
```bash
docker compose -f docker-compose.worker.yaml up -d
```

## 3. Verification
1.  Check logs on the Worker Node:
    ```bash
    docker compose -f docker-compose.worker.yaml logs -f
    ```
    You should see "Connected to Redis" or "Worker Started".
2.  Upload a file to the watched folder.
3.  The Central Node's `worker-scanner` will pick it up and queue it.
4.  The Worker Node's `worker-video` will pull the job, process it, and update the Central DB.

## Troubleshooting
*   **Path Errors**: If workers fail with "File not found", verify that `/media_root/file.jpg` on the Central Node exists at exactly `/media_root/file.jpg` on the Worker Node.
*   **Connection Refused**: Check firewall settings on the Central Node (allow port 6379 for Redis, 5432/5442 for Postgres).
