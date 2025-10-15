/**
 * Plugin system types and interfaces
 *
 * Defines the contract that all protocol plugins must implement
 */

import type { Command, ProtocolFiber, ExecutionContext } from '@/core/types'

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Plugin identifier (e.g., 'uniswap-v4', 'wormhole') */
  id: string

  /** Human-readable name */
  name: string

  /** Plugin version (semver) */
  version: string

  /** Plugin description */
  description?: string

  /** Plugin author */
  author?: string

  /** Plugin homepage/repository URL */
  homepage?: string

  /** Plugin tags/categories */
  tags?: string[]
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  /** Whether the plugin is enabled */
  enabled: boolean

  /** Plugin-specific configuration */
  config: Record<string, unknown>

  /** API keys or credentials */
  credentials?: Record<string, string>
}

/**
 * Plugin interface
 *
 * All protocol plugins must implement this interface
 */
export interface Plugin {
  /** Plugin metadata */
  metadata: PluginMetadata

  /** Default configuration */
  defaultConfig: PluginConfig

  /**
   * Initialize the plugin
   *
   * Called when the plugin is loaded
   * Should create the protocol fiber and register commands
   */
  initialize(context: ExecutionContext): Promise<ProtocolFiber>

  /**
   * Cleanup plugin resources
   *
   * Called when the plugin is unloaded
   */
  cleanup?(context: ExecutionContext): Promise<void>

  /**
   * Validate plugin configuration
   */
  validateConfig?(config: PluginConfig): boolean

  /**
   * Health check
   *
   * Returns whether the plugin is functioning correctly
   */
  healthCheck?(context: ExecutionContext): Promise<boolean>
}

/**
 * Plugin loader result
 */
export interface PluginLoadResult {
  success: boolean
  plugin?: Plugin
  fiber?: ProtocolFiber
  error?: Error
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
  plugin: Plugin
  fiber: ProtocolFiber
  config: PluginConfig
  loaded: boolean
  loadedAt?: Date
  error?: Error
}
