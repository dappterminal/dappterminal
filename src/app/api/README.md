# DeFi Terminal API Architecture

This directory contains API routes organized by protocol, following the fibered monoid architecture.

## Structure

```
src/app/api/
├── [protocol]/              # Protocol-specific API routes (G_p scope)
│   ├── [action]/
│   │   └── route.ts        # Next.js API route handler
│   └── types.ts            # Protocol API types
├── core/                   # Core API routes (G_core scope)
│   └── [action]/
│       └── route.ts
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

## Environment Variables

Protocol-specific API keys and configuration should be stored in `.env.local`:

```bash
# Uniswap v4
UNISWAP_V4_RPC_URL=...
UNISWAP_V4_SUBGRAPH_URL=...

# Aave v3
AAVE_V3_API_KEY=...

# Wormhole
WORMHOLE_RPC_URL=...

#1inch
ONEINCH_API_KEY=...

#li.fi
LIFI_API_KEY=...
```
