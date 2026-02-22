import type { ExecutionContext, RpcRegistry } from './types'

export function getRpcRegistry(context: ExecutionContext): RpcRegistry | undefined {
  const fromGlobal = context.globalState?.rpcRegistry
  return context.rpcRegistry ?? (fromGlobal as RpcRegistry | undefined)
}

export function setRpcRegistry(context: ExecutionContext, registry: RpcRegistry): ExecutionContext {
  return {
    ...context,
    rpcRegistry: registry,
    globalState: {
      ...context.globalState,
      rpcRegistry: registry,
    },
  }
}
