#!/usr/bin/env node
// ASIN402 MCP server: gives AI assistants (Claude, Cursor, ...) live Amazon product data.
// Each tool call is paid automatically in USDC on Base from YOUR wallet via the x402 protocol,
// within the per-call cap and session budget you set.
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const { privateKeyToAccount } = require("viem/accounts");
const { createPublicClient, http, parseAbi } = require("viem");
const { base, baseSepolia } = require("viem/chains");
const { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } = require("@x402/fetch");
const { ExactEvmScheme } = require("@x402/evm/exact/client");
const { AsyncLocalStorage } = require("async_hooks");
const callContext = new AsyncLocalStorage(); // tracks the exact amount authorized within each tool call

const VERSION = "1.0.0";
const API = (process.env.ASIN402_URL || "https://asin402.com").replace(/\/$/, "");
const TESTNET = process.env.ASIN402_NETWORK === "base-sepolia";
const NETWORK = TESTNET ? "eip155:84532" : "eip155:8453";
const USDC = TESTNET ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e" : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MAX_PER_CALL = Number(process.env.ASIN402_MAX_PER_CALL || "0.25"); // USD
const BUDGET = Number(process.env.ASIN402_BUDGET || "5"); // USD per session (until the assistant restarts)
const KEY = (process.env.ASIN402_PRIVATE_KEY || "").trim();

let account = null;
if (KEY) {
  try { account = privateKeyToAccount(KEY.startsWith("0x") ? KEY : `0x${KEY}`); }
  catch { console.error("[asin402] ASIN402_PRIVATE_KEY is not a valid private key"); }
}

const session = { spent: 0, reserved: 0, calls: 0, payments: [] };
const usd = (atomic) => Number(atomic) / 1e6;

let payFetch = null;
if (account) {
  const client = x402Client.fromConfig({
    schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }], // only Base (or Base Sepolia in test mode)
    spendControls: { maxAmountPerPayment: `$${MAX_PER_CALL}` },
  });
  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    const price = usd(selectedRequirements.amount);
    if (price > MAX_PER_CALL) return { abort: true, reason: `Price $${price} exceeds the per-call cap of $${MAX_PER_CALL} (ASIN402_MAX_PER_CALL).` };
    if (session.spent + session.reserved + price > BUDGET + 1e-9) return { abort: true, reason: `Session budget reached: spent $${session.spent.toFixed(3)} of $${BUDGET} (ASIN402_BUDGET). Restart the assistant or raise the budget.` };
    const ctx = callContext.getStore();
    if (ctx) { ctx.authorized = price; session.reserved += price; }
  });
  payFetch = wrapFetchWithPayment(fetch, client);
}

const NO_WALLET = [
  "No wallet configured, so paid ASIN402 tools are unavailable.",
  "Set ASIN402_PRIVATE_KEY in this MCP server's environment to the private key of a wallet holding a few dollars of USDC on Base.",
  "Use a dedicated wallet with a small balance, never your main wallet. Optional: ASIN402_MAX_PER_CALL (default 0.25) and ASIN402_BUDGET (default 5) in USD.",
].join(" ");

const MAX_TEXT = Number(process.env.ASIN402_MAX_RESPONSE_CHARS || 60000);
const text = (obj) => {
  let s = typeof obj === "string" ? obj : JSON.stringify(obj, null, 1);
  if (s.length > MAX_TEXT) s = s.slice(0, MAX_TEXT) + `\n... [truncated ${s.length - MAX_TEXT} chars; request fewer items, history=false, or fewer series]`;
  return { content: [{ type: "text", text: s }] };
};
const fail = (msg) => ({ content: [{ type: "text", text: msg }], isError: true });

function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    u.set(k, typeof v === "boolean" ? (v ? "1" : "0") : Array.isArray(v) ? v.join(",") : typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

async function call(path, params = {}, body) {
  if (!payFetch) return fail(NO_WALLET);
  const ctx = { authorized: 0 };
  try { return await callContext.run(ctx, () => doCall(path, params, body, ctx)); }
  finally { session.reserved = Math.max(0, session.reserved - ctx.authorized); }
}

async function doCall(path, params, body, ctx) {
  const url = API + path + qs(params);
  let res;
  try {
    res = await payFetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  } catch (e) {
    const m = String(e.message || e);
    if (/budget reached/i.test(m)) return fail(m.slice(m.indexOf("Session budget")));
    if (/rejected by spend controls|All payment requirements were rejected/i.test(m)) return fail(`This call costs more than your per-call cap of $${MAX_PER_CALL} (ASIN402_MAX_PER_CALL), so it was not paid.`);
    if (/per-call cap/i.test(m)) return fail(m.slice(m.indexOf("Price")));
    return fail(`Payment or network error (not charged): ${m}`);
  }
  session.calls++;
  const receipt = res.headers.get("payment-response");
  let paid = 0;
  if (receipt) {
    try {
      const r = decodePaymentResponseHeader(receipt);
      if (r.success) {
        paid = ctx.authorized; // exact amount signed for this call; only counted once settled
        session.payments.push({ path, usd: paid, tx: r.transaction });
      }
    } catch { /* ignore malformed receipt */ }
  }
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  session.spent = Math.round((session.spent + paid) * 1e6) / 1e6;
  if (res.status === 402) return fail(`Payment was not completed: ${typeof data === "object" ? JSON.stringify(data) : raw}`.slice(0, 2000));
  if (res.status >= 400) return fail(`ASIN402 error ${res.status} (you were not charged): ${typeof data === "object" ? data.error || JSON.stringify(data) : raw}`.slice(0, 2000));
  if (data && typeof data === "object" && !Array.isArray(data)) data._session = { paid_usd: paid, spent_this_session_usd: session.spent, budget_usd: BUDGET };
  return text(data);
}

// ---------- Schemas ----------
const asin = z.string().regex(/^[A-Za-z0-9]{10}$/, "10-character ASIN (books: ISBN-10)").describe("Amazon ASIN, e.g. 0735211299");
const domain = z.enum(["us", "uk", "de", "fr", "jp", "ca", "it", "es", "in", "mx", "br"]).optional().describe("Amazon marketplace, default us");
const ro = { readOnlyHint: true, openWorldHint: true };

const server = new McpServer({ name: "asin402", version: VERSION });

// ---------- Ready-made answers ----------
server.registerTool("check_deal", {
  title: "Is this Amazon price a deal?",
  description: "Compare an Amazon product's current price with its 30/90/180-day averages and typical range (outliers filtered). Returns verdict buy_now, fair_price, wait or verify_offer with the numbers behind it. Costs $0.02.",
  inputSchema: { asin, domain }, annotations: ro,
}, async ({ asin, domain }) => call("/api/deal-check", { asin, domain }));

server.registerTool("sell_score", {
  title: "Amazon selling opportunity score",
  description: "Score 0-100 for how good an Amazon product is to sell: demand, competition, Amazon on the listing, price stability, review moat, price fit, plus plain-language risk flags. Costs $0.10.",
  inputSchema: { asin, domain }, annotations: ro,
}, async ({ asin, domain }) => call("/api/sell-score", { asin, domain }));

server.registerTool("fba_profit", {
  title: "Amazon FBA profit calculator",
  description: "Referral fee, FBA fee, net profit, margin, ROI, break-even cost and max landed cost for 30% ROI for selling a product via Amazon FBA. Costs $0.05.",
  inputSchema: {
    asin, domain,
    cost: z.number().nonnegative().optional().describe("Your unit cost of goods (USD)"),
    shipping: z.number().nonnegative().optional().describe("Inbound shipping per unit"),
    price: z.number().positive().optional().describe("Override the sell price (default: current buy box)"),
  }, annotations: ro,
}, async (a) => call("/api/fba-profit", a));

server.registerTool("product_snapshot", {
  title: "Amazon product snapshot",
  description: "Current price (buy box, Amazon, lowest new/used), sales rank, estimated monthly sales, rating, reviews and offer count for one product. Costs $0.01.",
  inputSchema: { asin, domain }, annotations: ro,
}, async ({ asin, domain }) => call("/api/product", { asin, domain }));

// ---------- Full data ----------
server.registerTool("get_products", {
  title: "Full Amazon product data",
  description: "Everything tracked for 1-100 products: details, categories, images, dimensions, fees, statistics, price and sales-rank history, buy box, live offers, stock, rating history. Price follows data cost (from ~$0.005; offers/buybox/rating add cost). Use history=false for current data only.",
  inputSchema: {
    asins: z.array(asin).min(1).max(100).optional().describe("ASINs (use asins OR codes)"),
    codes: z.array(z.string()).min(1).max(100).optional().describe("UPC/EAN/ISBN-13 codes"),
    domain,
    history: z.boolean().optional().describe("Include price/rank history (default false here to keep responses small)"),
    days: z.number().int().positive().optional().describe("Limit history to last N days"),
    series: z.string().optional().describe('History series, comma-separated, or "all". Default BUY_BOX_SHIPPING,AMAZON,NEW,SALES_RANK'),
    stats: z.number().int().min(0).optional().describe("Statistics window in days (default 180, 0 = off)"),
    offers: z.number().int().min(20).max(100).optional().describe("Fetch live marketplace offers (costs more, 2-20s)"),
    only_live_offers: z.boolean().optional(),
    buybox: z.boolean().optional().describe("Buy box price/winner history and stats (+cost)"),
    rating: z.boolean().optional().describe("Rating and review-count history (+cost)"),
    stock: z.boolean().optional().describe("With offers: stock per offer (+cost)"),
    update: z.number().int().min(-1).optional().describe("Refresh data older than N hours; 0 = force live refresh (+cost)"),
    format: z.enum(["clean", "raw"]).optional(),
  }, annotations: ro,
}, async (a) => {
  if (!a.asins && !a.codes) return fail("Provide asins or codes.");
  const { asins, codes, history, ...rest } = a;
  return call("/api/data/product", { asin: asins, code: codes, history: history ? 1 : 0, ...rest });
});

server.registerTool("search_products", {
  title: "Search Amazon by keyword",
  description: "Keyword search like the Amazon search bar; up to 10 full products per page with stats. Costs ~$0.005-0.02 per page.",
  inputSchema: { term: z.string().min(2), page: z.number().int().min(0).max(9).optional(), domain, history: z.boolean().optional() },
  annotations: ro,
}, async ({ term, page, domain, history }) => call("/api/data/search", { term, page, domain, history: history ? 1 : 0 }));

server.registerTool("find_products", {
  title: "Product Finder (filter the whole Amazon catalog)",
  description: `Find ASINs matching filters: price, sales rank, monthly sales, offer counts, buy box share, Amazon presence, brand, category, rating, dimensions, price drops, stock and more. Prices in cents. Example selection: {"current_SALES_lte":20000,"current_BUY_BOX_SHIPPING_gte":2000,"buyBoxIsAmazon":false,"totalOfferCount_lte":8,"monthlySold_gte":300,"perPage":50,"sort":[["monthlySold","desc"]]}. All fields: ${API}/docs/finder. Returns ASINs; get details with get_products. From ~$0.005.`,
  inputSchema: { selection: z.record(z.any()).describe("Product Finder query object"), stats: z.boolean().optional().describe("Aggregate insights for all matches (+cost)"), domain },
  annotations: ro,
}, async ({ selection, stats, domain }) => call("/api/data/finder", { stats: stats ? 1 : undefined, domain }, selection));

server.registerTool("find_deals", {
  title: "Recent Amazon price drops",
  description: `Products whose price recently dropped, with filters (category, discount %, price range, rating, lowest-ever, Amazon offer). selection must include priceTypes with exactly one value: 0 Amazon, 1 New, 18 Buy box, 8 Lightning deal, 9 Warehouse. Example: {"priceTypes":[18],"dateRange":0,"isFilterEnabled":true,"minRating":40,"isRangeEnabled":true,"deltaPercentRange":[30,100]}. All fields: ${API}/docs/deals. ~$0.005 per page.`,
  inputSchema: { selection: z.record(z.any()), domain },
  annotations: ro,
}, async ({ selection, domain }) => call("/api/data/deals", { domain }, selection));

server.registerTool("best_sellers", {
  title: "Amazon best sellers for a category",
  description: "Ordered best-seller ASINs for a category ID (get IDs with search_categories), by current rank or 30/90/180-day average or a past month. ~$0.007.",
  inputSchema: {
    category: z.string().describe("Category ID or product group name"),
    range: z.union([z.literal(0), z.literal(30), z.literal(90), z.literal(180)]).optional(),
    month: z.number().int().min(1).max(12).optional(), year: z.number().int().optional(),
    variations: z.boolean().optional(), sublist: z.boolean().optional(),
    limit: z.number().int().min(1).max(10000).optional().describe("Return top N (default 100)"),
    domain,
  }, annotations: ro,
}, async (a) => call("/api/data/bestsellers", { ...a, limit: a.limit ?? 100 }));

server.registerTool("seller_info", {
  title: "Amazon seller info",
  description: "Seller name, ratings and FBA usage for up to 100 sellers; storefront=true adds the seller's ASIN list (single seller). From ~$0.005.",
  inputSchema: { seller: z.string().describe("Seller ID or comma-separated IDs"), storefront: z.boolean().optional(), domain },
  annotations: ro,
}, async (a) => call("/api/data/seller", a));

server.registerTool("category_info", {
  title: "Amazon category details",
  description: "Name, parent, children and stats for category IDs (0 = all root categories). From ~$0.005.",
  inputSchema: { category: z.string(), parents: z.boolean().optional(), domain },
  annotations: ro,
}, async (a) => call("/api/data/category", a));

server.registerTool("search_categories", {
  title: "Find Amazon category IDs",
  description: "Search Amazon categories by name to get IDs for best_sellers, find_products and find_deals. ~$0.005.",
  inputSchema: { term: z.string().min(2), domain },
  annotations: ro,
}, async (a) => call("/api/data/category-search", a));

server.registerTool("top_sellers", {
  title: "Most-rated Amazon sellers",
  description: "Seller IDs with the most ratings in a marketplace. ~$0.007.",
  inputSchema: { limit: z.number().int().min(1).max(10000).optional(), domain },
  annotations: ro,
}, async (a) => call("/api/data/topsellers", { ...a, limit: a.limit ?? 100 }));

// ---------- Free ----------
server.registerTool("wallet_status", {
  title: "ASIN402 wallet and spending",
  description: "Free. Shows the paying wallet address, its USDC balance on Base, spending this session and remaining budget.",
  inputSchema: {}, annotations: { readOnlyHint: true, openWorldHint: true },
}, async () => {
  if (!account) return fail(NO_WALLET);
  let balance = null;
  try {
    const pc = createPublicClient({ chain: TESTNET ? baseSepolia : base, transport: http() });
    const b = await pc.readContract({ address: USDC, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [account.address] });
    balance = usd(b);
  } catch { /* RPC unavailable */ }
  return text({
    wallet: account.address, network: TESTNET ? "Base Sepolia (testnet)" : "Base", usdc_balance: balance,
    spent_this_session_usd: session.spent, budget_usd: BUDGET, remaining_usd: Math.max(0, Math.round((BUDGET - session.spent) * 1e6) / 1e6),
    max_per_call_usd: MAX_PER_CALL, paid_calls: session.payments.length, service: API,
  });
});

(async () => {
  await server.connect(new StdioServerTransport());
  console.error(`[asin402] MCP server ${VERSION} ready | ${API} | ${account ? "wallet " + account.address : "no wallet (paid tools disabled)"} | cap $${MAX_PER_CALL}/call, budget $${BUDGET}/session`);
})().catch((e) => { console.error("[asin402] fatal:", e); process.exit(1); });
