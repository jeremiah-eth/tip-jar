import { PublicKey } from "@solana/web3.js";

// Solana Devnet Bridge Program ID
export const SOLANA_DEVNET_BRIDGE_PROGRAM_ID = new PublicKey("7c6mteAcTXaQ1MFBCrnuzoZVTTAEfZwa6wgy4bqX3KXC");

// Helper to find Bridge PDA (Program Derived Address)
export const findBridgePda = async (programId: PublicKey) => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("bridge")],
        programId
    );
};

// Placeholder for Lock instruction builder
export const getLockInstruction = () => {
    // To be implemented for Solana -> Base flow
    throw new Error("Not implemented");
};
