-- Manual Faucet Database Deployment Script
-- Run this in Railway's PostgreSQL console or psql
-- This creates all tables, indexes, and seeds initial data

-- ============================================================================
-- DROP EXISTING TABLES (if any) - WARNING: This will delete all data!
-- ============================================================================
DROP TABLE IF EXISTS "faucet_audit_logs" CASCADE;
DROP TABLE IF EXISTS "faucet_configs" CASCADE;
DROP TABLE IF EXISTS "rate_limit_records" CASCADE;
DROP TABLE IF EXISTS "faucet_requests" CASCADE;

-- ============================================================================
-- CREATE TABLES
-- ============================================================================

-- Faucet Requests Table
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

-- Rate Limit Records Table
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rate_limit_records_pkey" PRIMARY KEY ("id")
);

-- Faucet Configs Table
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "faucet_configs_pkey" PRIMARY KEY ("id")
);

-- Faucet Audit Logs Table
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

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- Faucet Requests Indexes
CREATE INDEX "faucet_requests_address_network_createdAt_idx"
    ON "faucet_requests"("address", "network", "createdAt");
CREATE INDEX "faucet_requests_ipAddress_createdAt_idx"
    ON "faucet_requests"("ipAddress", "createdAt");
CREATE INDEX "faucet_requests_txHash_idx"
    ON "faucet_requests"("txHash");
CREATE INDEX "faucet_requests_status_createdAt_idx"
    ON "faucet_requests"("status", "createdAt");

-- Rate Limit Records Indexes
CREATE INDEX "rate_limit_records_identifier_network_windowEnd_idx"
    ON "rate_limit_records"("identifier", "network", "windowEnd");
CREATE INDEX "rate_limit_records_windowEnd_idx"
    ON "rate_limit_records"("windowEnd");
CREATE UNIQUE INDEX "rate_limit_records_identifier_identifierType_network_windowStart_key"
    ON "rate_limit_records"("identifier", "identifierType", "network", "windowStart");

-- Faucet Configs Indexes
CREATE UNIQUE INDEX "faucet_configs_network_key"
    ON "faucet_configs"("network");
CREATE UNIQUE INDEX "faucet_configs_chainId_key"
    ON "faucet_configs"("chainId");

-- Faucet Audit Logs Indexes
CREATE INDEX "faucet_audit_logs_eventType_createdAt_idx"
    ON "faucet_audit_logs"("eventType", "createdAt");
CREATE INDEX "faucet_audit_logs_severity_createdAt_idx"
    ON "faucet_audit_logs"("severity", "createdAt");
CREATE INDEX "faucet_audit_logs_requestId_idx"
    ON "faucet_audit_logs"("requestId");
CREATE INDEX "faucet_audit_logs_address_createdAt_idx"
    ON "faucet_audit_logs"("address", "createdAt");

-- ============================================================================
-- SEED INITIAL DATA
-- ============================================================================

-- Sepolia Configuration
INSERT INTO "faucet_configs" (
    "id", "network", "chainId", "amount", "enabled", "cooldownPeriod",
    "displayName", "symbol", "rpcUrl", "minBalance", "createdAt", "updatedAt"
) VALUES (
    'sepolia_config',
    'sepolia',
    11155111,
    '500000000000000000', -- 0.5 ETH in wei
    true,
    86400, -- 24 hours
    'Sepolia Testnet',
    'SEP',
    'https://rpc.sepolia.org',
    '1000000000000000000', -- 1 ETH in wei
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Holesky Configuration
INSERT INTO "faucet_configs" (
    "id", "network", "chainId", "amount", "enabled", "cooldownPeriod",
    "displayName", "symbol", "rpcUrl", "minBalance", "createdAt", "updatedAt"
) VALUES (
    'holesky_config',
    'holesky',
    17000,
    '1000000000000000000', -- 1.0 ETH in wei
    true,
    86400, -- 24 hours
    'Holesky Testnet',
    'HOL',
    'https://rpc.holesky.ethpandaops.io',
    '2000000000000000000', -- 2 ETH in wei
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Optimism Sepolia Configuration
INSERT INTO "faucet_configs" (
    "id", "network", "chainId", "amount", "enabled", "cooldownPeriod",
    "displayName", "symbol", "rpcUrl", "minBalance", "createdAt", "updatedAt"
) VALUES (
    'optimism_sepolia_config',
    'optimism-sepolia',
    11155420,
    '300000000000000000', -- 0.3 ETH in wei
    true,
    86400, -- 24 hours
    'Optimism Sepolia',
    'SEP',
    'https://sepolia.optimism.io',
    '500000000000000000', -- 0.5 ETH in wei
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Initial Audit Log Entry
INSERT INTO "faucet_audit_logs" (
    "id", "eventType", "severity", "message", "metadata", "createdAt"
) VALUES (
    'init_audit_log',
    'system_init',
    'info',
    'Faucet system initialized with seed data',
    '{"networks": ["sepolia", "holesky", "optimism-sepolia"]}'::jsonb,
    CURRENT_TIMESTAMP
);

-- ============================================================================
-- VERIFY INSTALLATION
-- ============================================================================

-- Display created tables
SELECT
    'Tables created:' as status,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'faucet%';

-- Display initial config
SELECT
    network,
    displayName,
    "chainId",
    amount,
    enabled
FROM faucet_configs
ORDER BY "chainId";

-- Success message
SELECT '✅ Faucet database deployment complete!' as result;
