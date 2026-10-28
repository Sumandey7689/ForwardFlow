#!/bin/sh
set -e

echo "[ForwardFlow] Waiting for MySQL database to be ready..."
MAX_TRIES=15
COUNT=0
until npx prisma db push --skip-generate || [ $COUNT -eq $MAX_TRIES ]; do
  echo "[ForwardFlow] Database not ready yet, retrying in 2s ($COUNT/$MAX_TRIES)..."
  COUNT=$((COUNT + 1))
  sleep 2
done

if [ $COUNT -eq $MAX_TRIES ]; then
  echo "[ForwardFlow] Error: Database could not be reached after $MAX_TRIES attempts."
  exit 1
fi

echo "[ForwardFlow] Schema synchronized successfully."
echo "[ForwardFlow] Ensuring default admin account exists..."
node dist/scripts/setupAdmin.js || true

echo "[ForwardFlow] Starting ForwardFlow application..."
exec "$@"
