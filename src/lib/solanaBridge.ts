import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

// Solana Bridge Program ID
export const SOLANA_BRIDGE_PROGRAM_ID = new PublicKey("7c6mteAcTXaQ1MFBCrnuzoZVTTAEfZwa6wgy4bqX3KXC");

// Gas Fee Receivers
export const GAS_FEE_RECEIVERS = {
    devnet: new PublicKey("AFs1LCbodhvwpgX3u3URLsud6R1XMSaMiQ5LtXw4GKYT"),
    mainnet: new PublicKey("AFs1LCbodhvwpgX3u3URLsud6R1XMSaMiQ5LtXw4GKYT"),
};

// Discriminators
const BRIDGE_SOL_DISCRIMINATOR = Buffer.from([190, 190, 32, 158, 75, 153, 32, 86]);
const BRIDGE_SPL_DISCRIMINATOR = Buffer.from([87, 109, 172, 103, 8, 187, 223, 126]);

export interface ContractCall {
    target: string; // Contract address on Base
    value: bigint;  // ETH value to send
    data: Buffer;   // Calldata
}

// Helpers
export function addressToBytes20(address: string): Uint8Array {
    const hex = address.startsWith('0x') ? address.slice(2) : address;
    if (!/^[0-9a-fA-F]{40}$/.test(hex)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
    }
    return new Uint8Array(Buffer.from(hex, 'hex'));
}

export function addressToBytes32(address: string): Uint8Array {
    const bytes20 = addressToBytes20(address);
    const bytes32 = new Uint8Array(32);
    bytes32.set(bytes20, 12);
    return bytes32;
}

export function createSaltBundle(): Buffer {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
}

export function deriveOutgoingMessagePda(
    bridgeProgramId: PublicKey,
    bridgePda: PublicKey,
    salt: Buffer
): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('outgoing_message'),
            bridgePda.toBuffer(),
            salt,
        ],
        bridgeProgramId
    );
    return pda;
}

export const findBridgePda = (programId: PublicKey = SOLANA_BRIDGE_PROGRAM_ID) => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("bridge")],
        programId
    );
};

export const findSolVaultPda = (programId: PublicKey = SOLANA_BRIDGE_PROGRAM_ID) => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("sol_vault")],
        programId
    );
};

export const findTokenVaultPda = (
    mint: PublicKey,
    remoteToken: Uint8Array,
    programId: PublicKey = SOLANA_BRIDGE_PROGRAM_ID
) => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), mint.toBuffer(), Buffer.from(remoteToken)],
        programId
    );
};

// Instruction Builders

export function createBridgeSolInstruction(params: {
    payer: PublicKey;
    from: PublicKey;
    solVault: PublicKey;
    bridge: PublicKey;
    outgoingMessage: PublicKey;
    salt: Buffer;
    to: string; // Hex string (0x...)
    amount: bigint;
    call?: ContractCall;
    gasFeeReceiver?: PublicKey;
}) {
    // Validate inputs
    if (params.amount <= BigInt(0)) throw new Error("Amount must be greater than 0");
    if (params.salt.length !== 32) throw new Error("Salt must be exactly 32 bytes");
    if (!params.to.match(/^(0x)?[0-9a-fA-F]{40}$/)) throw new Error(`Invalid Base address: ${params.to}`);

    const toBytes = addressToBytes20(params.to);

    // Encode contract call if present
    const callBuffer = params.call
        ? (() => {
            // [1 (Some), 0 (Call), target (20), value (16 - uint128), data_len (4), data...]
            const target = addressToBytes20(params.call.target);

            const valueBuf = Buffer.alloc(16);
            let val = params.call.value;
            for (let i = 0; i < 16; i++) {
                valueBuf[i] = Number(val & BigInt(0xff));
                val >>= BigInt(8);
            }

            const dataLen = Buffer.alloc(4);
            dataLen.writeUInt32LE(params.call.data.length);

            return Buffer.concat([
                Buffer.from([1]), // Some
                Buffer.from([0]), // CallType: Call
                target,
                valueBuf,
                dataLen,
                params.call.data
            ]);
        })()
        : Buffer.from([0]); // None

    const data = Buffer.concat([
        BRIDGE_SOL_DISCRIMINATOR, // 8
        params.salt,              // 32
        toBytes,                  // 20
        // Amount is 8 bytes little endian
        (() => {
            const buf = Buffer.alloc(8);
            buf.writeBigUInt64LE(params.amount);
            return buf;
        })(),                     // 8
        callBuffer
    ]);

    const gasFeeReceiver = params.gasFeeReceiver || GAS_FEE_RECEIVERS.devnet;

    const keys = [
        { pubkey: params.payer, isSigner: true, isWritable: true },
        { pubkey: params.from, isSigner: false, isWritable: true },
        { pubkey: gasFeeReceiver, isSigner: false, isWritable: true },
        { pubkey: params.solVault, isSigner: false, isWritable: true },
        { pubkey: params.bridge, isSigner: false, isWritable: true },
        { pubkey: params.outgoingMessage, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
        keys,
        programId: SOLANA_BRIDGE_PROGRAM_ID,
        data,
    });
}

export function createBridgeSplInstruction(params: {
    payer: PublicKey;
    from: PublicKey;
    fromTokenAccount: PublicKey;
    mint: PublicKey;
    tokenVault: PublicKey;
    bridge: PublicKey;
    outgoingMessage: PublicKey;
    salt: Buffer;
    to: string;
    remoteToken: string;
    amount: bigint;
    call?: ContractCall;
    gasFeeReceiver?: PublicKey;
}) {
    if (params.amount <= BigInt(0)) throw new Error("Amount must be greater than 0");

    const toBytes = addressToBytes20(params.to);
    const remoteTokenBytes = addressToBytes20(params.remoteToken);
    const callBuffer = Buffer.from([0]); // Simplification: No call support for SPL in this demo

    const data = Buffer.concat([
        BRIDGE_SPL_DISCRIMINATOR,
        params.salt,
        toBytes,
        remoteTokenBytes,
        (() => {
            const buf = Buffer.alloc(8);
            buf.writeBigUInt64LE(params.amount);
            return buf;
        })(),
        callBuffer
    ]);

    const gasFeeReceiver = params.gasFeeReceiver || GAS_FEE_RECEIVERS.devnet;

    const keys = [
        { pubkey: params.payer, isSigner: true, isWritable: true },
        { pubkey: params.from, isSigner: params.from.equals(params.payer), isWritable: true },
        { pubkey: gasFeeReceiver, isSigner: false, isWritable: true },
        { pubkey: params.mint, isSigner: false, isWritable: true },
        { pubkey: params.fromTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.bridge, isSigner: false, isWritable: true },
        { pubkey: params.tokenVault, isSigner: false, isWritable: true },
        { pubkey: params.outgoingMessage, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
        keys,
        programId: SOLANA_BRIDGE_PROGRAM_ID,
        data,
    });
}

// --- High Level Wrappers ---

export interface WalletContextState {
    publicKey: PublicKey | null;
    signTransaction: (transaction: Transaction) => Promise<Transaction>;
    sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>;
}

export async function bridgeSolToBase(params: {
    connection: Connection;
    wallet: WalletContextState;
    amount: number; // In SOL
    recipient: string; // Base address
    network?: 'devnet' | 'mainnet';
}): Promise<string> {
    const { connection, wallet, amount, recipient, network = 'devnet' } = params;

    if (!wallet.publicKey) {
        throw new Error("Wallet not connected");
    }

    const amountLamports = BigInt(Math.floor(amount * LAMPORTS_PER_SOL));

    // PDAs
    const [bridgePda] = findBridgePda();
    const [solVaultPda] = findSolVaultPda();
    // Salt & Message PDA
    const salt = createSaltBundle();
    const outgoingMessagePda = deriveOutgoingMessagePda(SOLANA_BRIDGE_PROGRAM_ID, bridgePda, salt);

    const bridgeIx = createBridgeSolInstruction({
        payer: wallet.publicKey,
        from: wallet.publicKey,
        solVault: solVaultPda,
        bridge: bridgePda,
        outgoingMessage: outgoingMessagePda,
        salt,
        to: recipient,
        amount: amountLamports,
        gasFeeReceiver: GAS_FEE_RECEIVERS[network],
    });

    const transaction = new Transaction().add(bridgeIx);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
}

export async function bridgeSplToBase(params: {
    connection: Connection;
    wallet: WalletContextState;
    mint: PublicKey;
    amount: number; // In token units (e.g. 10.5 USDC)
    recipient: string;
    remoteToken: string; // Base token address
    decimals: number;
    network?: 'devnet' | 'mainnet';
}): Promise<string> {
    const { connection, wallet, mint, amount, recipient, remoteToken, decimals, network = 'devnet' } = params;

    if (!wallet.publicKey) throw new Error("Wallet not connected");

    const amountBigInt = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    // Get Token Account
    const fromTokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey);

    // PDAs
    const [bridgePda] = findBridgePda();
    const remoteTokenBytes = addressToBytes20(remoteToken);
    const [tokenVaultPda] = findTokenVaultPda(mint, remoteTokenBytes);

    const salt = createSaltBundle();
    const outgoingMessagePda = deriveOutgoingMessagePda(SOLANA_BRIDGE_PROGRAM_ID, bridgePda, salt);

    const bridgeIx = createBridgeSplInstruction({
        payer: wallet.publicKey,
        from: wallet.publicKey,
        fromTokenAccount,
        mint,
        tokenVault: tokenVaultPda,
        bridge: bridgePda,
        outgoingMessage: outgoingMessagePda,
        salt,
        to: recipient,
        remoteToken,
        amount: amountBigInt,
        gasFeeReceiver: GAS_FEE_RECEIVERS[network],
    });

    const transaction = new Transaction().add(bridgeIx);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
}
