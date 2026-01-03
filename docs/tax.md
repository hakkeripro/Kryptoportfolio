# Tax module (v3)

This document describes the **Tax** feature in Kryptoportfolio v3.

## Source of truth

- The **ledger** is append-only and is the single source of truth.
- Tax reports are **derived** by replaying the ledger with the selected **tax profile** and **lot method**.

## What is included (MVP)

For a selected tax year, the app generates:

1. **Realized gains (disposals)**
   - Includes `SELL` and the **disposal leg** of `SWAP`.
   - Outputs: disposed date, proceeds (base), cost basis (base), fees (base), gain/loss (base), lots matched.

2. **Income report (rewards / airdrops)**
   - Includes `REWARD`, `STAKING_REWARD`, `AIRDROP`.
   - If `settings.rewardsCostBasisMode = FMV`, income is the FMV in base currency.
   - If `ZERO`, income is reported as 0.

3. **Year-end holdings**
   - Positions at the end of the tax year (amount + cost basis).

Exports:

- **CSV**: multi-section CSV (disposals + income + year-end holdings).
- **PDF**: printable summary (opens a print dialog; user can save to PDF).

## Tax profiles

- `GENERIC`: uses `settings.lotMethodDefault`.
- `FINLAND`: forces `FIFO` for tax calculations.

> Note: This feature is a calculation tool and is **not tax advice**.
