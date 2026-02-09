#!/bin/sh
set -e

echo "Running migrations..."
node dist/scripts/migrate.js

echo "Running seed..."
node dist/scripts/seed.js

echo "Release complete."
