export type Eip1193Provider = {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

const getProvider = () => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Install a browser wallet such as MetaMask to continue.");
  }
  return window.ethereum;
};

export const connectWallet = async () => {
  const accounts = await getProvider().request({
    method: "eth_requestAccounts",
  });
  const wallet = Array.isArray(accounts) ? accounts[0] : null;
  if (typeof wallet !== "string" || !wallet) {
    throw new Error("No wallet address was returned by your wallet.");
  }
  return wallet;
};

export const signWalletMessage = async (message: string, wallet: string) => {
  const signature = await getProvider().request({
    method: "personal_sign",
    params: [message, wallet],
  });
  if (typeof signature !== "string") {
    throw new Error("Your wallet did not return a signature.");
  }
  return signature;
};

export const shortenAddress = (address: string | null | undefined, visible = 4) =>
  !address
    ? "Wallet not linked"
    : address.length > visible * 2 + 2
    ? `${address.slice(0, visible + 2)}...${address.slice(-visible)}`
    : address;
