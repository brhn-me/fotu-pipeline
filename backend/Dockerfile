FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
# ffmpeg for video processing
# libavif-bin / libavif-dev might be needed for some tools, but Pillow wheels usually include binaries or we use ffmpeg for everything.
# We install ffmpeg and some basic tools.
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libavif-bin \
    exiftool \
    darktable \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

Copy . .

# We don't set CMD here because we override it in docker-compose
