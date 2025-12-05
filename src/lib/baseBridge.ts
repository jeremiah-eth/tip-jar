import { baseSepolia } from "viem/chains";

export const BASE_SEPOLIA_BRIDGE_ADDRESS = "0x01824a90d32A69022DdAEcC6C5C14Ed08dB4EB9B";
export const BASE_SEPOLIA_SOL_ADDRESS = "0xCace0c896714DaF7098FFD8CC54aFCFe0338b4BC";

export const BRIDGE_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: "localToken", type: "address" },
                    { name: "remoteToken", type: "bytes32" },
                    { name: "to", type: "bytes32" },
                    { name: "remoteAmount", type: "uint256" },
                ],
                name: "transfer",
                type: "tuple",
            },
            { name: "signatures", type: "bytes[]" },
        ],
        name: "bridgeToken",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

export const ERC20_ABI = [
    {
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;
