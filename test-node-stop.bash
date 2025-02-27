#!/usr/bin/env bash

set -eu

echo "== Stopping and removing containers, volumes, and networks..."
docker compose down -v --remove-orphans

echo "== Cleaning up ./data directory..."
if [ -d "./data" ]; then
    # Remove all subdirectories in ./data
    find ./data -mindepth 1 -type d -exec rm -rf {} \; 2>/dev/null || true
    # Also remove all files in ./data
    find ./data -type f -delete 2>/dev/null || true
    echo "   Data directory cleaned."
else
    echo "   ./data directory not found. Skipping."
fi
