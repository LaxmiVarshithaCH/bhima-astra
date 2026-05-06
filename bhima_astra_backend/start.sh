#!/bin/bash
set -e

echo "=== BHIMA ASTRA API START ==="


# Skip migrations on Render (NeonDB tables already exist)
# If you want to run them: uncomment the line below
# alembic upgrade head

echo "Starting FastAPI with Gunicorn..."
exec gunicorn app.main:app \
  --workers 2 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT:-10000}" \
  --timeout 120 \
  --keep-alive 5 \
  --log-level info