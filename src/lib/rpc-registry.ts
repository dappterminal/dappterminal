import type { RpcRegistry, RpcRegistryEntry } from '@/core'
import { SUPPORTED_CHAINS } from './chains'

const STORAGE_KEY = 'defi-terminal-rpc-registry'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function getDefaultRpcRegistry(): RpcRegistry {
  const registry: RpcRegistry = {}
  for (const chainId of Object.keys(SUPPORTED_CHAINS)) {
    const numericId = Number(chainId)
    registry[numericId] = {
      chainId: numericId,
      source: 'wallet',
    }
  }
  return registry
}

export function normalizeRpcRegistry(input: unknown): RpcRegistry {
  const defaults = getDefaultRpcRegistry()
  if (!input || typeof input !== 'object') {
    return defaults
  }

  const registry: RpcRegistry = { ...defaults }
  for (const [key, value] of Object.entries(input as Record<string, RpcRegistryEntry>)) {
    const chainId = Number(key)
    if (!Number.isFinite(chainId)) continue
    if (!value || typeof value !== 'object') continue
    const source = value.source === 'custom' ? 'custom' : 'wallet'
    registry[chainId] = {
      chainId,
      source,
      customRpcUrl: isNonEmptyString(value.customRpcUrl) ? value.customRpcUrl.trim() : undefined,
      customProviderName: isNonEmptyString(value.customProviderName) ? value.customProviderName.trim() : undefined,
      updatedAt: isNonEmptyString(value.updatedAt) ? value.updatedAt : undefined,
    }
  }

  return registry
}

export function loadRpcRegistry(): RpcRegistry {
  if (typeof window === 'undefined') {
    return getDefaultRpcRegistry()
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return getDefaultRpcRegistry()
  }

  try {
    const parsed = JSON.parse(raw)
    return normalizeRpcRegistry(parsed)
  } catch {
    return getDefaultRpcRegistry()
  }
}

export function saveRpcRegistry(registry: RpcRegistry): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeRpcRegistry(registry)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
}

export function getRpcRegistryStorageKey(): string {
  return STORAGE_KEY
}
