#!/usr/bin/env bash
set -euo pipefail

# Deploy vibebug.dev static site to DigitalOcean droplet
SERVER="root@143.244.184.209"
REMOTE_DIR="/var/www/vibebug.dev"
LOCAL_DIR="$(cd "$(dirname "$0")/../site" && pwd)"

echo "Deploying $LOCAL_DIR → $SERVER:$REMOTE_DIR"
rsync -avz --delete "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"
echo "Done. https://vibebug.dev"
