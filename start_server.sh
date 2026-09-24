#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# Kill existing instances if any
pkill -f "python3.*app.py" 2>/dev/null || true
pkill -f "cloudflared.*5000" 2>/dev/null || true
sleep 1

# Start app.py
nohup python3 app.py > app.log 2>&1 &
echo "app.py started with PID $!"

# Start cloudflared
nohup cloudflared tunnel --url http://127.0.0.1:5000 > tunnel.log 2>&1 &
echo "cloudflared started with PID $!"

# Wait for tunnel URL
echo "Waiting for Cloudflare Tunnel URL..."
for i in {1..30}; do
    URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" tunnel.log | head -n 1 || true)
    if [ -n "$URL" ]; then
        echo "$URL" > tunnel_url.txt
        echo "Tunnel URL: $URL"
        exit 0
    fi
    sleep 1
done

echo "Failed to get tunnel URL within 30s"
exit 1
