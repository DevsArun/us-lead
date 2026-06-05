#!/bin/bash
set -e

echo "================================"
echo "  LeadForge AI - Starting Up    "
echo "================================"

mkdir -p /app/logs /app/data

# Install Playwright browser at runtime (skipped during build to avoid HF build limits)
echo "Installing Chromium browser for scraping..."
playwright install chromium 2>/dev/null || echo "Playwright browser install skipped (will use httpx fallback)"

# Install browser system deps
playwright install-deps chromium 2>/dev/null || echo "Browser deps install skipped"

if [ -f /app/backend/.env ]; then
  export $(cat /app/backend/.env | grep -v '^#' | xargs)
fi

echo "Starting services..."
exec "$@"
