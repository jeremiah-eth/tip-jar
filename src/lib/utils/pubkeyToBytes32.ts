import { PublicKey } from "@solana/web3.js";

export function pubkeyToBytes32(pubkey: string | PublicKey): `0x${string}` {
    const key = typeof pubkey === "string" ? new PublicKey(pubkey) : pubkey;
    return `0x${key.toBuffer().toString("hex")}`;
}
