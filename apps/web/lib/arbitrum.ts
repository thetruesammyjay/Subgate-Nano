import { connectWallet, type Eip1193Provider } from "./wallet";
import type { ChainConfig, Stream } from "../types/stream";

const REGISTRY_REGISTER_SELECTOR = "0x39f0d9f8";
const ERC20_APPROVE_SELECTOR = "0x095ea7b3";
const RECEIPTS_SETTLE_SELECTOR = "0xd517b69b";
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

export class ChainTransactionFailedError extends Error {
  constructor(txHash: string) {
    super(`Transaction ${txHash} failed on Arbitrum Sepolia.`);
    this.name = "ChainTransactionFailedError";
  }
}

const walletProvider = (): Eip1193Provider => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Install a browser wallet such as MetaMask to make this transaction.");
  }
  return window.ethereum;
};

const uintWord = (value: number | bigint) => {
  const numeric = BigInt(value);
  if (numeric < 0n || numeric >= 1n << 256n) throw new Error("The on-chain amount is outside the supported range.");
  return numeric.toString(16).padStart(64, "0");
};

const addressWord = (address: string) => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("A configured contract address is invalid.");
  return address.slice(2).toLowerCase().padStart(64, "0");
};

const bytes32Word = (value: string) => {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) throw new Error("The stream identifier is invalid.");
  return value.slice(2).toLowerCase();
};

export async function ensureArbitrumSepolia(provider = walletProvider()) {
  const targetHex = `0x${ARBITRUM_SEPOLIA_CHAIN_ID.toString(16)}`;
  const current = await provider.request({ method: "eth_chainId" });
  if (typeof current === "string" && current.toLowerCase() === targetHex) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: targetHex }] });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: targetHex,
        chainName: "Arbitrum Sepolia",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
        blockExplorerUrls: ["https://sepolia.arbiscan.io"],
      }],
    });
  }
}

async function sendWalletTransaction(from: string, to: string, data: string) {
  const provider = walletProvider();
  const result = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data, value: "0x0" }],
  });
  if (typeof result !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(result)) {
    throw new Error("Your wallet did not return a valid transaction hash.");
  }
  return result;
}

export async function waitForTransaction(txHash: string, timeoutMs = 120_000) {
  const provider = walletProvider();
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await provider.request({ method: "eth_getTransactionReceipt", params: [txHash] });
    if (result && typeof result === "object" && "status" in result) {
      const status = result.status;
      if (typeof status !== "string" || status !== "0x1") throw new ChainTransactionFailedError(txHash);
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error("The transaction is still pending. Wait for it to confirm, then retry the verification step.");
}

export async function registerStreamOnArbitrum(stream: Stream, creatorWallet: string) {
  const chain = stream.chain;
  if (!chain || !stream.chain_stream_id) throw new Error("Arbitrum contracts are not configured by the API yet.");
  if (chain.chain_id !== ARBITRUM_SEPOLIA_CHAIN_ID) throw new Error("This demo only supports Arbitrum Sepolia.");
  const connected = await connectWallet();
  await ensureArbitrumSepolia();
  if (connected.toLowerCase() !== creatorWallet.toLowerCase()) {
    throw new Error("Connect the same wallet you used to sign in as this creator.");
  }
  const price = stream.pricing.model === "pay_per_view"
    ? stream.pricing.price_atomic
    : stream.pricing.rate_atomic_per_minute;
  if (!price) throw new Error("The stream does not have a valid on-chain price.");
  const model = stream.pricing.model === "pay_per_view" ? 0 : 1;
  const data = `${REGISTRY_REGISTER_SELECTOR}${bytes32Word(stream.chain_stream_id)}${uintWord(model)}${uintWord(price)}${uintWord(stream.free_preview_seconds)}`;
  const txHash = await sendWalletTransaction(connected, chain.registry_contract_address, data);
  await waitForTransaction(txHash);
  return txHash;
}

export async function settlePayPerViewOnArbitrum(
  chain: ChainConfig,
  streamId: string,
  amountAtomic: number,
  onSettlementSubmitted?: (pending: { sessionId: string; viewerWallet: string; txHash: string }) => void,
) {
  if (chain.chain_id !== ARBITRUM_SEPOLIA_CHAIN_ID) throw new Error("This demo only supports Arbitrum Sepolia.");
  if (!Number.isSafeInteger(amountAtomic) || amountAtomic <= 0) throw new Error("The stream price is invalid.");
  const viewerWallet = await connectWallet();
  await ensureArbitrumSepolia();
  const sessionId = crypto.randomUUID();
  const sessionWord = sessionId.replaceAll("-", "").padStart(64, "0");

  // The allowance is limited to this one exact stream price. The contract transfers
  // the USDC and creates the receipt atomically in the next wallet transaction.
  const approval = await sendWalletTransaction(
    viewerWallet,
    chain.payment_token_address,
    `${ERC20_APPROVE_SELECTOR}${addressWord(chain.receipts_contract_address)}${uintWord(amountAtomic)}`,
  );
  await waitForTransaction(approval);

  const settlementData = `${RECEIPTS_SETTLE_SELECTOR}${sessionWord}${bytes32Word(streamId)}${uintWord(amountAtomic)}`;
  const settlement = await sendWalletTransaction(viewerWallet, chain.receipts_contract_address, settlementData);
  onSettlementSubmitted?.({ sessionId, viewerWallet, txHash: settlement });
  await waitForTransaction(settlement);

  return { viewerWallet, sessionId, settlementTxHash: settlement };
}

export function explorerTransactionUrl(chain: ChainConfig, txHash: string) {
  return `${chain.explorer_base_url.replace(/\/$/, "")}/tx/${txHash}`;
}
