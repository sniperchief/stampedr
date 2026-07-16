import { NextResponse } from "next/server";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { fetchReceipt } from "@/lib/receipts";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const receiptId = Number(id);

  if (!Number.isInteger(receiptId) || receiptId <= 0) {
    return NextResponse.json({ error: "Invalid receipt id" }, { status: 400 });
  }

  try {
    const receipt = await fetchReceipt(receiptId);
    return NextResponse.json({ receipt });
  } catch (error) {
    if (error instanceof BaseError) {
      const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError);
      if (revertError instanceof ContractFunctionRevertedError) {
        return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
      }
    }
    return NextResponse.json({ error: "Failed to read receipt from chain" }, { status: 502 });
  }
}
