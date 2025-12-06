import { createPublicClient, http, Hash, encodeFunctionData, encodeAbiParameters, parseAbiParameters, toHex } from "viem";
import { baseSepolia } from "viem/chains";
import { Connection, PublicKey } from "@solana/web3.js";
import { getPublicClient, writeContract, waitForTransactionReceipt } from 'wagmi/actions';
import type { Config } from 'wagmi';

// --- CCIP CONSTANTS ---
export const CCIP_ROUTER_ADDRESS_BASE_SEPOLIA = "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93";
export const CHAIN_SELECTOR_BASE_SEPOLIA = BigInt("10344971235874465080");
// export const CHAIN_SELECTOR_SOLANA_DEVNET = BigInt("16423721717087811551"); // Confirmed correct
export const CHAIN_SELECTOR_SOLANA_DEVNET = BigInt("16423721717087811551");

// Token Addresses on Base Sepolia
export const BASE_SEPOLIA_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const BASE_SEPOLIA_SOL_ADDRESS = "0x88a2D7A512f43a021F9856A88E12a67a2181555e"; // Using CCIP-BnM as mock SOL

// Default "Receiver" for CCIP to Solana is the System Program ID (generic handle)
// The ACTUAL recipient is inside the extraArgs
export const SOLANA_DEFAULT_RECEIVER = "0x" + "1".repeat(32); // 11111111111111111111111111111111

// --- ABIs ---
export const CCIP_ROUTER_ABI = [
    {
        inputs: [
            { name: "destinationChainSelector", type: "uint64" },
            {
                components: [
                    { name: "receiver", type: "bytes" },
                    { name: "data", type: "bytes" },
                    {
                        name: "tokenAmounts", type: "tuple[]", components: [
                            { name: "token", type: "address" },
                            { name: "amount", type: "uint256" }
                        ]
                    },
                    { name: "feeToken", type: "address" },
                    { name: "extraArgs", type: "bytes" }
                ],
                name: "message",
                type: "tuple"
            }
        ],
        name: "ccipSend",
        outputs: [{ name: "messageId", type: "bytes32" }],
        stateMutability: "payable",
        type: "function"
    },
    {
        inputs: [
            { name: "destinationChainSelector", type: "uint64" },
            {
                components: [
                    { name: "receiver", type: "bytes" },
                    { name: "data", type: "bytes" },
                    {
                        name: "tokenAmounts", type: "tuple[]", components: [
                            { name: "token", type: "address" },
                            { name: "amount", type: "uint256" }
                        ]
                    },
                    { name: "feeToken", type: "address" },
                    { name: "extraArgs", type: "bytes" }
                ],
                name: "message",
                type: "tuple"
            }
        ],
        name: "getFee",
        outputs: [{ name: "fee", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    }
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


// --- HELPER FUNCTIONS ---

/**
 * Encodes SVMExtraArgsV1 for Solana CCIP messages
 * Tag: 0x1f3b3aba
 */
function buildSVMExtraArgs(recipient: string): `0x${string}` {
    const TAG = "0x1f3b3aba";

    // EVM ABI encoding for SVMExtraArgsV1 struct:
    // struct SVMExtraArgsV1 {
    //   uint32 computeUnits;
    //   uint64 accountIsWritableBitmap;
    //   bool allowOutOfOrderExecution;
    //   bytes32 tokenReceiver;
    //   bytes32[] accounts;
    // }

    // Convert Solana public key (base58) to bytes32 hex
    const pubKey = new PublicKey(recipient);
    const pubKeyBytes = pubKey.toBytes();
    const pubKeyHex = toHex(pubKeyBytes);

    const encodedArgs = encodeAbiParameters(
        parseAbiParameters('uint32, uint64, bool, bytes32, bytes32[]'),
        [
            0,       // computeUnits (0 for token transfer)
            BigInt(0),      // accountIsWritableBitmap
            true,    // allowOutOfOrderExecution (MUST be true for Solana)
            pubKeyHex,// tokenReceiver (Actual recipient)
            []       // accounts (empty)
        ]
    );

    // Concatenate Tag + Encoded Data
    return `${TAG}${encodedArgs.slice(2)}` as `0x${string}`;
}

/**
 * Bridges tokens from Base Sepolia to Solana Devnet using Chainlink CCIP
 */
export async function bridgeBaseToSolanaCCIP(
    config: Config,
    params: {
        token: string;
        amount: bigint;
        recipient: string; // Solana Address
        feeToken?: string; // Optional, defaults to native ETH (address(0))
    }
): Promise<string> {
    const publicClient = getPublicClient(config);
    if (!publicClient) throw new Error("Public client not found");

    const extraArgs = buildSVMExtraArgs(params.recipient);

    const message = {
        receiver: SOLANA_DEFAULT_RECEIVER as `0x${string}`,
        data: "0x" as `0x${string}`, // Token transfer only, no data
        tokenAmounts: [
            {
                token: params.token as `0x${string}`,
                amount: params.amount
            }
        ],
        feeToken: "0x0000000000000000000000000000000000000000" as `0x${string}`, // Pay in ETH
        extraArgs: extraArgs
    };

    console.log("Estimating CCIP Fee...");

    // 1. Get Fee
    const fee = await publicClient.readContract({
        address: CCIP_ROUTER_ADDRESS_BASE_SEPOLIA,
        abi: CCIP_ROUTER_ABI,
        functionName: "getFee",
        args: [CHAIN_SELECTOR_SOLANA_DEVNET, message]
    });

    console.log(`Estimated Fee: ${fee} wei`);

    // 2. Send Transaction
    // NOTE: In a real app we should check allowance first, but TipForm handles approval step separately or we can double check here.
    // For now assuming approval is handled by caller or TipForm.

    console.log("Sending CCIP Transaction...");
    const hash = await writeContract(config, {
        address: CCIP_ROUTER_ADDRESS_BASE_SEPOLIA,
        abi: CCIP_ROUTER_ABI,
        functionName: "ccipSend",
        args: [CHAIN_SELECTOR_SOLANA_DEVNET, message],
        value: fee // Send calculated fee
    });

    return hash;
}

/**
 * CCIP Status Link Helper
 */
export function getCCIPExplorerLink(txHash: string): string {
    return `https://ccip.chain.link/msg/${txHash}`; // Note: Ideally should link by messageId, but txHash usually works in search
}
