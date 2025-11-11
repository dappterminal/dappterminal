/**
 * Prisma Database Seed Script
 *
 * Seeds the database with initial faucet configuration
 * Run with: pnpm db:seed or npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client'
import { parseEther } from 'viem'

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

async function main() {
  console.log('🌱 Seeding database...')

  // Seed Faucet Configurations
  console.log('\n📝 Creating faucet configurations...')

  const faucetConfigs = [
    {
      network: 'sepolia',
      chainId: 11155111,
      amount: parseEther('0.5').toString(),
      enabled: true,
      cooldownPeriod: 86400, // 24 hours
      displayName: 'Sepolia Testnet',
      symbol: 'SEP',
      rpcUrl: process.env.FAUCET_SEPOLIA_RPC || 'https://rpc.sepolia.org',
      minBalance: parseEther('1').toString(),
    },
    {
      network: 'holesky',
      chainId: 17000,
      amount: parseEther('1.0').toString(),
      enabled: true,
      cooldownPeriod: 86400, // 24 hours
      displayName: 'Holesky Testnet',
      symbol: 'HOL',
      rpcUrl: process.env.FAUCET_HOLESKY_RPC || 'https://rpc.holesky.ethpandaops.io',
      minBalance: parseEther('2').toString(),
    },
    {
      network: 'optimism-sepolia',
      chainId: 11155420,
      amount: parseEther('0.3').toString(),
      enabled: true,
      cooldownPeriod: 86400, // 24 hours
      displayName: 'Optimism Sepolia',
      symbol: 'SEP',
      rpcUrl: process.env.FAUCET_OPTIMISM_SEPOLIA_RPC || 'https://sepolia.optimism.io',
      minBalance: parseEther('0.5').toString(),
    },
  ]

  for (const config of faucetConfigs) {
    const result = await prisma.faucetConfig.upsert({
      where: { network: config.network },
      update: config,
      create: config,
    })
    console.log(`  ✓ ${result.displayName} (${result.network}) configured`)
  }

  // Log initial faucet audit entry
  console.log('\n📊 Creating initial audit log...')

  await prisma.faucetAuditLog.create({
    data: {
      eventType: 'system_init',
      severity: 'info',
      message: 'Faucet system initialized with seed data',
      metadata: {
        networks: faucetConfigs.map(c => c.network),
        timestamp: new Date().toISOString(),
      },
    },
  })

  console.log('  ✓ Audit log created')

  console.log('\n✅ Seeding completed successfully!')
}

main()
  .catch((error) => {
    console.error('\n❌ Error seeding database:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
