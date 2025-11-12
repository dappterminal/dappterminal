# DappTerminal Documentation

Welcome to the DappTerminal documentation! This guide will help you get started with using, developing, and deploying the DeFi Terminal.

## Quick Links

- [Getting Started](./getting-started.md) - Install and set up DappTerminal
- [User Guide](./user-guide.md) - Learn how to use the terminal interface
- [Command Reference](./commands/) - Complete command documentation
- [Tutorials](./tutorials/) - Step-by-step walkthroughs

## Documentation Structure

### For Users

- **[Getting Started](./getting-started.md)** - Installation, setup, and first steps
- **[User Guide](./user-guide.md)** - Using the terminal interface
- **[Command Reference](./commands/)** - All available commands
  - [Global Commands](./commands/global-commands.md)
  - [1inch Commands](./commands/1inch.md)
  - [Aave V3 Commands](./commands/aave-v3.md)
  - [LiFi Commands](./commands/lifi.md)
  - [Stargate Commands](./commands/stargate.md)
  - [Wormhole Commands](./commands/wormhole.md)
- **[Tutorials](./tutorials/)** - Practical guides
  - [Swapping Tokens](./tutorials/swapping-tokens.md)
  - [Cross-Chain Bridging](./tutorials/cross-chain-bridge.md)
  - [Aave Lending](./tutorials/aave-lending.md)
  - [Limit Orders](./tutorials/limit-orders.md)
  - [Portfolio Tracking](./tutorials/portfolio-tracking.md)
- **[Supported Networks](./networks.md)** - Available blockchains
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions
- **[FAQ](./faq.md)** - Frequently asked questions

### For Developers

- **[Development Guide](./development/)** - Contributing to DappTerminal
  - [Contributing](./development/contributing.md)
  - [Code Style](./development/code-style.md)
  - [Testing](./development/testing.md)
  - [Project Structure](./development/project-structure.md)
- **[Plugin Development](./plugins/)** - Create custom protocol integrations
  - [Plugin Guide](./plugins/plugin-guide.md)
  - [Plugin API](./plugins/plugin-api.md)
  - [Plugin Template](./plugins/plugin-template.md)
  - [Command Registration](./plugins/command-registration.md)
- **[API Documentation](./api/)** - Backend API reference
  - [Overview](./api/overview.md)
  - [Routes](./api/routes.md)
  - [Authentication](./api/authentication.md)
  - [Rate Limiting](./api/rate-limiting.md)
  - [Error Handling](./api/error-handling.md)

### For DevOps & Deployers

- **[Deployment Guide](./deployment/)** - Production deployment
  - [Production Setup](./deployment/production.md)
  - [Environment Configuration](./deployment/environment-config.md)
  - [Monitoring](./deployment/monitoring.md)
  - [Performance](./deployment/performance.md)
- **[Security](./security/)** - Security documentation
  - [Security Fixes](./security/fixes.md)
  - [Best Practices](./security/best-practices.md)

### Architecture & Theory

- **[Architecture](./architecture/)** - System design and theory
  - [Overview](./architecture/overview.md)
  - [Fibered Monoid Specification](./architecture/monoid-spec.md)
  - [Command Resolution](./architecture/command-resolution.md)
  - [Fiber System](./architecture/fiber-system.md)

## About DappTerminal

DappTerminal is a composable, algebraically-sound terminal interface for interacting with DeFi protocols across multiple blockchains. Built on a mathematically rigorous "fibered monoid" architecture, it provides:

- **Protocol Isolation** - Each protocol operates in its own mathematical fiber
- **Type-Safe Composition** - Commands compose with mathematical guarantees
- **Extensible Plugin System** - Add new protocols with ease
- **Multi-Chain Support** - Ethereum, Base, Arbitrum, Optimism, Polygon, and more
- **Cross-Chain Bridging** - Seamless asset transfers via Wormhole, LiFi, and Stargate

## Getting Help

- Check the [FAQ](./faq.md) for common questions
- Read the [Troubleshooting Guide](./troubleshooting.md)
- Visit the [GitHub Issues](https://github.com/nickmura/the-defi-terminal/issues)

## Contributing

We welcome contributions! See the [Contributing Guide](./development/contributing.md) to get started.

## License

See the root [LICENSE](../LICENSE) file for details.
