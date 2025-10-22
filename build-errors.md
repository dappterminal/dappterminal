## build errors

## 1

oct 22, 2025

build error #1 1inch stuff

```[nick@blade the-defi-terminal]$ pnpm build

> the-defi-terminal@0.1.0 build /home/nick/dev/the-defi-terminal
> next build --turbopack

   ▲ Next.js 15.5.4 (Turbopack)
   - Environments: .env

   Creating an optimized production build ...
 ✓ Finished writing to disk in 74ms

> Build error occurred
Error: Turbopack build failed with 10 errors:
./src/app/api/1inch/orderbook/limit/create/route.ts:2:1
Module not found: Can't resolve '@1inch/limit-order-sdk'
   1 | import { NextRequest, NextResponse } from 'next/server'
>  2 | import {
     | ^^^^^^^^
>  3 |   Sdk,
     | ^^^^^^
>  4 |   MakerTraits,
     | ^^^^^^
>  5 |   FetchProviderConnector,
     | ^^^^^^
>  6 |   Address,
     | ^^^^^^
>  7 |   Extension,
     | ^^^^^^
>  8 |   randBigInt,
     | ^^^^^^
>  9 | } from '@1inch/limit-order-sdk'
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  10 | import { getProperTokenAddress } from '@/lib/1inch-helpers'
  11 |
  12 | export async function POST(request: NextRequest) {



https://nextjs.org/docs/messages/module-not-found


./src/app/api/1inch/orderbook/limit/create/route.ts:2:1
Module not found: Can't resolve '@1inch/limit-order-sdk'
   1 | import { NextRequest, NextResponse } from 'next/server'
>  2 | import {
     | ^^^^^^^^
>  3 |   Sdk,
     | ^^^^^^
>  4 |   MakerTraits,
     | ^^^^^^
>  5 |   FetchProviderConnector,
     | ^^^^^^
>  6 |   Address,
     | ^^^^^^
>  7 |   Extension,
     | ^^^^^^
>  8 |   randBigInt,
     | ^^^^^^
>  9 | } from '@1inch/limit-order-sdk'
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  10 | import { getProperTokenAddress } from '@/lib/1inch-helpers'
  11 |
  12 | export async function POST(request: NextRequest) {



https://nextjs.org/docs/messages/module-not-found


./src/app/api/1inch/orderbook/limit/create/route.ts:2:1
Module not found: Can't resolve '@1inch/limit-order-sdk'
   1 | import { NextRequest, NextResponse } from 'next/server'
>  2 | import {
     | ^^^^^^^^
>  3 |   Sdk,
     | ^^^^^^
>  4 |   MakerTraits,
     | ^^^^^^
>  5 |   FetchProviderConnector,
     | ^^^^^^
>  6 |   Address,
     | ^^^^^^
>  7 |   Extension,
     | ^^^^^^
>  8 |   randBigInt,
     | ^^^^^^
>  9 | } from '@1inch/limit-order-sdk'
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  10 | import { getProperTokenAddress } from '@/lib/1inch-helpers'
  11 |
  12 | export async function POST(request: NextRequest) {



https://nextjs.org/docs/messages/module-not-found


./src/app/api/1inch/orderbook/limit/create/route.ts:2:1
Module not found: Can't resolve '@1inch/limit-order-sdk'
   1 | import { NextRequest, NextResponse } from 'next/server'
>  2 | import {
     | ^^^^^^^^
>  3 |   Sdk,
     | ^^^^^^
>  4 |   MakerTraits,
     | ^^^^^^
>  5 |   FetchProviderConnector,
     | ^^^^^^
>  6 |   Address,
     | ^^^^^^
>  7 |   Extension,
     | ^^^^^^
>  8 |   randBigInt,
     | ^^^^^^
>  9 | } from '@1inch/limit-order-sdk'
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  10 | import { getProperTokenAddress } from '@/lib/1inch-helpers'
  11 |
  12 | export async function POST(request: NextRequest) {



https://nextjs.org/docs/messages/module-not-found


./src/app/api/1inch/orderbook/limit/create/route.ts:2:1
Module not found: Can't resolve '@1inch/limit-order-sdk'
   1 | import { NextRequest, NextResponse } from 'next/server'
>  2 | import {
     | ^^^^^^^^
>  3 |   Sdk,
     | ^^^^^^
>  4 |   MakerTraits,
     | ^^^^^^
>  5 |   FetchProviderConnector,
     | ^^^^^^
>  6 |   Address,
     | ^^^^^^
>  7 |   Extension,
     | ^^^^^^
>  8 |   randBigInt,
     | ^^^^^^
>  9 | } from '@1inch/limit-order-sdk'
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  10 | import { getProperTokenAddress } from '@/lib/1inch-helpers'
  11 |
  12 | export async function POST(request: NextRequest) {



https://nextjs.org/docs/messages/module-not-found


./src/app/api/1inch/orderbook/limit/create/route.ts:2:1
Module not found: Can't resolve '@1inch/limit-order-sdk'
   1 | import { NextRequest, NextResponse } from 'next/server'
>  2 | import {
     | ^^^^^^^^
>  3 |   Sdk,
     | ^^^^^^
>  4 |   MakerTraits,
     | ^^^^^^
>  5 |   FetchProviderConnector,
     | ^^^^^^
>  6 |   Address,
     | ^^^^^^
>  7 |   Extension,
     | ^^^^^^
>  8 |   randBigInt,
     | ^^^^^^
>  9 | } from '@1inch/limit-order-sdk'
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  10 | import { getProperTokenAddress } from '@/lib/1inch-helpers'
  11 |
  12 | export async function POST(request: NextRequest) {



https://nextjs.org/docs/messages/module-not-found


./src/app/api/1inch/orderbook/limit/submit/route.ts:1:1
Module not found: Can't resolve '@1inch/limit-order-sdk'
> 1 | import {
    | ^^^^^^^^
> 2 |   FetchProviderConnector,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 3 |   LimitOrderWithFee,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 4 |   Sdk,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 5 | } from '@1inch/limit-order-sdk'
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  6 | import { NextRequest, NextResponse } from 'next/server'
  7 |
  8 | export async function POST(request: NextRequest) {



https://nextjs.org/docs/messages/module-not-found


./src/app/api/1inch/orderbook/limit/submit/route.ts:1:1
Module not found: Can't resolve '@1inch/limit-order-sdk'
> 1 | import {
    | ^^^^^^^^
> 2 |   FetchProviderConnector,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 3 |   LimitOrderWithFee,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 4 |   Sdk,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 5 | } from '@1inch/limit-order-sdk'
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  6 | import { NextRequest, NextResponse } from 'next/server'
  7 |
  8 | export async function POST(request: NextRequest) {



https://nextjs.org/docs/messages/module-not-found


./src/app/api/1inch/orderbook/limit/submit/route.ts:1:1
Module not found: Can't resolve '@1inch/limit-order-sdk'
> 1 | import {
    | ^^^^^^^^
> 2 |   FetchProviderConnector,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 3 |   LimitOrderWithFee,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 4 |   Sdk,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 5 | } from '@1inch/limit-order-sdk'
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  6 | import { NextRequest, NextResponse } from 'next/server'
  7 |
  8 | export async function POST(request: NextRequest) {



https://nextjs.org/docs/messages/module-not-found


./src/app/api/1inch/orderbook/limit/submit/route.ts:1:1
Module not found: Can't resolve '@1inch/limit-order-sdk'
> 1 | import {
    | ^^^^^^^^
> 2 |   FetchProviderConnector,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 3 |   LimitOrderWithFee,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 4 |   Sdk,
    | ^^^^^^^^^^^^^^^^^^^^^^^^^
> 5 | } from '@1inch/limit-order-sdk'
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  6 | import { NextRequest, NextResponse } from 'next/server'
  7 |
  8 | export async function POST(request: NextRequest) {



https://nextjs.org/docs/messages/module-not-found


    at <unknown> (./src/app/api/1inch/orderbook/limit/create/route.ts:2:1)
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
    at <unknown> (./src/app/api/1inch/orderbook/limit/create/route.ts:2:1)
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
    at <unknown> (./src/app/api/1inch/orderbook/limit/create/route.ts:2:1)
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
    at <unknown> (./src/app/api/1inch/orderbook/limit/create/route.ts:2:1)
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
    at <unknown> (./src/app/api/1inch/orderbook/limit/create/route.ts:2:1)
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
    at <unknown> (./src/app/api/1inch/orderbook/limit/create/route.ts:2:1)
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
    at <unknown> (./src/app/api/1inch/orderbook/limit/submit/route.ts:1:1)
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
    at <unknown> (./src/app/api/1inch/orderbook/limit/submit/route.ts:1:1)
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
    at <unknown> (./src/app/api/1inch/orderbook/limit/submit/route.ts:1:1)
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
    at <unknown> (./src/app/api/1inch/orderbook/limit/submit/route.ts:1:1)
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
 ELIFECYCLE  Command failed with exit code 1.
[nick@blade the-defi-terminal]$ 


```