#!/bin/sh
set -e

echo "🔄 Running Prisma db push..."
cd /app/packages/db
npx prisma db push --skip-generate 2>&1 || echo "⚠️ Prisma db push failed, continuing..."

echo "🚀 Starting server..."
cd /app/apps/server
exec node dist/index.js
