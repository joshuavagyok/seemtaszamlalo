#!/bin/bash
# SeeMTA Tracker — Deploy script
# Másolat: cp deploy.sh deploy.local.sh és ott add meg a TARGET_HOST-ot
set -e

TARGET_HOST="${TARGET_HOST:-user@your-server}"
TARGET_DIR="${TARGET_DIR:-/home/user/seemta-tracker}"

cd "$(dirname "$0")"

echo "📦 Fájlok másolása → $TARGET_HOST:$TARGET_DIR"
scp server.py script.js index.html style.css "$TARGET_HOST:$TARGET_DIR/"

echo "🔨 Docker build + restart..."
ssh "$TARGET_HOST" "cd $TARGET_DIR && \
    docker build -t seemta-tracker . && \
    docker stop seemta-tracker 2>/dev/null || true && \
    docker rm seemta-tracker 2>/dev/null || true && \
    docker run -d --name seemta-tracker --restart always -p 8765:8765 \
        -v $TARGET_DIR/data.json:/app/data.json seemta-tracker"

echo "✅ Done! Running at http://$(echo $TARGET_HOST | cut -d@ -f2):8765/"
