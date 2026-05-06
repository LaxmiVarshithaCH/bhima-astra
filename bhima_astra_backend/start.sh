#!/bin/bash

echo "=== BHIMA ASTRA API START ==="

# Run migrations
echo "Running migrations..."
alembic upgrade head || exit 1

echo "Starting FastAPI..."

gunicorn app.main:app \
  --workers 2 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:10000 \
  --timeout 120