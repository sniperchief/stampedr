export const STAMPED_CONTRACT_ADDRESS = "0xBFCa40B0Cb3227EF6FD9A26355425098d708966f" as const;
export const STAMPED_DEPLOY_BLOCK = 44985701n;
/** The app's treasury wallet — funds new users' wallets on signup, see src/lib/serverWallet.ts. */
export const STAMPED_TREASURY_ADDRESS = "0x745Fed33170256AcE316BbCD08273adBA72f0806" as const;

export const STAMPED_ABI = [
  {
    type: "function",
    name: "createReceipt",
    inputs: [
      { name: "fileHash", type: "bytes32", internalType: "bytes32" },
      { name: "clientName", type: "string", internalType: "string" },
      { name: "description", type: "string", internalType: "string" },
      { name: "dueDate", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "receiptId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getReceipt",
    inputs: [{ name: "receiptId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Stamped.Receipt",
        components: [
          { name: "fileHash", type: "bytes32", internalType: "bytes32" },
          { name: "creator", type: "address", internalType: "address" },
          { name: "clientName", type: "string", internalType: "string" },
          { name: "description", type: "string", internalType: "string" },
          { name: "dueDate", type: "uint256", internalType: "uint256" },
          { name: "createdAt", type: "uint256", internalType: "uint256" },
          { name: "paid", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReceiptsByCreator",
    inputs: [{ name: "creator", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "markPaid",
    inputs: [{ name: "receiptId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "ReceiptCreated",
    inputs: [
      { name: "receiptId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "creator", type: "address", indexed: true, internalType: "address" },
      { name: "fileHash", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "createdAt", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ReceiptPaid",
    inputs: [{ name: "receiptId", type: "uint256", indexed: true, internalType: "uint256" }],
    anonymous: false,
  },
  { type: "error", name: "AlreadyPaid", inputs: [] },
  { type: "error", name: "DuplicateFileHash", inputs: [] },
  { type: "error", name: "EmptyClientName", inputs: [] },
  { type: "error", name: "InvalidDueDate", inputs: [] },
  { type: "error", name: "NotReceiptCreator", inputs: [] },
  { type: "error", name: "ReceiptNotFound", inputs: [] },
] as const;
