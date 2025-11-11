-- CreateTable
CREATE TABLE "swap_transactions" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "blockNumber" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "protocol" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "txType" TEXT NOT NULL DEFAULT 'swap',
    "walletAddress" TEXT NOT NULL,
    "tokenIn" TEXT NOT NULL,
    "tokenOut" TEXT NOT NULL,
    "amountIn" TEXT NOT NULL,
    "amountOut" TEXT NOT NULL,
    "gasUsed" TEXT,
    "gasPrice" TEXT,
    "route" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "swap_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_volumes" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "protocol" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "successfulTxs" INTEGER NOT NULL DEFAULT 0,
    "failedTxs" INTEGER NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "totalVolumeIn" TEXT NOT NULL DEFAULT '0',
    "totalVolumeOut" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocol_volumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_swap_activities" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "totalSwaps" INTEGER NOT NULL DEFAULT 1,
    "totalBridges" INTEGER NOT NULL DEFAULT 0,
    "lastTxAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstTxAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalVolumeIn" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_swap_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "swap_transactions_txHash_key" ON "swap_transactions"("txHash");

-- CreateIndex
CREATE INDEX "swap_transactions_walletAddress_createdAt_idx" ON "swap_transactions"("walletAddress", "createdAt");

-- CreateIndex
CREATE INDEX "swap_transactions_protocol_createdAt_idx" ON "swap_transactions"("protocol", "createdAt");

-- CreateIndex
CREATE INDEX "swap_transactions_chainId_createdAt_idx" ON "swap_transactions"("chainId", "createdAt");

-- CreateIndex
CREATE INDEX "swap_transactions_txHash_idx" ON "swap_transactions"("txHash");

-- CreateIndex
CREATE INDEX "swap_transactions_status_createdAt_idx" ON "swap_transactions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "swap_transactions_txType_createdAt_idx" ON "swap_transactions"("txType", "createdAt");

-- CreateIndex
CREATE INDEX "protocol_volumes_protocol_date_idx" ON "protocol_volumes"("protocol", "date");

-- CreateIndex
CREATE INDEX "protocol_volumes_chainId_date_idx" ON "protocol_volumes"("chainId", "date");

-- CreateIndex
CREATE INDEX "protocol_volumes_date_idx" ON "protocol_volumes"("date");

-- CreateIndex
CREATE UNIQUE INDEX "protocol_volumes_date_protocol_chainId_key" ON "protocol_volumes"("date", "protocol", "chainId");

-- CreateIndex
CREATE INDEX "user_swap_activities_walletAddress_idx" ON "user_swap_activities"("walletAddress");

-- CreateIndex
CREATE INDEX "user_swap_activities_lastTxAt_idx" ON "user_swap_activities"("lastTxAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_swap_activities_walletAddress_protocol_chainId_key" ON "user_swap_activities"("walletAddress", "protocol", "chainId");
