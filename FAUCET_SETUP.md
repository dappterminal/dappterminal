# Faucet System Setup Guide

This guide will walk you through setting up the testnet faucet system for the DeFi Terminal.

## Prerequisites

- Node.js 18+ and pnpm installed
- PostgreSQL 14+ installed and running
- Testnet wallet with some ETH on Sepolia, Holesky, and/or Optimism Sepolia

## Quick Start

### 1. Install Dependencies

```bash
# Install all project dependencies
pnpm install
```

This will install:
- `@prisma/client` - Prisma database client
- `prisma` - Prisma CLI (dev dependency)
- `tsx` - TypeScript execution (for seed script)

### 2. Set Up PostgreSQL Database

```bash
# Create the database
createdb defi_terminal

# Or using psql:
psql -U postgres -c "CREATE DATABASE defi_terminal;"
```

### 3. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and configure the faucet settings:

```bash
# ============================================================================
# DATABASE
# ============================================================================
POSTGRES_URL="postgresql://postgres:your_password@localhost:5432/defi_terminal"

# ============================================================================
# FAUCET WALLET
# ============================================================================
# Generate a new wallet or use an existing testnet wallet
# IMPORTANT: Only use wallets funded with testnet ETH!
FAUCET_WALLET_PRIVATE_KEY="0xYOUR_PRIVATE_KEY_HERE"

# ============================================================================
# RPC ENDPOINTS (Optional - defaults provided)
# ============================================================================
FAUCET_SEPOLIA_RPC="https://rpc.sepolia.org"
FAUCET_HOLESKY_RPC="https://rpc.holesky.ethpandaops.io"
FAUCET_OPTIMISM_SEPOLIA_RPC="https://sepolia.optimism.io"

# ============================================================================
# DISTRIBUTION AMOUNTS (Optional - defaults: 0.5, 1.0, 0.3)
# ============================================================================
FAUCET_SEPOLIA_AMOUNT="0.5"
FAUCET_HOLESKY_AMOUNT="1.0"
FAUCET_OPTIMISM_SEPOLIA_AMOUNT="0.3"

# ============================================================================
# RATE LIMITS (Optional - defaults shown)
# ============================================================================
FAUCET_ADDRESS_COOLDOWN=24  # hours between requests per address
FAUCET_IP_HOURLY_LIMIT=5    # requests per hour from same IP
FAUCET_IP_DAILY_LIMIT=10    # requests per day from same IP
```

### 4. Generate a Faucet Wallet

If you don't have a testnet wallet, generate one:

```javascript
// Run this in a Node.js REPL or create a script
const { Wallet } = require('ethers')
const wallet = Wallet.createRandom()

console.log('Address:', wallet.address)
console.log('Private Key:', wallet.privateKey)
```

**Important**:
- Only use this wallet for testnets
- Fund it with testnet ETH from public faucets
- Never use mainnet private keys

### 5. Fund Your Faucet Wallet

Get testnet ETH from these public faucets:

**Sepolia:**
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://faucet.quicknode.com/ethereum/sepolia

**Holesky:**
- https://faucet.quicknode.com/ethereum/holesky
- https://holesky-faucet.pk910.de/

**Optimism Sepolia:**
- https://www.alchemy.com/faucets/optimism-sepolia
- https://app.optimism.io/faucet (requires Sepolia ETH first)

Recommended balances:
- Sepolia: 2-5 ETH
- Holesky: 5-10 ETH
- Optimism Sepolia: 1-2 ETH

### 6. Initialize Database

```bash
# Generate Prisma client
pnpm db:generate

# Create database tables
pnpm db:push
# Or create a migration (recommended for production):
# pnpm db:migrate

# Seed initial configuration
pnpm db:seed
```

Expected output:
```
🌱 Seeding database...

📝 Creating faucet configurations...
  ✓ Sepolia Testnet (sepolia) configured
  ✓ Holesky Testnet (holesky) configured
  ✓ Optimism Sepolia (optimism-sepolia) configured

📊 Creating initial audit log...
  ✓ Audit log created

✅ Seeding completed successfully!
```

### 7. Verify Setup

Start the development server:

```bash
pnpm dev
```

Test the faucet API:

```bash
# Check faucet configuration
curl http://localhost:3000/api/faucet/config

# Should return supported networks and rate limits
```

### 8. Test the Commands

In the DeFi Terminal CLI:

```bash
# Request tokens for your connected wallet
request sepolia

# Request tokens for a specific address
request holesky 0x1234567890123456789012345678901234567890

# Check request status
faucet:status <requestId>

# View your request history
faucet:history

# View history for a specific address
faucet:history 0x1234...
```

## Database Management

### View Database

Use Prisma Studio for a visual interface:

```bash
pnpm db:studio
```

Opens at `http://localhost:5555`

### Manual Database Queries

```bash
# Connect to database
psql -U postgres -d defi_terminal

# View faucet requests
SELECT * FROM faucet_requests ORDER BY created_at DESC LIMIT 10;

# View faucet configuration
SELECT * FROM faucet_configs;

# Check audit logs
SELECT * FROM faucet_audit_logs ORDER BY created_at DESC LIMIT 20;

# View rate limit records
SELECT * FROM rate_limit_records WHERE window_end > NOW();
```

### Reset Database

If you need to start fresh:

```bash
# Drop all tables
pnpm db:push --force-reset

# Re-seed
pnpm db:seed
```

## Monitoring

### Check Faucet Wallet Balance

Create a script or use the CLI:

```javascript
import { checkFaucetBalance } from '@/lib/faucet/wallet'

const networks = ['sepolia', 'holesky', 'optimism-sepolia']

for (const network of networks) {
  const { balanceFormatted, isLow } = await checkFaucetBalance(network)
  console.log(`${network}: ${balanceFormatted} ETH ${isLow ? '⚠️  LOW' : '✅'}`)
}
```

### View Statistics

```javascript
import { getFaucetStatistics } from '@/lib/faucet/transaction'

const stats = await getFaucetStatistics()
console.log('Faucet Statistics:', stats)
// {
//   totalRequests: 150,
//   completedRequests: 145,
//   failedRequests: 3,
//   pendingRequests: 2,
//   last24Hours: 42,
//   successRate: 96.67
// }
```

### Cleanup Expired Records

Run periodically (e.g., via cron):

```javascript
import { cleanupExpiredRateLimits } from '@/lib/faucet/rate-limit-db'

const deletedCount = await cleanupExpiredRateLimits()
console.log(`Cleaned up ${deletedCount} expired rate limit records`)
```

## Troubleshooting

### "Faucet wallet private key not configured"

**Problem**: The `FAUCET_WALLET_PRIVATE_KEY` environment variable is not set or invalid.

**Solution**:
1. Check that `.env` file exists
2. Verify the private key starts with `0x`
3. Restart the dev server after changing `.env`

### "Insufficient faucet balance"

**Problem**: The faucet wallet doesn't have enough ETH.

**Solution**:
1. Check wallet balance using blockchain explorer
2. Fund the wallet using public faucets (see step 5)
3. Ensure you're checking the correct network

### "Database connection failed"

**Problem**: Cannot connect to PostgreSQL.

**Solution**:
1. Verify PostgreSQL is running: `pg_isready`
2. Check `POSTGRES_URL` in `.env`
3. Verify database exists: `psql -l | grep defi_terminal`
4. Test connection: `psql $POSTGRES_URL`

### "Rate limit not working"

**Problem**: Rate limits aren't being enforced.

**Solution**:
1. Verify database is seeded: `psql -d defi_terminal -c "SELECT * FROM faucet_configs;"`
2. Check Prisma client is generated: `pnpm db:generate`
3. Ensure tables exist: `pnpm db:push`
4. Review audit logs for errors: `SELECT * FROM faucet_audit_logs WHERE severity = 'error';`

### "Commands not available"

**Problem**: Faucet commands don't show in `help`.

**Solution**:
1. Verify imports in `/src/core/commands.ts`
2. Check the `coreCommands` array includes faucet commands
3. Restart dev server
4. Clear Next.js cache: `rm -rf .next && pnpm dev`

### "Transaction failed: gas estimation failed"

**Problem**: Cannot estimate gas for transaction.

**Solution**:
1. Verify RPC endpoint is working: `curl $FAUCET_SEPOLIA_RPC -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`
2. Try alternative RPC endpoint
3. Check network isn't experiencing issues
4. Verify recipient address is valid

### "Prisma Client not found"

**Problem**: Prisma client hasn't been generated.

**Solution**:
```bash
pnpm db:generate
```

## Production Deployment

### Security Considerations

1. **Private Key Management**:
   ```bash
   # Use environment variables or secrets manager
   # AWS: AWS Secrets Manager
   # GCP: Google Secret Manager
   # Azure: Azure Key Vault
   ```

2. **Database**:
   ```bash
   # Use managed database service
   # Enable SSL connections
   # Set up regular backups
   # Configure connection pooling
   ```

3. **Rate Limiting**:
   ```bash
   # Consider Redis for distributed rate limiting
   # Add CAPTCHA for additional bot protection
   # Implement IP reputation checking
   ```

4. **Monitoring**:
   ```bash
   # Set up alerts for low wallet balances
   # Monitor failed transaction rates
   # Track database performance
   # Log all requests to SIEM
   ```

### Environment Variables for Production

```bash
NODE_ENV=production
POSTGRES_URL="postgresql://user:pass@prod-db:5432/defi_terminal?sslmode=require"
FAUCET_WALLET_PRIVATE_KEY="Use KMS or secrets manager"
CLIENT_API_KEY="Strong random key for API authentication"
```

### Database Migration

```bash
# Create migration
pnpm db:migrate

# Deploy to production
POSTGRES_URL="postgres://..." pnpm db:migrate deploy
```

### Scaling Considerations

- **Horizontal Scaling**: Ensure database supports connection pooling
- **Caching**: Consider Redis for config and frequently accessed data
- **Queue System**: Implement job queue for high traffic (Bull, BullMQ)
- **Load Balancing**: Distribute requests across multiple instances

## API Reference

### POST /api/faucet/request
Request testnet tokens.

**Body**:
```json
{
  "address": "0x...",
  "network": "sepolia"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "requestId": "req_abc123",
    "txHash": "0x...",
    "status": "completed",
    "network": "sepolia",
    "address": "0x...",
    "message": "Tokens sent successfully!"
  }
}
```

### GET /api/faucet/status
Check request status.

**Query**: `?requestId=xxx` or `?txHash=xxx` or `?address=xxx&network=yyy`

### GET /api/faucet/history
Get request history.

**Query**: `?address=xxx&network=yyy&limit=10&offset=0`

### GET /api/faucet/config
Get faucet configuration (public endpoint).

## Support

For issues:
1. Check logs: Audit logs in database
2. Verify configuration: `.env` file
3. Test wallet: Balance and connectivity
4. Review documentation: `/src/plugins/faucet/ARCHITECTURE.md`

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Viem Documentation](https://viem.sh/)
- [Sepolia Faucets](https://sepoliafaucet.com/)
- [Holesky Faucets](https://faucet.quicknode.com/ethereum/holesky)
