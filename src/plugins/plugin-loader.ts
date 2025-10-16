/**
 * Plugin loader and manager
 *
 * Responsible for:
 * - Loading and unloading plugins
 * - Managing plugin lifecycle
 * - Registering plugin fibers with the command registry
 */

import type { ExecutionContext, ProtocolId } from '@/core/types'
import { registry } from '@/core/command-registry'
import type {
  Plugin,
  PluginConfig,
  PluginLoadResult,
  PluginRegistryEntry,
} from './types'

/**
 * Plugin loader and manager
 */
export class PluginLoader {
  /** Loaded plugins */
  private plugins: Map<ProtocolId, PluginRegistryEntry> = new Map()

  /** Plugin search paths */
  private searchPaths: string[] = []

  /**
   * Load a plugin
   *
   * @param plugin - The plugin to load
   * @param config - Optional plugin configuration
   * @param context - Execution context
   * @returns Load result
   */
  async loadPlugin(
    plugin: Plugin,
    config: PluginConfig | undefined,
    context: ExecutionContext
  ): Promise<PluginLoadResult> {
    try {
      // Use provided config or default
      const pluginConfig = config || plugin.defaultConfig

      // Validate configuration
      if (plugin.validateConfig && !plugin.validateConfig(pluginConfig)) {
        throw new Error(`Invalid configuration for plugin ${plugin.metadata.id}`)
      }

      // Check if plugin is enabled
      if (!pluginConfig.enabled) {
        return {
          success: false,
          error: new Error(`Plugin ${plugin.metadata.id} is disabled`),
        }
      }

      // Initialize plugin and get fiber
      const fiber = await plugin.initialize(context)

      // Invariant: fiber.id MUST match plugin.metadata.id
      // This ensures the fibered monoid structure is preserved
      if (fiber.id !== plugin.metadata.id) {
        throw new Error(
          `Plugin invariant violated: fiber.id (${fiber.id}) !== plugin.metadata.id (${plugin.metadata.id}). ` +
          `The fiber returned by plugin.initialize() must have the same ID as the plugin metadata. ` +
          `This is required to maintain the fibered monoid structure where π(M_P) = P.`
        )
      }

      // Register fiber with command registry
      registry.registerProtocolFiber(fiber)

      // Store in registry
      const entry: PluginRegistryEntry = {
        plugin,
        fiber,
        config: pluginConfig,
        loaded: true,
        loadedAt: new Date(),
      }

      this.plugins.set(plugin.metadata.id, entry)

      return {
        success: true,
        plugin,
        fiber,
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      // Store failed entry
      const entry: PluginRegistryEntry = {
        plugin,
        fiber: { id: plugin.metadata.id, name: plugin.metadata.name, commands: new Map() },
        config: config || plugin.defaultConfig,
        loaded: false,
        error: err,
      }

      this.plugins.set(plugin.metadata.id, entry)

      return {
        success: false,
        error: err,
      }
    }
  }

  /**
   * Unload a plugin
   *
   * @param pluginId - Plugin ID to unload
   * @param context - Execution context
   */
  async unloadPlugin(pluginId: ProtocolId, context: ExecutionContext): Promise<void> {
    const entry = this.plugins.get(pluginId)
    if (!entry) {
      throw new Error(`Plugin ${pluginId} is not loaded`)
    }

    // Call cleanup if available
    if (entry.plugin.cleanup) {
      await entry.plugin.cleanup(context)
    }

    // Remove from registry
    this.plugins.delete(pluginId)

    // Note: We don't remove from command registry as that could break references
    // In a production system, you might want to implement command registry cleanup
  }

  /**
   * Reload a plugin
   *
   * @param pluginId - Plugin ID to reload
   * @param context - Execution context
   */
  async reloadPlugin(pluginId: ProtocolId, context: ExecutionContext): Promise<PluginLoadResult> {
    const entry = this.plugins.get(pluginId)
    if (!entry) {
      throw new Error(`Plugin ${pluginId} is not loaded`)
    }

    // Unload first
    await this.unloadPlugin(pluginId, context)

    // Reload with same config
    return this.loadPlugin(entry.plugin, entry.config, context)
  }

  /**
   * Get a loaded plugin
   */
  getPlugin(pluginId: ProtocolId): PluginRegistryEntry | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): PluginRegistryEntry[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get loaded plugin IDs
   */
  getLoadedPluginIds(): ProtocolId[] {
    return Array.from(this.plugins.keys()).filter(
      id => this.plugins.get(id)?.loaded
    )
  }

  /**
   * Check if a plugin is loaded
   */
  isPluginLoaded(pluginId: ProtocolId): boolean {
    return this.plugins.get(pluginId)?.loaded ?? false
  }

  /**
   * Run health checks on all loaded plugins
   */
  async healthCheckAll(context: ExecutionContext): Promise<Map<ProtocolId, boolean>> {
    const results = new Map<ProtocolId, boolean>()

    for (const [id, entry] of this.plugins) {
      if (!entry.loaded) {
        results.set(id, false)
        continue
      }

      if (entry.plugin.healthCheck) {
        try {
          const healthy = await entry.plugin.healthCheck(context)
          results.set(id, healthy)
        } catch {
          results.set(id, false)
        }
      } else {
        // No health check = assume healthy
        results.set(id, true)
      }
    }

    return results
  }

  /**
   * Add a plugin search path
   */
  addSearchPath(path: string): void {
    if (!this.searchPaths.includes(path)) {
      this.searchPaths.push(path)
    }
  }

  /**
   * Get plugin search paths
   */
  getSearchPaths(): string[] {
    return [...this.searchPaths]
  }
}

/**
 * Global singleton plugin loader
 */
export const pluginLoader = new PluginLoader()
