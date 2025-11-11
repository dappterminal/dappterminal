#!/bin/bash
# Deploy Faucet Database Schema
# This script should be run on Railway or wherever POSTGRES_URL is accessible

set -e

echo "🚀 Deploying Faucet Database Schema..."

# Check if POSTGRES_URL is set
if [ -z "$POSTGRES_URL" ]; then
    echo "❌ Error: POSTGRES_URL environment variable is not set"
    exit 1
fi

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo "🔧 Generating Prisma client..."
pnpm prisma generate

echo "📊 Pushing database schema..."
pnpm prisma db push --skip-generate

echo "🌱 Seeding database..."
pnpm db:seed

echo "✅ Database deployment complete!"
echo ""
echo "To verify, run: pnpm prisma studio"
