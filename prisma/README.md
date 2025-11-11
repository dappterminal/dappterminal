# Database Deployment Guide

This directory contains the Prisma schema and deployment scripts for the faucet system.

## Quick Deploy (Railway)

### Option 1: Using Railway's Database Console (Easiest)

1. Open your Railway project dashboard
2. Click on your PostgreSQL service
3. Go to the "Data" or "Query" tab
4. Copy and paste the contents of `manual-deploy.sql`
5. Click "Execute" or "Run"

✅ This will create all tables, indexes, and seed initial data.

### Option 2: Using psql (from Railway CLI)

```bash
# Connect to Railway database
railway link
railway run psql $POSTGRES_URL

# In psql, run the deployment script
\i prisma/manual-deploy.sql
```

### Option 3: Using Prisma (when deployed on Railway)

```bash
# This will work once your app is deployed on Railway
# and can access POSTGRES_URL internally

railway run pnpm prisma generate
railway run pnpm prisma db push
railway run pnpm db:seed
```

## Local Development

If you want to develop locally with a local PostgreSQL:

```bash
# 1. Create local database
createdb defi_terminal_dev

# 2. Update .env with local database
POSTGRES_URL="postgresql://postgres:password@localhost:5432/defi_terminal_dev"

# 3. Generate Prisma client
pnpm prisma generate

# 4. Push schema to database
pnpm prisma db push

# 5. Seed initial data
pnpm db:seed

# 6. Open Prisma Studio to view data
pnpm db:studio
```

## Schema Overview

### Tables

1. **faucet_requests** - Tracks all token requests
   - Fields: id, address, ipAddress, network, chainId, amount, txHash, status, errorMessage, timestamps
   - Indexes: address+network, ipAddress, txHash, status

2. **rate_limit_records** - Rate limiting enforcement
   - Fields: id, identifier, identifierType, network, requestCount, windowStart, windowEnd, timestamps
   - Indexes: identifier+network+windowEnd, unique constraint on identifier+type+network+windowStart

3. **faucet_configs** - Per-network configuration
   - Fields: id, network, chainId, amount, enabled, cooldownPeriod, displayName, symbol, rpcUrl, minBalance, timestamps
   - Indexes: unique network, unique chainId

4. **faucet_audit_logs** - Comprehensive audit trail
   - Fields: id, eventType, severity, requestId, address, network, message, metadata (JSONB), createdAt
   - Indexes: eventType, severity, requestId, address

### Initial Data (Seeded)

The database is seeded with configuration for three testnets:
- **Sepolia** (Chain ID: 11155111) - 0.5 ETH per request
- **Holesky** (Chain ID: 17000) - 1.0 ETH per request
- **Optimism Sepolia** (Chain ID: 11155420) - 0.3 ETH per request

## Verifying Deployment

After deployment, verify tables were created:

```sql
-- Check tables exist
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'faucet%';

-- Check initial configuration
SELECT network, displayName, chainId, amount, enabled
FROM faucet_configs;

-- Check audit log
SELECT * FROM faucet_audit_logs;
```

Expected output:
- 4 tables (faucet_requests, rate_limit_records, faucet_configs, faucet_audit_logs)
- 3 config rows (sepolia, holesky, optimism-sepolia)
- 1 audit log entry (system_init)

## Migrations

### Creating a Migration

```bash
# When you make schema changes in schema.prisma
pnpm prisma migrate dev --name your_migration_name
```

This creates a new migration file in `migrations/`.

### Applying Migrations (Production)

```bash
# On Railway or production environment
railway run pnpm prisma migrate deploy
```

## Troubleshooting

### "Can't reach database server at postgres.railway.internal"

This is expected if running locally. The internal Railway URL only works within Railway's network.

**Solutions:**
- Use the manual SQL script in Railway's console
- Deploy the app to Railway and run the migration there
- For local dev, use a local PostgreSQL instance

### "Relation already exists"

The tables were already created.

**Solutions:**
- Drop tables: `DROP TABLE faucet_requests, rate_limit_records, faucet_configs, faucet_audit_logs CASCADE;`
- Or use `--force-reset` flag (WARNING: deletes all data)

### "POSTGRES_URL is not defined"

**Solutions:**
- Check `.env` file exists and has `POSTGRES_URL`
- Ensure Railway environment variables are set
- Try: `railway run env` to see available variables

## Backup & Restore

### Backup

```bash
# Using pg_dump
pg_dump $POSTGRES_URL > faucet_backup.sql

# Or via Railway CLI
railway run pg_dump $POSTGRES_URL > faucet_backup.sql
```

### Restore

```bash
# Using psql
psql $POSTGRES_URL < faucet_backup.sql

# Or via Railway CLI
railway run psql $POSTGRES_URL < faucet_backup.sql
```

## Monitoring

### View Recent Requests

```sql
SELECT
    address,
    network,
    status,
    txHash,
    "createdAt"
FROM faucet_requests
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Check Rate Limits

```sql
SELECT
    identifier,
    "identifierType",
    network,
    "requestCount",
    "windowEnd"
FROM rate_limit_records
WHERE "windowEnd" > NOW()
ORDER BY "lastRequest" DESC;
```

### View Audit Logs

```sql
SELECT
    "eventType",
    severity,
    message,
    "createdAt"
FROM faucet_audit_logs
ORDER BY "createdAt" DESC
LIMIT 20;
```

### Database Stats

```sql
SELECT
    'Total Requests' as metric,
    COUNT(*) as count
FROM faucet_requests
UNION ALL
SELECT
    'Completed Requests',
    COUNT(*)
FROM faucet_requests
WHERE status = 'completed'
UNION ALL
SELECT
    'Failed Requests',
    COUNT(*)
FROM faucet_requests
WHERE status = 'failed'
UNION ALL
SELECT
    'Last 24 Hours',
    COUNT(*)
FROM faucet_requests
WHERE "createdAt" > NOW() - INTERVAL '24 hours';
```

## Maintenance

### Clean Up Old Rate Limits

```sql
-- Delete rate limit records older than 7 days
DELETE FROM rate_limit_records
WHERE "windowEnd" < NOW() - INTERVAL '7 days';
```

### Archive Old Requests

```sql
-- Create archive table (run once)
CREATE TABLE faucet_requests_archive (LIKE faucet_requests INCLUDING ALL);

-- Move old requests (older than 90 days)
INSERT INTO faucet_requests_archive
SELECT * FROM faucet_requests
WHERE "createdAt" < NOW() - INTERVAL '90 days';

DELETE FROM faucet_requests
WHERE "createdAt" < NOW() - INTERVAL '90 days';
```

## Useful Commands

```bash
# Generate Prisma client (after schema changes)
pnpm prisma generate

# Push schema changes (dev)
pnpm prisma db push

# Create migration (for version control)
pnpm prisma migrate dev

# Apply migrations (production)
pnpm prisma migrate deploy

# Seed database
pnpm db:seed

# Open Prisma Studio (visual database browser)
pnpm db:studio

# View database schema
pnpm prisma db pull

# Reset database (WARNING: deletes all data)
pnpm prisma db push --force-reset
```

## Support

If you encounter issues:
1. Check Railway logs for connection errors
2. Verify POSTGRES_URL is correctly set
3. Try the manual SQL script in Railway's console
4. Check database permissions
5. Review error messages in audit logs
