# Faucet Plugin Architecture

## Overview

The Faucet Plugin provides automated testnet token distribution with multi-layer rate limiting, database-backed request tracking, and comprehensive audit logging.

## Supported Networks

- **Sepolia** (Chain ID: 11155111) - 0.5 ETH per request
- **Holesky** (Chain ID: 17000) - 1.0 ETH per request
- **Optimism Sepolia** (Chain ID: 11155420) - 0.3 ETH per request

## Architecture Components

### 1. Database Layer (Prisma)

#### Models

**FaucetRequest**
- Tracks all token requests
- Stores: address, network, amount, txHash, status
- Indexed for efficient queries by address, IP, and status

**RateLimitRecord**
- Manages rate limiting windows
- Supports per-address and per-IP limits
- Auto-cleanup of expired records

**FaucetConfig**
- Per-network configuration
- Amounts, cooldowns, RPC URLs
- Enable/disable networks dynamically

**FaucetAuditLog**
- Complete audit trail
- Event types: request_created, transaction_sent, error, etc.
- Structured metadata for debugging

### 2. Services Layer

#### Wallet Service (`/src/lib/faucet/wallet.ts`)
- Backend wallet management using viem
- Private key loaded from environment
- Balance checking and monitoring
- Transaction signing and sending
- Per-network wallet clients

#### Transaction Service (`/src/lib/faucet/transaction.ts`)
- Coordinates database + blockchain operations
- Full request lifecycle management:
  1. Create DB record (pending)
  2. Update to processing
  3. Send transaction
  4. Update with txHash (completed/failed)
- Comprehensive error handling
- Transaction verification

#### Rate Limit Service (`/src/lib/faucet/rate-limit-db.ts`)
- Database-backed rate limiting (persistent)
- Three enforcement layers:
  1. **Per-Address**: 24h cooldown per network
  2. **Per-IP (Hourly)**: 5 requests per hour
  3. **Per-IP (Daily)**: 10 requests per day
- Prevents Sybil attacks
- Cleanup utilities for expired records

#### Configuration Service (`/src/lib/faucet/config.ts`)
- Centralized network configuration
- Environment variable loading
- Validation utilities
- Network/chainId mapping

### 3. API Layer

#### POST `/api/faucet/request`
**Purpose**: Request testnet tokens

**Request**:
```json
{
  "address": "0x...",
  "network": "sepolia"
}
```

**Flow**:
1. Authenticate request
2. Validate address format
3. Validate network support
4. Check rate limits (address + IP)
5. Process transaction
6. Return result with txHash

**Rate Limit Response** (429):
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "resetTime": "2024-01-01T00:00:00.000Z"
}
```

#### GET `/api/faucet/status`
**Purpose**: Check request status

**Query Params**: `requestId` OR `txHash` OR `address` (+ optional `network`)

**Response**:
```json
{
  "success": true,
  "data": {
    "requestId": "...",
    "address": "0x...",
    "network": "sepolia",
    "txHash": "0x...",
    "txUrl": "https://sepolia.etherscan.io/tx/0x...",
    "status": "completed",
    "createdAt": "...",
    "completedAt": "..."
  }
}
```

#### GET `/api/faucet/history`
**Purpose**: Get request history

**Query Params**: `address` (required), `network` (optional), `limit`, `offset`

**Response**:
```json
{
  "success": true,
  "data": {
    "requests": [...],
    "pagination": {
      "total": 10,
      "limit": 10,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

#### GET `/api/faucet/config`
**Purpose**: Get faucet configuration (public)

**Response**: Supported networks, amounts, rate limits, API documentation

### 4. Command Layer

#### `request <network> [address]`
- Request testnet tokens
- Defaults to connected wallet if no address provided
- Aliases: `faucet`

**Examples**:
```bash
request sepolia
request holesky 0x1234...
faucet optimism-sepolia
```

#### `faucet:status <requestId|txHash>`
- Check request status
- Accepts either request ID or transaction hash

**Examples**:
```bash
faucet:status req_abc123
faucet:status 0x789def...
```

#### `faucet:history [address] [network]`
- View request history
- Defaults to connected wallet
- Optional network filter

**Examples**:
```bash
faucet:history
faucet:history 0x1234...
faucet:history 0x1234... sepolia
```

## Rate Limiting Strategy

### Multi-Layer Protection

1. **Per-Address Cooldown**
   - 1 request per 24 hours per network
   - Prevents single address abuse
   - Network-specific (can request Sepolia + Holesky separately)

2. **Per-IP Hourly Limit**
   - 5 requests per hour from same IP
   - Prevents rapid automated requests
   - Configurable via `FAUCET_IP_HOURLY_LIMIT`

3. **Per-IP Daily Limit**
   - 10 requests per day from same IP
   - Prevents Sybil attacks (multiple addresses)
   - Configurable via `FAUCET_IP_DAILY_LIMIT`

### Rate Limit Checking Flow

```
Request → Check Address (24h) → Check IP (1h) → Check IP (24h) → Allow
            ↓                      ↓                ↓
          Deny (429)            Deny (429)       Deny (429)
```

## Security Considerations

### Private Key Management
- **Development**: Store in `.env` (never commit)
- **Production**: Use KMS (AWS KMS, Google Cloud KMS, HashiCorp Vault)
- Only use testnet wallets with limited funds

### Input Validation
- Address format validation (checksum)
- Network whitelist enforcement
- Amount limits enforced server-side
- SQL injection protection (Prisma parameterized queries)

### Rate Limiting
- Database-backed (persists across restarts)
- IP-based + address-based (dual layer)
- Configurable limits per environment

### Audit Logging
- All requests logged with metadata
- IP addresses recorded (privacy consideration)
- Error tracking for debugging
- Event-based logging (create, send, confirm, error)

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/defi_terminal

# Wallet
FAUCET_WALLET_PRIVATE_KEY=0x...

# RPC URLs
FAUCET_SEPOLIA_RPC=https://rpc.sepolia.org
FAUCET_HOLESKY_RPC=https://rpc.holesky.ethpandaops.io
FAUCET_OPTIMISM_SEPOLIA_RPC=https://sepolia.optimism.io

# Amounts (in ETH)
FAUCET_SEPOLIA_AMOUNT=0.5
FAUCET_HOLESKY_AMOUNT=1.0
FAUCET_OPTIMISM_SEPOLIA_AMOUNT=0.3

# Rate Limits
FAUCET_ADDRESS_COOLDOWN=24  # hours
FAUCET_IP_HOURLY_LIMIT=5
FAUCET_IP_DAILY_LIMIT=10
```

### Per-Network Configuration

Amounts, cooldowns, and RPC URLs can be customized per network in `/src/lib/faucet/config.ts` or via environment variables.

## Database Schema

### Migrations

```bash
# Create migration
pnpm db:migrate

# Generate Prisma client
pnpm db:generate

# Seed initial data
pnpm db:seed
```

### Indexes

Optimized for common queries:
- `faucet_requests(address, network, createdAt)`
- `faucet_requests(ipAddress, createdAt)`
- `faucet_requests(txHash)`
- `faucet_requests(status, createdAt)`
- `rate_limit_records(identifier, network, windowEnd)`

## Error Handling

### Common Errors

**Insufficient Balance**
```
Faucet wallet has insufficient funds for {network}.
Please contact the administrator.
```

**Rate Limited (Address)**
```
Address has already requested {network} tokens recently.
Please wait until {resetTime}.
```

**Rate Limited (IP)**
```
Too many requests from your IP address.
Hourly limit: 5 requests. Resets at {resetTime}.
```

**Invalid Network**
```
Network "{network}" is not supported.
Supported networks: sepolia, holesky, optimism-sepolia
```

**Transaction Failed**
```
Failed to send transaction: {error}
Request ID: {requestId}
```

## Monitoring & Maintenance

### Health Checks

```typescript
// Plugin health check
GET /api/faucet/config

// Wallet balance check
import { checkFaucetBalance } from '@/lib/faucet/wallet'
const { balance, isLow } = await checkFaucetBalance('sepolia')
```

### Statistics

```typescript
import { getFaucetStatistics } from '@/lib/faucet/transaction'
const stats = await getFaucetStatistics()
// Returns: totalRequests, completedRequests, failedRequests,
//          pendingRequests, last24Hours, successRate
```

### Cleanup Tasks

```typescript
// Clean up expired rate limit records (run via cron)
import { cleanupExpiredRateLimits } from '@/lib/faucet/rate-limit-db'
const deletedCount = await cleanupExpiredRateLimits()
```

### Wallet Monitoring

Monitor faucet wallet balances and alert when low:
- Sepolia: Alert below 1 ETH
- Holesky: Alert below 2 ETH
- Optimism Sepolia: Alert below 0.5 ETH

## Testing

### Manual Testing

1. **Request tokens**:
   ```bash
   request sepolia 0xYourTestAddress
   ```

2. **Check status**:
   ```bash
   faucet:status {requestId from step 1}
   ```

3. **View history**:
   ```bash
   faucet:history 0xYourTestAddress
   ```

4. **Test rate limiting**:
   - Make multiple requests rapidly
   - Verify 429 responses with resetTime
   - Wait for cooldown and retry

### API Testing

```bash
# Request tokens
curl -X POST http://localhost:3000/api/faucet/request \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_key" \
  -d '{"address":"0x...","network":"sepolia"}'

# Check status
curl http://localhost:3000/api/faucet/status?requestId=req_xxx \
  -H "x-api-key: your_key"

# Get history
curl http://localhost:3000/api/faucet/history?address=0x... \
  -H "x-api-key: your_key"

# Get config (public)
curl http://localhost:3000/api/faucet/config
```

## Future Enhancements

### Potential Improvements

1. **CAPTCHA Integration**
   - Prevent bot abuse
   - reCAPTCHA or hCaptcha

2. **OAuth/Social Login**
   - GitHub/Twitter verification
   - Increase limits for verified users

3. **Tiered Limits**
   - Higher limits for trusted users
   - Reputation-based distribution

4. **Multi-Token Support**
   - Distribute ERC20 test tokens
   - USDC, USDT testnet versions

5. **Queue System**
   - Handle high traffic
   - Background job processing

6. **Email Notifications**
   - Transaction confirmation emails
   - Balance alerts for admin

7. **Admin Dashboard**
   - Monitor usage statistics
   - Manage network configuration
   - View audit logs

8. **WebSocket Updates**
   - Real-time transaction status
   - Push notifications to frontend

## Troubleshooting

### Common Issues

**"Faucet wallet private key not configured"**
- Check `FAUCET_WALLET_PRIVATE_KEY` in `.env`
- Ensure it starts with `0x`

**"Database connection failed"**
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check database exists

**"Transaction failed: insufficient funds"**
- Faucet wallet needs more testnet ETH
- Check balance: `checkFaucetBalance('network')`

**"Rate limit errors not working"**
- Verify database is seeded
- Check Prisma client is generated
- Ensure tables are created

**Commands not showing in help**
- Verify commands are imported in `/src/core/commands.ts`
- Check `coreCommands` array includes faucet commands
- Restart dev server

## Support

For issues or questions:
1. Check the audit logs: `FaucetAuditLog` table
2. Review error messages in request records
3. Monitor faucet wallet balances
4. Check RPC endpoint health
