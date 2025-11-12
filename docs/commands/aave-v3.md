# Aave V3 Commands

Aave V3 is a decentralized lending protocol that allows you to supply assets to earn interest and borrow against your collateral.

## Prerequisites

- Connected wallet
- Assets to supply or existing collateral to borrow against
- Understanding of DeFi lending risks

## Entering Aave V3 Context

```bash
use aave-v3
```

Or use commands directly with the `aave-v3:` prefix:
```bash
aave-v3:markets
```

## Commands

### `markets`

List all available Aave V3 markets and their details.

**Syntax**:
```bash
markets
```

**Output**:
- Market ID
- Total supply
- Total borrowed
- Available liquidity
- Market size

**Example**:
```bash
aave-v3> markets
Available Aave V3 Markets:
1. Ethereum Mainnet
   Supply: $8.5B | Borrowed: $4.2B | Available: $4.3B
2. Optimism
   Supply: $156M | Borrowed: $78M | Available: $78M
3. Arbitrum
   Supply: $234M | Borrowed: $98M | Available: $136M
4. Polygon
   Supply: $89M | Borrowed: $45M | Available: $44M
5. Base
   Supply: $67M | Borrowed: $23M | Available: $44M
```

---

### `rates [marketId]`

Show supply and borrow APY rates for all assets in a market.

**Syntax**:
```bash
rates                  # Current network's market
rates <marketId>       # Specific market
```

**Arguments**:
- `marketId` (optional) - Market identifier (ethereum, optimism, arbitrum, etc.)

**Output**:
- Asset name
- Supply APY
- Borrow APY (variable)
- Borrow APY (stable, if available)

**Example**:
```bash
aave-v3> rates
Ethereum Mainnet Rates:

Asset       Supply APY    Borrow APY (Variable)    Borrow APY (Stable)
----------------------------------------------------------------------
ETH         2.34%         2.89%                    N/A
USDC        4.56%         5.12%                    5.50%
USDT        4.23%         4.98%                    5.25%
DAI         3.98%         4.67%                    5.00%
WBTC        0.45%         1.23%                    N/A
wstETH      1.89%         2.45%                    N/A

aave-v3> rates optimism
Optimism Rates:
...
```

---

### `position [--network <chain>] [--address <addr>]`

Show your current supply and borrow positions.

**Syntax**:
```bash
position                              # Your position on current network
position --network optimism           # Your position on specific network
position --address 0x123...           # Position of specific address
```

**Options**:
- `--network <chain>` - Specific network (ethereum, optimism, arbitrum, etc.)
- `--address <addr>` - Check position of specific address

**Output**:
- Supplied assets and amounts
- Supplied value (USD)
- Borrowed assets and amounts
- Borrowed value (USD)
- Collateralization ratio
- Health factor

**Example**:
```bash
aave-v3> position
Your Aave V3 Position (Ethereum):

Supplied:
  10 ETH          $34,567.00 (used as collateral)
  1,000 USDC      $1,000.00 (used as collateral)
  Total Supplied: $35,567.00

Borrowed:
  500 USDC        $500.00
  0.05 ETH        $172.84
  Total Borrowed: $672.84

Net Worth: $34,894.16
Collateralization: 5,287%
Health Factor: 52.87 (Healthy)
Available to Borrow: $26,675.25

aave-v3> position --address vitalik.eth
Position for vitalik.eth:
...
```

---

### `health [marketId] [--address <addr>]`

Check your health factor and liquidation risk.

**Syntax**:
```bash
health                              # Your health on current network
health optimism                     # Your health on specific network
health --address 0x123...           # Health of specific address
```

**Arguments**:
- `marketId` (optional) - Market identifier
- `--address <addr>` (optional) - Check health of specific address

**Output**:
- Current health factor
- Health status
- Liquidation price
- Risk level

**Example**:
```bash
aave-v3> health
Health Factor: 3.45

Status: Healthy ✓
Liquidation Risk: Low
Liquidation Price: $1,002.45 (per ETH)

Your position is safe. Health factor above 1.0.
Liquidation occurs below 1.0.

Health Levels:
  > 2.0:  Healthy (Low risk)
  1.5-2.0: Moderate risk
  1.0-1.5: High risk
  < 1.0:  Liquidation zone
```

---

### `supply <amount> <asset> [--collateral]`

Supply assets to Aave V3 to earn interest.

**Syntax**:
```bash
supply <amount> <asset> [--collateral]
```

**Arguments**:
- `amount` - Amount to supply (e.g., `1`, `100.5`)
- `asset` - Asset symbol (ETH, USDC, DAI, etc.)

**Options**:
- `--collateral` - Enable asset as collateral (default: true)

**Example**:
```bash
# Supply ETH as collateral
aave-v3> supply 1 ETH
Supply 1 ETH to Aave V3:
  Current APY: 2.34%
  Projected Earnings: ~0.0234 ETH/year ($80.84/year)
  Will be used as collateral: Yes

Confirm? (y/n): y
Approve ETH? (y/n): y
Transaction submitted: 0xabc123...
Success! 1 ETH supplied
You're now earning 2.34% APY

# Supply USDC without collateral
aave-v3> supply 1000 USDC
Supply 1000 USDC:
  Current APY: 4.56%
  Projected Earnings: ~45.60 USDC/year

Confirm? (y/n): y
```

**Notes**:
- Supplied assets start earning interest immediately
- Assets marked as collateral can be borrowed against
- You receive aTokens (aUSDC, aETH) representing your deposit
- Interest accrues in real-time

---

### `withdraw <amount|max> <asset>`

Withdraw your supplied assets from Aave V3.

**Syntax**:
```bash
withdraw <amount> <asset>
withdraw max <asset>
```

**Arguments**:
- `amount` - Amount to withdraw, or `max` for full balance
- `asset` - Asset symbol (ETH, USDC, DAI, etc.)

**Example**:
```bash
# Withdraw specific amount
aave-v3> withdraw 0.5 ETH
Withdraw 0.5 ETH from Aave V3:
  Supplied: 1 ETH
  Available to withdraw: 1 ETH
  After withdrawal: 0.5 ETH supplied

  Interest earned: 0.0015 ETH ($5.18)

Health factor after withdrawal: 3.21 (Healthy)

Confirm? (y/n): y
Transaction submitted: 0xdef456...
Success! 0.5 ETH withdrawn

# Withdraw maximum
aave-v3> withdraw max USDC
Withdraw all USDC (1,045.60 USDC):
  Principal: 1,000 USDC
  Interest earned: 45.60 USDC

This will remove USDC as collateral.
New health factor: 3.45 (Healthy)

Confirm? (y/n): y
```

**Notes**:
- Withdrawal includes earned interest
- Cannot withdraw if it would cause health factor < 1.0
- System checks if withdrawal affects your borrows
- `max` withdraws all supplied tokens plus interest

---

### `borrow <amount> <asset> [--rate <variable|stable>]`

Borrow assets against your supplied collateral.

**Syntax**:
```bash
borrow <amount> <asset> [--rate <variable|stable>]
```

**Arguments**:
- `amount` - Amount to borrow
- `asset` - Asset to borrow

**Options**:
- `--rate <type>` - Variable or stable rate (default: variable)

**Example**:
```bash
aave-v3> borrow 500 USDC
Borrow 500 USDC:
  Current APY: 5.12% (variable)
  Projected Interest: ~25.60 USDC/year

Position After Borrow:
  Total Borrowed: 1,172.84 USDC
  Health Factor: 2.87 (Healthy)
  Available to borrow: $26,175.25

Confirm? (y/n): y
Transaction submitted: 0x789abc...
Success! 500 USDC borrowed

# Borrow with stable rate
aave-v3> borrow 100 DAI --rate stable
Borrow 100 DAI at stable rate:
  Stable APY: 5.00%
  Variable APY: 4.67%

Stable rate protects you from rate increases but is usually higher.

Confirm? (y/n): y
```

**Notes**:
- You must have sufficient collateral
- Borrow increases your debt and decreases health factor
- Variable rates fluctuate with market conditions
- Stable rates are fixed but typically higher
- Interest accrues continuously

---

### `repay <amount|max> <asset>`

Repay your borrowed assets.

**Syntax**:
```bash
repay <amount> <asset>
repay max <asset>
```

**Arguments**:
- `amount` - Amount to repay, or `max` for full debt
- `asset` - Asset to repay

**Example**:
```bash
# Partial repayment
aave-v3> repay 100 USDC
Repay 100 USDC:
  Current debt: 500 USDC
  After repayment: 400 USDC

  Health factor after: 3.78 (Healthy)
  Interest saved: ~5.12 USDC/year

Confirm? (y/n): y

# Full repayment
aave-v3> repay max USDC
Repay all USDC debt:
  Principal: 500 USDC
  Interest accrued: 2.15 USDC
  Total to repay: 502.15 USDC

  Health factor after: 4.25 (Healthy)

Confirm? (y/n): y
```

---

## Supported Assets

Aave V3 supports major crypto assets (varies by network):

**Common Assets**:
- ETH, WETH
- wstETH (Lido Staked ETH)
- USDC, USDT, DAI
- WBTC
- LINK, AAVE, UNI
- Other major tokens

Check available assets:
```bash
aave-v3> rates
# Lists all available assets for current network
```

---

## Multi-Network Support

Aave V3 is deployed on multiple networks:

- Ethereum Mainnet
- Optimism
- Arbitrum
- Polygon
- Base
- Avalanche
- More coming soon

Switch networks in your wallet to access different markets.

---

## Best Practices

### 1. Maintain Healthy Collateralization

```bash
# Always check health factor before borrowing
aave-v3> position
Health Factor: 3.45

# Keep health factor above 2.0 for safety
aave-v3> borrow 100 USDC
New Health Factor: 3.21 ✓
```

### 2. Monitor Interest Rates

```bash
# Check rates regularly
aave-v3> rates

# Supply when rates are high
# Borrow when rates are low
```

### 3. Use Stable Rates for Predictability

```bash
# Lock in rates if you expect increases
aave-v3> borrow 1000 USDC --rate stable
Stable APY: 5.50% (won't change)
```

### 4. Diversify Collateral

```bash
# Supply multiple assets to reduce risk
aave-v3> supply 1 ETH
aave-v3> supply 1000 USDC
aave-v3> supply 0.01 WBTC
```

---

## Risk Management

### Understanding Health Factor

**Health Factor Formula**:
```
Health Factor = (Collateral × Liquidation Threshold) / Total Borrowed
```

**Risk Levels**:
- **> 3.0**: Very safe
- **2.0 - 3.0**: Safe
- **1.5 - 2.0**: Moderate risk
- **1.0 - 1.5**: High risk - monitor closely
- **< 1.0**: Liquidation zone

### Avoiding Liquidation

```bash
# Monitor health regularly
aave-v3> health
Health Factor: 1.25 ⚠️  High Risk

# Improve health by:
# 1. Supply more collateral
aave-v3> supply 0.5 ETH

# 2. Repay debt
aave-v3> repay 200 USDC

# 3. Check improved health
aave-v3> health
Health Factor: 2.15 ✓ Safe
```

---

## Error Handling

### Common Errors

**Insufficient Collateral**:
```bash
aave-v3> borrow 10000 USDC
Error: Insufficient collateral
Max borrowable: 1,245.67 USDC
Supply more collateral to borrow more
```

**Health Factor Too Low**:
```bash
aave-v3> withdraw 5 ETH
Error: Withdrawal would cause liquidation
Health factor after: 0.85 (< 1.0)
Repay debt or withdraw less
```

**Asset Not Supported**:
```bash
aave-v3> supply 100 SHIB
Error: SHIB not supported on this network
Supported assets: ETH, USDC, USDT, DAI, WBTC...
```

---

## See Also

- [Global Commands](./global-commands.md) - Core terminal commands
- [1inch Commands](./1inch.md) - Token swaps
- [Aave Tutorial](../tutorials/aave-lending.md) - Step-by-step lending guide
- [User Guide](../user-guide.md) - Complete interface guide
