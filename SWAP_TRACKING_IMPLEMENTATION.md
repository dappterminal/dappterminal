# Swap & Bridge Transaction Tracking System

## Overview

This document describes the volume and traffic tracking system implemented for DappTerminal. The system tracks all swap and bridge transactions across protocols, recording detailed transaction data and aggregating statistics for analytics.

## Architecture

### Database Schema

The system uses three main Prisma models:

#### 1. SwapTransaction
Tracks individual transactions with the following data:
- **Transaction details**: txHash, chainId, blockNumber, status
- **Protocol info**: protocol name, command type, transaction type (swap/bridge)
- **User info**: wallet address
- **Swap details**: tokenIn, tokenOut, amountIn, amountOut
- **Gas metrics**: gasUsed, gasPrice (optional)
- **Route info**: JSON data for multi-hop swaps (optional)
- **Timestamps**: createdAt, confirmedAt, failedAt

#### 2. ProtocolVolume
Aggregates daily volume statistics per protocol and chain:
- **Dimensions**: date, protocol, chainId
- **Metrics**: totalTransactions, successfulTxs, failedTxs, uniqueUsers
- **Volume**: totalVolumeIn, totalVolumeOut (stored as strings for precision)
- Auto-updated via upsert on each transaction

#### 3. UserSwapActivity
Tracks user-specific activity per protocol and chain:
- **Identity**: walletAddress, protocol, chainId
- **Stats**: totalSwaps, totalBridges, totalVolumeIn
- **Timestamps**: firstTxAt, lastTxAt
- Provides quick user activity lookups

### Tracking Service

Location: `/src/lib/tracking/swaps.ts`

Key functions:
- `trackSwapTransaction()` - Records transactions and updates aggregates
- `updateProtocolVolume()` - Upserts daily volume statistics
- `updateUserActivity()` - Updates user-specific metrics
- `getUserTransactionHistory()` - Retrieves paginated user history
- `getProtocolVolumeStats()` - Gets protocol volume data
- `getGlobalStats()` - Returns platform-wide statistics

### Protocol Integration

Tracking is integrated into the following protocol handlers:

#### Uniswap V4 (`src/plugins/uniswap-v4/handlers.ts`)
- **Single-hop swaps**: Line 287-299
- **Multi-hop swaps**: Line 607-620
- Captures route information for multi-hop transactions

#### 1inch (`src/plugins/1inch/handlers.ts`)
- **Swaps**: Line 149-162
- Includes gas metrics and DEX aggregator info

#### LiFi (`src/plugins/lifi/handlers.ts`)
- **Bridge transactions**: Line 168-190
- Tracks cross-chain bridges with route metadata

#### Stargate (`src/plugins/stargate/handlers.ts`)
- **Bridge transactions**: Line 125-147
- Records multi-step bridge flows

#### Wormhole (`src/plugins/wormhole/handlers.ts`)
- **Bridge transactions**: Line 299-320
- Includes route type and ETA information

### API Endpoints

#### 1. User Transaction History
`GET /api/analytics/user-history`

Query parameters:
- `walletAddress` (required)
- `protocol` (optional)
- `chainId` (optional)
- `txType` (optional): "swap" or "bridge"
- `limit` (optional, max 100)
- `offset` (optional)

Returns paginated transaction history for a wallet.

#### 2. Protocol Volume Statistics
`GET /api/analytics/protocol-volume`

Query parameters:
- `protocol` (optional)
- `chainId` (optional)
- `startDate` (optional, ISO format)
- `endDate` (optional, ISO format)

Returns aggregated volume data with breakdowns by protocol.

#### 3. Global Statistics
`GET /api/analytics/global-stats`

No parameters required.

Returns platform-wide metrics:
- Total transaction count
- Unique users
- Recent activity (24h)

## Data Flow

### Transaction Recording

1. **Transaction Submission**: User executes swap/bridge via protocol handler
2. **Tracking Call**: Handler calls `trackSwapTransaction()` after successful submission
3. **Database Write**: Transaction record created in `swap_transactions` table
4. **Aggregate Update**: Two parallel updates occur:
   - Protocol volume statistics updated/created
   - User activity statistics updated/created

### Error Handling

- All tracking calls are wrapped in `.catch()` blocks
- Tracking failures are logged but don't affect user transactions
- This ensures tracking never breaks the swap/bridge flow

## Usage Examples

### Query User History

```typescript
// Fetch last 50 swaps for a user
const response = await fetch(
  '/api/analytics/user-history?walletAddress=0x123...&limit=50'
)
const { data } = await response.json()
```

### Query Protocol Volume

```typescript
// Get Uniswap V4 volume for last 7 days
const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const response = await fetch(
  `/api/analytics/protocol-volume?protocol=uniswap-v4&startDate=${startDate}`
)
const { data } = await response.json()
```

### Query Global Stats

```typescript
// Get platform statistics
const response = await fetch('/api/analytics/global-stats')
const { data } = await response.json()
console.log(`Total transactions: ${data.totalTransactions}`)
console.log(`Unique users: ${data.totalUsers}`)
console.log(`Last 24h activity: ${data.recentActivity}`)
```

## Database Indexes

The following indexes are created for optimal query performance:

### SwapTransaction
- `walletAddress, createdAt` - User history queries
- `protocol, createdAt` - Protocol filtering
- `chainId, createdAt` - Chain filtering
- `txHash` - Transaction lookups
- `status, createdAt` - Status filtering
- `txType, createdAt` - Type filtering

### ProtocolVolume
- `protocol, date` - Protocol time series
- `chainId, date` - Chain time series
- `date` - Global time series
- `date, protocol, chainId` (unique) - Upsert operations

### UserSwapActivity
- `walletAddress` - User lookups
- `lastTxAt` - Recent activity queries
- `walletAddress, protocol, chainId` (unique) - Upsert operations

## Implementation Notes

### Volume Storage
- All amounts stored as strings to preserve precision (BigInt values)
- USD conversion requires price oracle integration (future enhancement)

### Transaction Status
- Currently tracks submission status only ("pending")
- Future enhancement: background job to monitor confirmations

### Unique User Counts
- ProtocolVolume.uniqueUsers is approximate
- Accurate counts require periodic batch recalculation
- Consider implementing aggregation job for precise metrics

## Future Enhancements

1. **Transaction Monitoring**
   - Background job to update transaction status
   - Track confirmations and failures on-chain

2. **Price Oracle Integration**
   - Convert amounts to USD for volume calculations
   - Track price impact and slippage

3. **Advanced Analytics**
   - Gas cost analysis
   - Popular trading pairs
   - Peak usage times
   - User retention metrics

4. **Export Functionality**
   - CSV/JSON export for transaction history
   - Tax reporting integration

5. **Real-time Updates**
   - WebSocket support for live transaction feeds
   - Real-time volume updates

## Testing

To test the tracking system:

1. Execute a swap via Uniswap V4 or 1inch
2. Query user history: `GET /api/analytics/user-history?walletAddress=<your-address>`
3. Verify transaction appears in results
4. Check protocol volume: `GET /api/analytics/protocol-volume?protocol=uniswap-v4`
5. Verify global stats: `GET /api/analytics/global-stats`

## Maintenance

### Database Cleanup
Consider implementing periodic cleanup for:
- Old pending transactions (>7 days)
- Archived transaction data (>1 year)

### Performance Monitoring
Monitor query performance for:
- User history queries with large result sets
- Protocol volume aggregations over long time periods
- Global stats calculations

### Data Integrity
Periodically verify:
- Unique user counts accuracy
- Volume totals consistency
- No duplicate transaction records
