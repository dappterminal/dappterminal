-- CreateTable
CREATE TABLE "faucet_requests" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ipAddress" TEXT,
    "network" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "faucet_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_records" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "identifierType" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "lastRequest" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faucet_configs" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "amount" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownPeriod" INTEGER NOT NULL DEFAULT 86400,
    "displayName" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "rpcUrl" TEXT NOT NULL,
    "minBalance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faucet_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faucet_audit_logs" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "requestId" TEXT,
    "address" TEXT,
    "network" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faucet_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faucet_requests_address_network_createdAt_idx" ON "faucet_requests"("address", "network", "createdAt");

-- CreateIndex
CREATE INDEX "faucet_requests_ipAddress_createdAt_idx" ON "faucet_requests"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "faucet_requests_txHash_idx" ON "faucet_requests"("txHash");

-- CreateIndex
CREATE INDEX "faucet_requests_status_createdAt_idx" ON "faucet_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "rate_limit_records_identifier_network_windowEnd_idx" ON "rate_limit_records"("identifier", "network", "windowEnd");

-- CreateIndex
CREATE INDEX "rate_limit_records_windowEnd_idx" ON "rate_limit_records"("windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_records_identifier_identifierType_network_windowStart_key" ON "rate_limit_records"("identifier", "identifierType", "network", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "faucet_configs_network_key" ON "faucet_configs"("network");

-- CreateIndex
CREATE UNIQUE INDEX "faucet_configs_chainId_key" ON "faucet_configs"("chainId");

-- CreateIndex
CREATE INDEX "faucet_audit_logs_eventType_createdAt_idx" ON "faucet_audit_logs"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "faucet_audit_logs_severity_createdAt_idx" ON "faucet_audit_logs"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "faucet_audit_logs_requestId_idx" ON "faucet_audit_logs"("requestId");

-- CreateIndex
CREATE INDEX "faucet_audit_logs_address_createdAt_idx" ON "faucet_audit_logs"("address", "createdAt");
