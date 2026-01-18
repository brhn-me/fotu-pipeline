# Bare Metal Worker Setup (CentOS/Conda)

This guide explains how to run the Fotu Pipeline workers on a CentOS server without root access (`sudo`) or Docker, utilizing the `conda` package manager.

## Prerequisites

1.  **Access**: SSH access to the server.
2.  **Conda**: Ability to load conda (`module load conda` or similar).
3.  **Network**: Connection to the Central Node (where Redis/Postgres are running).
4.  **Storage**: Access to the *exact same* media and data paths as the Central Node (e.g., `/mnt/media`, `/mnt/data`).

## 1. Environment Setup

Since we cannot use Docker images, we will recreate the software environment using Conda.

### A. Initialize Conda
```bash
module load conda
conda init bash
source ~/.bashrc  # Reload to apply changes
```

### B. Create Environment
Create a dedicated environment with Python 3.11 and necessary tools.

```bash
# Create environment named 'fotu-worker'
conda create -n fotu-worker python=3.11 -y
conda activate fotu-worker
```

### C. Install Dependencies
We need `ffmpeg` for video processing and `exiftool` for metadata. `darktable` is optional but recommended for raw photo processing if available.

```bash
# Install tools from conda-forge
conda install -c conda-forge ffmpeg perl-image-exiftool darktable -y
```

### D. Verification
Verify everything is in your path and *not* using system versions.
```bash
which ffmpeg    # Should be ~/.conda/envs/fotu-worker/bin/ffmpeg
which exiftool
which python
```

## 2. Code Setup

### A. Clone Repository
Clone the pipeline code to your user directory.
```bash
cd ~
git clone https://github.com/your-username/fotu-pipeline.git
cd fotu-pipeline/backend
```

### B. Install Python Libraries
Install the Python dependencies into your conda environment.
```bash
pip install -r requirements.txt
```

## 3. Configuration

Create a `.env` file in the `backend` directory to tell the worker where to find the Central Node.

```bash
cp ../.env.template .env
nano .env
```

**Critical Settings:**
*   **REDIS_HOST**: IP address of the Central Node.
*   **DATABASE_URL**: Postgres connection string for the Central Node.
    *   Example: `postgresql://pipeline:pipeline@192.168.1.50:5442/pipeline`
*   **OUTPUT_DIR**: Must match a path writeable by this server (e.g., `/mnt/data/output`).

## 4. Running Workers

We want to run multiple workers to utilize the 16 cores. Since `libaom-av1` encoding is CPU intensive, we should trigger enough workers to saturate the CPU without overloading it.

A helper script is provided to start multiple instances.

### Start 4 Video Workers and 1 Metadata Worker
```bash
# chmod +x start_workers.sh
./start_workers.sh 4
```

This will confirm the dependencies and spawn 4 background processes consuming from the video queue.

### Monitoring
You can monitor the output:
```bash
tail -f worker.log
```
(The helper script redirects output to `worker.log`)
