import "server-only";
import type { Abi, ContractFunctionArgs, ContractFunctionName } from "viem";
import { publicClient } from "./chain";

/**
 * Monad charges gas_limit * price_per_gas, not gas actually used, so an
 * inflated limit directly costs the signing wallet real MON. Estimate the
 * real cost per call and add only a small buffer, per MONSKILLS gas guidance.
 */
export async function estimateGasWithBuffer<
  const abi extends Abi,
  functionName extends ContractFunctionName<abi, "nonpayable" | "payable">,
>(params: {
  address: `0x${string}`;
  abi: abi;
  functionName: functionName;
  args: ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>;
  account: `0x${string}`;
}): Promise<bigint> {
  const estimate = await publicClient.estimateContractGas(params);
  return estimate + estimate / 10n; // +10% buffer, per Monad gas guidance
}
