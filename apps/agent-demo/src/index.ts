import { parseArgs } from "./args.js";
import { contentUrl, fetchCatalog, fetchQuote, parseUnlockResponse } from "./catalog.js";
import { loadAgentEnv } from "./env.js";
import { createGatewayPaymentClient, ensureGatewayBalance } from "./gateway.js";
import { scoreRelevance } from "./relevance.js";

type Decision = "PAY" | "SKIP";

const formatUsdc = (value: number): string => {
  return value.toFixed(6);
};

const main = async () => {
  const env = loadAgentEnv();
  const args = parseArgs();
  const apiUrl = args.apiUrl ?? env.SUBGATE_API_URL;
  const budgetUsdc = args.budgetUsdc ?? env.AGENT_DEFAULT_BUDGET_USDC;
  const gateway = createGatewayPaymentClient(env.BUYER_PRIVATE_KEY as `0x${string}`);

  let spentUsdc = 0;

  console.log("Subgate Nano Agent Demo");
  console.log(`Query: "${args.query}"`);
  console.log(`Session budget: ${formatUsdc(budgetUsdc)} USDC`);
  console.log(`API: ${apiUrl}`);

  if (!args.dryRun) {
    await ensureGatewayBalance(gateway, {
      minBalanceUsdc: env.AGENT_MIN_GATEWAY_BALANCE_USDC,
      depositAmountUsdc: env.AGENT_DEPOSIT_AMOUNT_USDC,
    });
  }

  const catalog = await fetchCatalog(apiUrl);

  if (catalog.length === 0) {
    console.log("No active catalog items found.");
    return;
  }

  for (const [index, item] of catalog.entries()) {
    const quote = await fetchQuote(apiUrl, item.slug);
    const relevance = scoreRelevance(args.query, item);
    const remaining = budgetUsdc - spentUsdc;
    const shouldPay =
      item.isActive &&
      relevance >= env.AGENT_RELEVANCE_THRESHOLD &&
      quote.amountUsdc <= remaining;
    const decision: Decision = shouldPay ? "PAY" : "SKIP";

    console.log("");
    console.log(`[${index + 1}/${catalog.length}] ${item.title}`);
    console.log(`      URL: ${contentUrl(apiUrl, item.slug)}`);
    console.log(`      Price: ${formatUsdc(quote.amountUsdc)} USDC`);
    console.log(`      Relevance: ${relevance.toFixed(2)} / threshold ${env.AGENT_RELEVANCE_THRESHOLD.toFixed(2)}`);
    console.log(`      Decision: ${decision}`);

    if (!shouldPay) {
      if (quote.amountUsdc > remaining) {
        console.log(`      Reason: price exceeds remaining budget (${formatUsdc(remaining)} USDC)`);
      }
      continue;
    }

    if (args.dryRun) {
      spentUsdc += quote.amountUsdc;
      console.log("      Dry run: payment skipped.");
      continue;
    }

    const url = contentUrl(apiUrl, item.slug);
    const support = gateway.supports ? await gateway.supports(url) : { supported: true };

    if (!support.supported) {
      console.log("      Payment skipped: endpoint does not advertise Gateway x402 support.");
      continue;
    }

    const startedAt = Date.now();
    const result = await gateway.pay(url);
    const elapsedMs = Date.now() - startedAt;
    const unlocked = parseUnlockResponse(result.data);

    spentUsdc += quote.amountUsdc;

    console.log(`      Settled in ${elapsedMs}ms`);
    console.log(`      Access grant: ${unlocked.accessGrantId}`);
    console.log(`      Gateway charged: ${result.formattedAmount ?? formatUsdc(quote.amountUsdc)} USDC`);
  }

  console.log("");
  console.log("Session complete.");
  console.log(`Paid: ${formatUsdc(spentUsdc)} USDC`);
  console.log(`Remaining budget: ${formatUsdc(Math.max(0, budgetUsdc - spentUsdc))} USDC`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
