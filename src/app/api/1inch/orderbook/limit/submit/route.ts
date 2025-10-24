import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const sdkModule = await import('@1inch/limit-order-sdk').catch(() => null)
    if (!sdkModule) {
      return NextResponse.json(
        { error: 'The @1inch/limit-order-sdk package is not installed on the server.' },
        { status: 500 }
      )
    }

    const { FetchProviderConnector, LimitOrderWithFee, Sdk } = sdkModule as {
      FetchProviderConnector: new () => any
      LimitOrderWithFee: { fromDataAndExtension(build: unknown, extension: unknown): any }
      Sdk: new (config: any) => any
    }

    const { fromChainId, build, extension, signature } = await request.json()

    const authKey = process.env.ONEINCH_API_KEY
    if (!authKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const httpConnector = new FetchProviderConnector()

    const sdk = new Sdk({
      networkId: fromChainId,
      authKey: authKey,
      httpConnector: httpConnector,
    })

    const limitOrderWithFee = LimitOrderWithFee.fromDataAndExtension(build, extension)
    console.log('Submitting limit order:', limitOrderWithFee instanceof LimitOrderWithFee)

    const submitOrder = await sdk.submitOrder(limitOrderWithFee, signature)

    console.log('Limit order submitted successfully:', submitOrder)

    return NextResponse.json({
      success: true,
      message: 'Limit order submitted successfully',
      orderHash: submitOrder?.orderHash || null,
    })
  } catch (error) {
    console.error('Order submission error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Order submission failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
