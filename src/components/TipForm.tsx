'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { BASE_SEPOLIA_BRIDGE_ADDRESS, BASE_SEPOLIA_SOL_ADDRESS, BRIDGE_ABI, ERC20_ABI } from '@/lib/baseBridge';
import { pubkeyToBytes32 } from '@/lib/utils/pubkeyToBytes32';
import { PublicKey } from '@solana/web3.js';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';

export function TipForm() {
    const { isConnected: isBaseConnected, address: baseAddress } = useAccount();
    const { connected: isSolanaConnected, publicKey: solanaPublicKey } = useWallet();
    const { writeContractAsync } = useWriteContract();

    const [amount, setAmount] = useState('');
    const [recipient, setRecipient] = useState('');
    const [status, setStatus] = useState<string>('');

    // default to Base SOL
    const tokenAddress = BASE_SEPOLIA_SOL_ADDRESS;
    const decimals = 9; // SOL has 9 decimals

    const handleTip = async () => {
        if (!baseAddress || !recipient || !amount) return;

        try {
            setStatus('Validating...');
            let recipientPubkey: PublicKey;
            try {
                recipientPubkey = new PublicKey(recipient);
            } catch (e) {
                setStatus('Invalid Solana address');
                return;
            }

            const amountBigInt = parseUnits(amount, decimals);
            const recipientBytes32 = pubkeyToBytes32(recipientPubkey);

            // 1. Approve
            setStatus('Approving token...');
            const approveTx = await writeContractAsync({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [BASE_SEPOLIA_BRIDGE_ADDRESS, amountBigInt],
            });
            console.log('Approve Tx:', approveTx);
            // In a real app we should wait for receipt here.

            // 2. Bridge
            setStatus('Bridging (Burning)...');
            const bridgeTx = await writeContractAsync({
                address: BASE_SEPOLIA_BRIDGE_ADDRESS,
                abi: BRIDGE_ABI,
                functionName: 'bridgeToken',
                args: [
                    {
                        localToken: tokenAddress,
                        remoteToken: pubkeyToBytes32(new PublicKey("So11111111111111111111111111111111111111112")), // Wrapped SOL Mint on Solana (or Native Mint representation)
                        to: recipientBytes32,
                        remoteAmount: amountBigInt,
                    },
                    [], // signatures (empty for outgoing)
                ],
            });

            setStatus(`Transaction Sent! Hash: ${bridgeTx}`);
        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message || "Unknown error"}`);
        }
    };

    return (
        <div className="w-full max-w-md space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Tip Jar</CardTitle>
                    <CardDescription>Send SOL from Base to Solana</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>From (Base)</Label>
                        <div className="flex justify-center">
                            <ConnectWallet />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Amount (SOL)</Label>
                        <Input
                            type="number"
                            placeholder="0.1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>To (Solana)</Label>
                        <Input
                            placeholder="Solana Wallet Address"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>Or connect Solana wallet</Label>
                            <WalletMultiButton />
                        </div>
                        {isSolanaConnected && solanaPublicKey && (
                            <Button variant="outline" size="sm" onClick={() => setRecipient(solanaPublicKey.toBase58())}>
                                Use Connected Wallet
                            </Button>
                        )}
                    </div>

                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button
                        className="w-full"
                        onClick={handleTip}
                        disabled={!isBaseConnected || !amount || !recipient}
                    >
                        Send Tip
                    </Button>
                    {status && <p className="text-sm text-muted-foreground text-center">{status}</p>}
                </CardFooter>
            </Card>
        </div>
    );
}
