# Tutorial: Lending and Borrowing with Aave V3

This tutorial will guide you through supplying assets to earn interest and borrowing against your collateral using Aave V3.

## What You'll Learn

- How to supply assets to Aave to earn interest
- How to use supplied assets as collateral
- How to borrow against your collateral
- How to monitor your health factor
- How to repay loans and withdraw assets

## Prerequisites

- Connected wallet with assets (ETH, USDC, etc.)
- Understanding of DeFi lending concepts
- Knowledge of liquidation risks

## Key Concepts

### Supply & Earn
- Deposit assets to earn interest
- Interest accrues in real-time
- Assets can be used as collateral

### Borrow
- Borrow against your collateral
- Pay interest on borrowed amount
- Must maintain health factor > 1.0

### Health Factor
- Indicates your loan health
- **> 2.0**: Safe
- **1.0 - 2.0**: Moderate risk
- **< 1.0**: Liquidation zone

## Example 1: Supply ETH to Earn Interest

### Step 1: Enter Aave V3 Context

```bash
> use aave-v3
Switched to aave-v3 protocol
```

### Step 2: Check Current Rates

```bash
aave-v3> rates
Ethereum Mainnet Rates:

Asset       Supply APY    Borrow APY (Variable)
-----------------------------------------------
ETH         2.34%         2.89%
USDC        4.56%         5.12%
USDT        4.23%         4.98%
DAI         3.98%         4.67%
WBTC        0.45%         1.23%
```

ETH is earning 2.34% APY - let's supply!

### Step 3: Check Your Balance

```bash
> balance
Balance: 5.0 ETH
```

### Step 4: Supply ETH as Collateral

```bash
aave-v3> supply 2 ETH
Supply 2 ETH to Aave V3:
  Current APY: 2.34%
  Projected Earnings: ~0.0468 ETH/year ($161.74/year)
  Will be used as collateral: Yes

Confirm? (y/n): y

Transaction submitted: 0xabc123...
⏳ Waiting for confirmation...
✓ Success! 2 ETH supplied

You're now earning 2.34% APY on 2 ETH
Collateral value: $6,913.56
```

### Step 5: Check Your Position

```bash
aave-v3> position
Your Aave V3 Position (Ethereum):

Supplied:
  2 ETH          $6,913.56 (used as collateral)
  Total Supplied: $6,913.56

Borrowed:
  None

Net Worth: $6,913.56
Available to Borrow: $5,191.67 (75% LTV)
Health Factor: ∞ (No debt)
```

Congratulations! You're now earning interest on your ETH.

## Example 2: Borrow USDC Against ETH Collateral

Now that you have collateral, you can borrow against it.

### Step 1: Check How Much You Can Borrow

```bash
aave-v3> position
Available to Borrow: $5,191.67 (75% LTV)
```

You can borrow up to 75% of your collateral value, but it's safer to borrow less.

### Step 2: Borrow USDC

Let's borrow $2,000 USDC (about 29% of collateral value):

```bash
aave-v3> borrow 2000 USDC
Borrow 2000 USDC:
  Current APY: 5.12% (variable)
  Projected Interest: ~102.40 USDC/year

Position After Borrow:
  Total Borrowed: 2,000 USDC
  Health Factor: 2.59 (Healthy ✓)
  Available to borrow: $3,191.67

Confirm? (y/n): y

Transaction submitted: 0xdef456...
✓ Success! 2,000 USDC borrowed

Your Health Factor: 2.59 (Safe ✓)
```

### Step 3: Verify You Received USDC

```bash
aave-v3> exit
> balance USDC
Balance: 2,000 USDC ✓
```

The borrowed USDC is now in your wallet!

### Step 4: Monitor Your Health Factor

```bash
> use aave-v3
aave-v3> health
Health Factor: 2.59

Status: Healthy ✓
Liquidation Risk: Low
Liquidation Price: $1,157.40 (per ETH)

Your position is safe. Health factor above 1.0.
Liquidation occurs below 1.0.

Health Levels:
  > 2.0:  Healthy (Low risk) ← You are here
  1.5-2.0: Moderate risk
  1.0-1.5: High risk
  < 1.0:  Liquidation zone
```

Your position is healthy! Liquidation would only occur if ETH drops below $1,157.40.

## Example 3: Repay Loan and Withdraw

### Step 1: Repay Part of Your Loan

Let's repay 500 USDC:

```bash
aave-v3> repay 500 USDC
Repay 500 USDC:
  Current debt: 2,000 USDC
  After repayment: 1,500 USDC

  Health factor after: 3.45 (Healthy ✓)
  Interest saved: ~25.60 USDC/year

Confirm? (y/n): y

Approve USDC spending? (y/n): y
Approving USDC...
✓ Approved

Repaying 500 USDC...
✓ Success! 500 USDC repaid

New debt: 1,500 USDC
New health factor: 3.45 ✓
```

### Step 2: Repay Remaining Debt

Let's repay the rest using the `max` keyword:

```bash
aave-v3> repay max USDC
Repay all USDC debt:
  Principal: 1,500 USDC
  Interest accrued: 2.84 USDC
  Total to repay: 1,502.84 USDC

  Health factor after: ∞ (No debt)

Confirm? (y/n): y

✓ Success! All USDC debt repaid
You now have no outstanding loans
```

### Step 3: Withdraw Your Supplied ETH

Now that you have no debt, you can withdraw:

```bash
aave-v3> withdraw 1 ETH
Withdraw 1 ETH from Aave V3:
  Supplied: 2 ETH
  Available to withdraw: 2 ETH
  After withdrawal: 1 ETH supplied

  Interest earned: 0.0023 ETH ($7.95)

Confirm? (y/n): y

✓ Success! 1 ETH withdrawn
Remaining supplied: 1 ETH
```

Or withdraw everything:

```bash
aave-v3> withdraw max ETH
Withdraw all ETH (1.0023 ETH):
  Principal: 1 ETH
  Interest earned: 0.0023 ETH ($7.95)

Confirm? (y/n): y

✓ Success! All ETH withdrawn
Total received: 1.0023 ETH
```

## Understanding Health Factor

Your health factor determines liquidation risk:

```
Health Factor = (Collateral × Liquidation Threshold) / Total Borrowed
```

### Example Calculation

```
Collateral: 2 ETH @ $3,456.78 = $6,913.56
Liquidation Threshold: 82.5% (for ETH)
Borrowed: $2,000 USDC

Health Factor = ($6,913.56 × 0.825) / $2,000
             = $5,703.69 / $2,000
             = 2.85
```

### What Affects Health Factor?

1. **ETH Price Drops** → Health factor decreases
2. **Borrow More** → Health factor decreases
3. **Repay Debt** → Health factor increases
4. **Supply More** → Health factor increases

### Managing Low Health Factor

If your health factor drops below 2.0:

```bash
aave-v3> health
Health Factor: 1.25 ⚠️  High Risk

# Option 1: Supply more collateral
aave-v3> supply 0.5 ETH

# Option 2: Repay some debt
aave-v3> repay 500 USDC

# Check improved health
aave-v3> health
Health Factor: 2.15 ✓ Safe
```

## Advanced: Variable vs Stable Rates

### Variable Rate (Default)
- Changes with market conditions
- Usually lower
- Good when rates are falling

```bash
aave-v3> borrow 1000 USDC
Current APY: 5.12% (variable)
# Rate may go up or down
```

### Stable Rate
- Fixed rate (doesn't change much)
- Usually higher
- Good when rates are rising

```bash
aave-v3> borrow 1000 USDC --rate stable
Stable APY: 5.50%
Variable APY: 5.12%

Stable rate protects you from rate increases.

Confirm? (y/n): y
```

## Multi-Network Usage

Aave V3 is on multiple networks. Switch networks in your wallet:

```bash
# On Ethereum
aave-v3> position
Your Position (Ethereum): ...

# Switch wallet to Optimism
aave-v3> position
Your Position (Optimism): ...

# Check all markets
aave-v3> markets
Available Aave V3 Markets:
1. Ethereum Mainnet - $8.5B
2. Optimism - $156M
3. Arbitrum - $234M
4. Polygon - $89M
5. Base - $67M
```

## Risk Management Best Practices

### 1. Keep Health Factor > 2.0

```bash
# Good: Conservative borrowing
Collateral: $10,000
Borrowed: $2,000
Health Factor: 4.0+ ✓

# Risky: Aggressive borrowing
Collateral: $10,000
Borrowed: $7,000
Health Factor: 1.15 ⚠️
```

### 2. Diversify Collateral

```bash
# Better risk distribution
aave-v3> supply 1 ETH
aave-v3> supply 1000 USDC
aave-v3> supply 0.01 WBTC
```

### 3. Monitor Regularly

```bash
# Check daily or after major price moves
aave-v3> position
aave-v3> health
```

### 4. Set Alerts

If ETH drops significantly:
1. Supply more collateral
2. Repay some debt
3. Or be ready to act quickly

## Troubleshooting

### "Insufficient Collateral" Error

```bash
aave-v3> borrow 10000 USDC
Error: Insufficient collateral
Max borrowable: 5,191.67 USDC

Solution: Supply more collateral or borrow less
```

### "Would Cause Liquidation" Error

```bash
aave-v3> withdraw 1.5 ETH
Error: Withdrawal would cause liquidation
Health factor after: 0.85 (< 1.0)

Solution: Repay debt first, then withdraw
```

### Interest Accumulation

```bash
# Interest accrues every block
aave-v3> position
Borrowed: 2,000.00 USDC

# 1 hour later
aave-v3> position
Borrowed: 2,000.58 USDC (+0.58 in interest)

# Repay includes interest
aave-v3> repay max USDC
Total to repay: 2,000.58 USDC
```

## Quick Reference

```bash
# Essential Aave commands
use aave-v3
markets                    # List all markets
rates [network]           # Show APY rates
position                  # Your position
health                    # Health factor

supply <amount> <asset>   # Supply & earn
withdraw <amount> <asset> # Withdraw
borrow <amount> <asset>   # Borrow
repay <amount> <asset>    # Repay

# Advanced
supply 1 ETH --collateral    # Supply as collateral
borrow 1000 USDC --rate stable  # Stable rate
withdraw max ETH          # Withdraw all
repay max USDC            # Repay all
```

## Safety Checklist

Before borrowing, ensure:
- [ ] Health factor will be > 2.0
- [ ] You understand liquidation risk
- [ ] You can monitor your position regularly
- [ ] You have a repayment plan
- [ ] You're comfortable with variable rates (or use stable)

## Next Steps

- **[Aave V3 Commands](../commands/aave-v3.md)** - Full command reference
- **[Swapping Tokens](./swapping-tokens.md)** - Swap borrowed assets
- **[Risk Management](../faq.md#aave-risks)** - Understanding risks

Happy lending!
