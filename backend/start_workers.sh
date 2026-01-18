#!/bin/bash

# Configuration
LOG_FILE="worker.log"
PYTHON_CMD="python -u"

# cleanup function
cleanup() {
    echo "Stopping all workers..."
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup SIGINT SIGTERM

echo "Checking environment..."

# 1. Check for Conda/Python
if ! command -v python &> /dev/null; then
    echo "Error: 'python' not found. Did you activate your conda environment?"
    exit 1
fi

# 2. Check for dependencies
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: 'ffmpeg' not found."
    exit 1
fi
if ! command -v exiftool &> /dev/null; then
    echo "Error: 'exiftool' not found."
    exit 1
fi

# 3. Check for .env
if [ ! -f .env ]; then
    echo "Error: .env file not found in $(pwd)"
    echo "Please create one from .env.template"
    exit 1
fi

NUM_WORKERS=${1:-1}
echo "Starting $NUM_WORKERS video worker(s)... Logging to $LOG_FILE"

# Start Workers
for (( i=1; i<=NUM_WORKERS; i++ ))
do
    echo "  Starting worker #$i"
    $PYTHON_CMD -m src.worker_video >> "$LOG_FILE" 2>&1 &
done

# Start one metadata worker just in case (optional, remove if run elsewhere)
# echo "  Starting metadata worker"
# $PYTHON_CMD -m src.worker_metadata >> "$LOG_FILE" 2>&1 &

echo "Workers running. Press Ctrl+C to stop."
wait
