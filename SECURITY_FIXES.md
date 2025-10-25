# Security & Production Audit Fixes

This document details the security and production improvements implemented based on the production audit report.

## Critical Issues - FIXED ✅

### 1. API Route Authentication & Rate Limiting

**Problem**: API routes (`eth_rpc`, `lifi/routes`, `gas`) forwarded API-keyed traffic without authentication or throttling, allowing any browser to drain quotas or incur costs.

**Solution**:
- Created `src/lib/auth.ts` - API key-based authentication system
- Created `src/lib/rate-limit.ts` - In-memory rate limiting with configurable presets
- Applied authentication and rate limiting to all sensitive API routes:
  - `src/app/api/1inch/eth_rpc/route.ts`
  - `src/app/api/lifi/routes/route.ts`
  - `src/app/api/1inch/gas/route.ts`

**Configuration**:
- Set `CLIENT_API_KEY` environment variable for production
- Development mode allows localhost without API key
- Rate limits: STRICT (10/min), MODERATE (30/min), RELAXED (100/min)

### 2. RPC Method Allowlist

**Problem**: `eth_rpc` route allowed arbitrary RPC methods including dangerous ones like `sendRawTransaction`.

**Solution**:
- Implemented explicit allowlist of read-only RPC methods
- Blocked transaction-sending methods (`eth_sendRawTransaction`, `eth_sendTransaction`)
- Returns 403 with clear error for disallowed methods

**Allowed Methods**:
```typescript
'eth_blockNumber', 'eth_getBalance', 'eth_getCode', 'eth_getStorageAt',
'eth_call', 'eth_getBlockByNumber', 'eth_getBlockByHash',
'eth_getTransactionByHash', 'eth_getTransactionReceipt',
'eth_getTransactionCount', 'eth_getLogs', 'eth_estimateGas',
'eth_gasPrice', 'eth_chainId'
```

## Medium Priority Issues - FIXED ✅

### 1. State Management - Stale Closures

**Problem**: Multiple `setTabs(tabs => ...)` mutations used stale closures, dropping concurrent updates.

**Solution**:
- Replaced all stale closure patterns with `setTabs(prevTabs => prevTabs.map(...))`
- Fixed in:
  - Transfer transaction handling (line ~709)
  - Balance fetching (line ~788)
  - Handler dispatch (line ~866)
  - Clear command (line ~966)

### 2. Plugin Loading State

**Problem**: Commands issued before plugins loaded resolved as "not found".

**Solution**:
- Added `pluginsLoading` and `loadedPlugins` state tracking
- Show loading indicator in welcome message
- Prevent command execution while plugins load
- Update welcome message with loaded protocol names once ready

### 3. Production Logging Cleanup

**Problem**: Verbose logging in production leaked wallet/token context.

**Solution**:
- Wrapped all console.log/error calls with `process.env.NODE_ENV === 'development'` checks
- Applied to:
  - `src/app/api/1inch/eth_rpc/route.ts`
  - `src/app/api/1inch/charts/candle/route.ts`
  - `src/app/api/lifi/routes/route.ts`
  - `src/app/api/1inch/gas/route.ts`

### 4. Centralized Chain Configuration

**Problem**: Token helpers hard-coded chain maps; unsupported chains threw generic errors.

**Solution**:
- Created `src/lib/chains.ts` - Single source of truth for chain data
- Includes 7 major chains: Ethereum, Optimism, BSC, Polygon, Base, Arbitrum, Avalanche
- Protocol-specific chain support mappings
- Helper functions for chain validation and error messages

**Usage**:
```typescript
import { getChainConfig, isChainSupported, getUnsupportedChainError } from '@/lib/chains'

if (!isChainSupported(chainId)) {
  return { error: getUnsupportedChainError(chainId) }
}
```

### 5. Swap Command Status Clarity

**Problem**: Swap flow was a stub but not clearly flagged.

**Solution**:
- Enhanced swap output to clearly indicate "COMING SOON" status
- Added detailed explanation that quote fetching works but execution is pending
- Prevents user confusion about feature availability

## Architecture Notes

### Server-Side Plugin Execution (Not Yet Implemented)

The audit identified that client-side plugin loading exposes API keys. The recommended solution is:

1. Create `src/app/api/plugins/execute/route.ts` - Server-side plugin executor
2. Refactor `src/components/cli.tsx` to call server APIs instead of loading plugins client-side
3. Move plugin initialization to server-only code
4. Implement signed request system for client→server trust

**Status**: Deferred to future PR due to significant architectural changes required.

## Environment Variables

Add these to your `.env.local` (development) and deployment environment (production):

```bash
# Required for 1inch features
ONEINCH_API_KEY=your_1inch_api_key

# Required for client authentication (production)
CLIENT_API_KEY=your_secure_api_key

# Optional - controls logging
NODE_ENV=production
```

## Testing Checklist

- [ ] Verify API routes return 401 without valid API key in production
- [ ] Test rate limiting by making >10 RPC calls in 1 minute
- [ ] Confirm disallowed RPC methods (e.g., `eth_sendRawTransaction`) return 403
- [ ] Check no sensitive data in production logs
- [ ] Verify plugins load before allowing command execution
- [ ] Test swap command shows clear "COMING SOON" message
- [ ] Confirm unsupported chains show helpful error messages

## Migration Guide

If upgrading from a previous version:

1. **Add environment variables** (see above)
2. **Update API clients** to include `x-api-key` header:
   ```typescript
   fetch('/api/1inch/eth_rpc', {
     headers: {
       'x-api-key': process.env.NEXT_PUBLIC_CLIENT_API_KEY
     }
   })
   ```
3. **No breaking changes** for existing functionality
4. **New behavior**: Commands will be queued until plugins load

## Future Improvements

1. **Server-side plugins**: Move plugin execution to server APIs
2. **Persistent rate limiting**: Use Redis/Upstash for distributed rate limiting
3. **Advanced auth**: Integrate NextAuth.js or similar for user accounts
4. **Chain auto-discovery**: Fetch supported chains dynamically from protocol APIs
5. **Complete swap flow**: Implement transaction signing and submission

## References

- Production Audit Report: `/production-audit-report.md`
- Rate Limiting: `src/lib/rate-limit.ts`
- Authentication: `src/lib/auth.ts`
- Chain Config: `src/lib/chains.ts`
