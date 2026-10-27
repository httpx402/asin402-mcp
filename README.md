# ASIN402 MCP server

Give Claude, Cursor or any MCP-compatible AI assistant **live Amazon product data**: prices and price history, deal verdicts, FBA profit, selling-opportunity scores, keyword search, a Product Finder with 300+ filters, price drops, best sellers, sellers and categories, across 11 Amazon marketplaces.

No account and no subscription. Each tool call is paid automatically in USDC on Base from your own wallet through the [x402](https://x402.org) protocol, typically $0.005–$0.10 per call, within limits you set.

## Tools

| Tool | What it does | Typical cost |
|---|---|---|
| `check_deal` | Is this price a deal? Verdict + 30/90/180-day comparison | $0.02 |
| `sell_score` | 0-100 selling opportunity score with risk flags | $0.10 |
| `fba_profit` | FBA fees, net profit, margin, ROI, break-even | $0.05 |
| `product_snapshot` | Current prices, rank, monthly sales, rating | $0.01 |
| `get_products` | Full data for 1-100 products (history, offers, buy box, stock…) | from $0.005 |
| `search_products` | Keyword search | from $0.005 |
| `find_products` | Product Finder: filter the whole catalog | from $0.005 |
| `find_deals` | Recent price drops with filters | from $0.005 |
| `best_sellers` | Best sellers for a category | from $0.005 |
| `seller_info` | Seller details and storefront | from $0.005 |
| `category_info` / `search_categories` | Category details / find category IDs | $0.005 |
| `top_sellers` | Most-rated sellers | from $0.005 |
| `wallet_status` | Your balance and spending (free) | free |

Failed calls (invalid input, no data, service errors) are never charged.

## Setup

**1. Create a dedicated wallet** (MetaMask, Rabby, Coinbase Wallet…), export its private key, and send it **a few dollars of USDC on the Base network**. Use a separate, small wallet: never your main one.

**2. Add the server to your assistant.**

Claude Desktop (`Settings → Developer → Edit Config`, file `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "asin402": {
      "command": "npx",
      "args": ["-y", "asin402-mcp"],
      "env": {
        "ASIN402_PRIVATE_KEY": "0xYOUR_DEDICATED_WALLET_PRIVATE_KEY",
        "ASIN402_BUDGET": "5",
        "ASIN402_MAX_PER_CALL": "0.25"
      }
    }
  }
}
```

Cursor (`~/.cursor/mcp.json`) and most other MCP clients use the same block.

**3. Restart the assistant** and ask things like:
- "Is 059035342X a good deal right now?"
- "Should I sell ASIN 0735211299 on Amazon FBA if it costs me $4.50?"
- "Find kitchen products under $40 with 300+ monthly sales, fewer than 8 sellers and no Amazon offer."
- "What are today's biggest buy box price drops on 4-star products?"

## Spending limits

| Variable | Default | Meaning |
|---|---|---|
| `ASIN402_PRIVATE_KEY` | required | Wallet that pays (USDC on Base) |
| `ASIN402_BUDGET` | `5` | Max USD per session (until the assistant restarts) |
| `ASIN402_MAX_PER_CALL` | `0.25` | Max USD for any single call |

Calls that would exceed a limit are refused before anything is paid. Payments only go to the ASIN402 service on Base; the key never leaves your computer.

## Links

- Service and pricing: https://asin402.com
- Agent instructions: https://asin402.com/llms.txt · Skill: https://asin402.com/skill.md
