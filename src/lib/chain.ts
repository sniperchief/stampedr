import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";

export const MONAD_TESTNET_EXPLORER = "https://testnet.monadexplorer.com";

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz"),
});
