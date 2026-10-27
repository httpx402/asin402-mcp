# ASIN402 listing kit (copy/paste)

Replace YOURNAME with your GitHub username everywhere below.

## Common text

- Name: ASIN402 Amazon Data
- Short (under 100 chars): Live Amazon data for AI agents: prices, history, deals, FBA profit, sell scores. Pay per call.
- Website: https://asin402.com
- GitHub: https://github.com/YOURNAME/asin402-mcp
- npm: asin402-mcp
- MCP Registry: com.asin402/mcp
- Network: Base mainnet, USDC, x402 v2
- Tags: amazon, e-commerce, price-history, fba, product-research, x402, mcp

Long description:
ASIN402 gives AI agents live Amazon product data across 11 marketplaces: current prices and full price history, "is this a deal?" verdicts, FBA profit calculations, 0-100 selling-opportunity scores, keyword search, a Product Finder with 300+ filters, recent price drops, best sellers, sellers and categories. No account, no API key: each call is paid in USDC on Base with x402 (typically $0.005-$0.10). Invalid requests and failed calls are never charged. Use it over HTTP or through the MCP server (npx asin402-mcp).

Install block:
{
  "mcpServers": {
    "asin402": {
      "command": "npx",
      "args": ["-y", "asin402-mcp"],
      "env": { "ASIN402_PRIVATE_KEY": "0xYOUR_DEDICATED_WALLET_KEY", "ASIN402_BUDGET": "5" }
    }
  }
}

Tools: check_deal, sell_score, fba_profit, product_snapshot, get_products, search_products, find_products, find_deals, best_sellers, seller_info, category_info, search_categories, top_sellers, wallet_status

---

## x402 directories (no GitHub needed)

### 1. x402scan
Go to https://www.x402scan.com/resources/register and submit these URLs one at a time:
- https://asin402.com/api/deal-check?asin=0735211299
- https://asin402.com/api/sell-score?asin=0735211299
- https://asin402.com/api/fba-profit?asin=0735211299&cost=5
- https://asin402.com/api/product?asin=0735211299
- https://asin402.com/api/data/product?asin=0735211299
- https://asin402.com/api/data/search?term=water%20bottle
- https://asin402.com/api/data/bestsellers?category=3375251

### 2. 402 Index (402index.io)
Use its submit/register option with https://asin402.com/api/deal-check?asin=0735211299 (repeat for the URLs above), provider "ASIN402", category "data" or "e-commerce". If it offers domain verification, verify asin402.com so the listings go live immediately.

### 3. awesome-x402 (github.com/xpaysh/awesome-x402)
Pull request title: Add ASIN402 - pay-per-call Amazon data API for AI agents (x402 v2, Base)
Line to add under the production services / data APIs section:

- [ASIN402](https://asin402.com) - Live Amazon product data for AI agents: prices, price history, deal verdicts, FBA profit, sell scores, Product Finder with 300+ filters. x402 v2 on Base, $0.005-$0.10 per call. MCP server: `npx asin402-mcp`.

### 4. CDP Discord (discord.com/invite/cdp), x402 channel
Short post:

Built ASIN402: live Amazon data for agents over x402 v2 on Base. Prices + full history, deal verdicts, FBA profit, sell scores, and a Product Finder with 300+ filters. $0.005-$0.10 per call, nothing charged on failures, listed in the Bazaar. HTTP: https://asin402.com/llms.txt · MCP: npx asin402-mcp. Feedback welcome.

---

## MCP directories (need the GitHub repo first)

### 5. Glama (glama.ai/mcp/servers)
Glama picks up public MCP repos automatically; to speed it up, use "Add Server" and paste https://github.com/YOURNAME/asin402-mcp. The Dockerfile in the repo lets Glama build it and give it a score. Then claim the server with your GitHub login.

### 6. awesome-mcp-servers (github.com/punkpeye/awesome-mcp-servers)
Wait until Glama shows the server (they ask for the Glama badge). Pull request title: Add ASIN402 (Amazon data, pay per call)
Line to add in the closest category (e-commerce/shopping if present, otherwise data/finance), in alphabetical order:

- [YOURNAME/asin402-mcp](https://github.com/YOURNAME/asin402-mcp) [![asin402-mcp MCP server](https://glama.ai/mcp/servers/YOURNAME/asin402-mcp/badges/score.svg)](https://glama.ai/mcp/servers/YOURNAME/asin402-mcp) 📇 ☁️ - Live Amazon product data: prices, price history, deal verdicts, FBA profit and opportunity scores, Product Finder. Paid per call in USDC via x402.

### 7. mcp.so
Click "Submit", paste https://github.com/YOURNAME/asin402-mcp, use the short description and tags above.

### 8. Smithery (smithery.ai)
Sign in with GitHub, "Add server", pick the asin402-mcp repo. smithery.yaml is already in the repo. Mark ASIN402_PRIVATE_KEY as the secret config field.
