# DeFi Terminal API Architecture

**Last Updated:** 2025-10-17

This directory contains API routes organized by protocol, following the fibered monoid architecture.

## Structure

```
src/app/api/
├── [protocol]/              # Protocol-specific API routes (G_p scope)
│   ├── [action]/
│   │   └── route.ts        # Next.js API route handler
│   └── types.ts            # Protocol API types
├── 1inch/                  # 1inch DEX aggregator
│   └── gas/
├── stargate/               # Stargate/LayerZero bridge
│   └── quote/
├── wormhole/               # Wormhole cross-chain bridge
│   ├── quote/
│   └── bridge/
└── README.md
```

## Protocol API Routes

Each protocol plugin can define its own API routes following this pattern:

```
/api/[protocol]/[action]
```

For example:
- `/api/uniswap-v4/quote` - Get a swap quote from Uniswap v4
- `/api/aave-v3/supply` - Supply assets to Aave v3
- `/api/wormhole/bridge` - Bridge tokens via Wormhole

## Creating Protocol API Routes

1. Create a directory for your protocol: `src/app/api/[protocol-id]/`
2. Create action subdirectories for each API endpoint
3. Each action should have a `route.ts` file with Next.js route handlers

Example structure for Uniswap v4:

```
src/app/api/uniswap-v4/
├── quote/
│   └── route.ts
├── swap/
│   └── route.ts
└── types.ts
```

## Route Handler Template

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Protocol-specific logic here
    const result = await performAction(body)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
```

## Connecting Commands to API Routes

Protocol commands (G_p scope) should call their corresponding API routes:

```typescript
// In src/plugins/uniswap-v4/commands.ts
export const quoteCommand: Command = {
  id: 'quote',
  scope: 'G_p',
  description: 'Get swap quote',

  async run(args, context) {
    const response = await fetch('/api/uniswap-v4/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenIn: args.tokenIn,
        tokenOut: args.tokenOut,
        amount: args.amount
      })
    })

    const result = await response.json()
    return { success: result.success, value: result.data }
  }
}
```

## API Response Format

All API routes should follow a consistent response format:

```typescript
// Success response
{
  success: true,
  data: T  // Generic response data
}

// Error response
{
  success: false,
  error: string
}
```

## Security Considerations

- **Authentication**: API routes should verify wallet signatures for sensitive operations
- **Rate Limiting**: Implement rate limiting for public endpoints
- **Input Validation**: Always validate and sanitize inputs
- **CORS**: Configure CORS headers appropriately for production

## Implemented API Routes

### 1inch API

#### `GET /api/1inch/gas`

Get current gas prices for a specific chain.

**Query Parameters:**
- `chainId` (optional): Chain ID (default: 1 for Ethereum)

**Response:**
```json
{
  "baseFee": "12.5",
  "maxPriorityFee": "1.5",
  "maxFee": "26.5"
}
```

**Implementation:** `src/app/api/1inch/gas/route.ts`

---

### Stargate API

#### `POST /api/stargate/quote`

Fetch bridge quote from Stargate/LayerZero.

**Request Body:**
```json
{
  "fromChainId": 8453,
  "toChainId": 42161,
  "fromTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "toTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "fromAmount": "1000000",
  "fromAddress": "0x...",
  "toAddress": "0x...",
  "slippage": 0.5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fromChainId": 8453,
    "toChainId": 42161,
    "fromAmount": "1000000",
    "toAmount": "997500",
    "stargateSteps": [
      {
        "type": "approve",
        "transaction": { "to": "0x...", "data": "0x...", "value": "0x0" }
      },
      {
        "type": "bridge",
        "transaction": { "to": "0x...", "data": "0x...", "value": "0x123" }
      }
    ],
    "fullQuote": { /* Full Stargate API response */ }
  }
}
```

**Supported Chains:** Base (8453), Arbitrum (42161), Ethereum (1), Polygon (137), Optimism (10)

**Implementation:** `src/app/api/stargate/quote/route.ts`

---

### Wormhole API

#### `POST /api/wormhole/quote`

Get route quotes for cross-chain token transfers via Wormhole.

**Request Body:**
```json
{
  "sourceChainId": 8453,
  "destChainId": 42161,
  "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount": "1000000",
  "sourceAddress": "0x...",
  "destAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bestRoute": {
      "type": "AutomaticCCTPRoute",
      "eta": "12m",
      "fee": "1500",
      "receiveAmount": "998500"
    },
    "quotes": [/* Array of all available routes */],
    "transferRequest": {/* Serialized transfer request */},
    "wormholeContext": {/* SDK context data */}
  }
}
```

**Implementation:** `src/app/api/wormhole/quote/route.ts`

#### `POST /api/wormhole/bridge`

Execute a Wormhole bridge transfer.

**Request Body:**
```json
{
  "selectedRouteType": "AutomaticCCTPRoute",
  "transferRequest": {/* From quote response */},
  "amount": "1000000",
  "sourceAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "to": "0x...",
        "data": "0x...",
        "value": "0x0",
        "description": "ERC20 approve"
      },
      {
        "to": "0x...",
        "data": "0x...",
        "value": "0x0",
        "description": "Bridge transfer"
      }
    ],
    "receiverChain": "Arbitrum",
    "scanUrl": "https://wormholescan.io/#/tx/{{hash}}?network=Mainnet"
  }
}
```

**Implementation:** `src/app/api/wormhole/bridge/route.ts`

---

## Environment Variables

Protocol-specific API keys and configuration should be stored in `.env.local`:

```bash
# 1inch (Required)
ONEINCH_API_KEY=your_1inch_api_key

# Li.Fi for Stargate (Required)
LIFI_API_KEY=your_lifi_api_key

# Wormhole (Optional - uses public endpoints by default)
WORMHOLE_RPC_URL=your_custom_rpc_url
```

Get API keys:
- **1inch**: [https://portal.1inch.dev/](https://portal.1inch.dev/)
- **Li.Fi**: [https://li.fi/](https://li.fi/)
