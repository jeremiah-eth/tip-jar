'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useConnect, useConnectors, useDisconnect, useConfig, usePublicClient } from 'wagmi';
import { readContract, waitForTransactionReceipt } from 'wagmi/actions';
import { parseUnits, formatUnits } from 'viem';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { BASE_SEPOLIA_BRIDGE_ADDRESS, BASE_SEPOLIA_SOL_ADDRESS, BASE_SEPOLIA_USDC_ADDRESS, BRIDGE_ABI, ERC20_ABI } from '@/lib/baseBridge';
import { pubkeyToBytes32 } from '@/lib/utils/pubkeyToBytes32';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { fetchCryptoPrices, CoinPrices } from '@/lib/priceService';
import { ArrowRightLeft } from 'lucide-react';


const TOKENS = [
    {
        symbol: 'SOL',
        address: BASE_SEPOLIA_SOL_ADDRESS,
        decimals: 9,
        coingeckoId: 'solana',
        remoteMint: "So11111111111111111111111111111111111111112"
    },
    {
        symbol: 'USDC',
        address: BASE_SEPOLIA_USDC_ADDRESS,
        decimals: 6,
        coingeckoId: 'usd-coin',
        remoteMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
    }
];

export function TipForm() {
    const { isConnected: isBaseConnected, address: baseAddress } = useAccount();
    const { connected: isSolanaConnected, publicKey: solanaPublicKey } = useWallet();
    const { connectors, connect } = useConnect();
    const { disconnect } = useDisconnect();
    const { writeContractAsync } = useWriteContract();
    const config = useConfig();

    const [amount, setAmount] = useState('');
    const [recipient, setRecipient] = useState('');
    const [status, setStatus] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedToken, setSelectedToken] = useState(TOKENS[0]);
    const [selectedNetwork, setSelectedNetwork] = useState<'base' | 'solana'>('base');
    const [inputMode, setInputMode] = useState<'TOKEN' | 'USD'>('TOKEN'); // To toggle input
    const [prices, setPrices] = useState<CoinPrices | null>(null);

    // Fetch prices on mount
    useEffect(() => {
        const loadPrices = async () => {
            const data = await fetchCryptoPrices();
            if (data) setPrices(data);
        };
        loadPrices();
        // Refresh every minute
        const interval = setInterval(loadPrices, 60000);
        return () => clearInterval(interval);
    }, []);

    const getPrice = (tokenSymbol: string) => {
        if (!prices) return 0;
        const id = TOKENS.find(t => t.symbol === tokenSymbol)?.coingeckoId;
        // @ts-ignore
        return id && prices[id] ? prices[id].usd : 0;
    };

    const currentPrice = getPrice(selectedToken.symbol);

    // Derived values
    const usdValue = inputMode === 'USD' ? amount : (parseFloat(amount || '0') * currentPrice).toFixed(2);
    const tokenValue = inputMode === 'TOKEN' ? amount : (parseFloat(amount || '0') / (currentPrice || 1)).toFixed(6);

    const handleAmountChange = (val: string) => {
        setAmount(val);
    };

    const toggleInputMode = () => {
        // When toggling, we want to keep the "value" consistent. 
        // If switching to USD, set amount to current calculated USD value.
        // If switching to TOKEN, set amount to current calculated Token value.
        if (inputMode === 'TOKEN') {
            setAmount(usdValue);
            setInputMode('USD');
        } else {
            setAmount(tokenValue);
            setInputMode('TOKEN');
        }
    };

    // Solana → Base bridge handler
    const handleSolanaBridge = async () => {
        if (!solanaPublicKey || !recipient || !amount) {
            setStatus('Please connect Solana wallet and enter recipient address');
            return;
        }

        const finalTokenAmount = inputMode === 'TOKEN' ? amount : tokenValue;
        if (!finalTokenAmount || parseFloat(finalTokenAmount) <= 0) {
            setStatus("Invalid amount");
            return;
        }

        try {
            setStatus('Preparing Solana→Base bridge transaction...');
            setIsProcessing(true);

            // Validate Base address format
            if (!recipient.startsWith('0x') || recipient.length !== 42) {
                setStatus('Invalid Base address format. Must start with 0x and be 42 characters');
                setIsProcessing(false);
                return;
            }

            if (!connection || !sendTransaction) {
                setStatus('Solana wallet not properly connected');
                setIsProcessing(false);
                return;
            }

            // Calculate amount in lamports (SOL) or smallest unit
            const amountInSmallestUnit = selectedToken.symbol === 'SOL' 
                ? BigInt(Math.floor(parseFloat(finalTokenAmount) * LAMPORTS_PER_SOL))
                : parseUnits(finalTokenAmount, selectedToken.decimals);

            console.log('=== SOLANA → BASE BRIDGE ===');
            console.log('From (Solana):', solanaPublicKey.toBase58());
            console.log('To (Base):', recipient);
            console.log('Amount:', finalTokenAmount, selectedToken.symbol);
            console.log('Amount (smallest unit):', amountInSmallestUnit.toString());

            // Get bridge program address
            const bridgeProgramId = new PublicKey('7c6mteAcTXaQ1MFBCrnuzoZVTTAEfZwa6wgy4bqX3KXC');
            
            // Find bridge PDA
            const [bridgePda] = PublicKey.findProgramAddressSync(
                [Buffer.from('bridge')],
                bridgeProgramId
            );

            console.log('Bridge Program:', bridgeProgramId.toBase58());
            console.log('Bridge PDA:', bridgePda.toBase58());

            // Create a simple transfer instruction to the bridge
            // Note: The actual bridge instruction would require the full bridge program ABI
            // For now, this demonstrates the transaction flow
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: solanaPublicKey,
                    toPubkey: bridgePda,
                    lamports: Number(amountInSmallestUnit),
                })
            );

            setStatus('Sending transaction to Solana network...');
            
            // Send transaction
            const signature = await sendTransaction(transaction, connection);
            console.log('Transaction signature:', signature);

            setStatus('Waiting for confirmation...');
            
            // Wait for confirmation
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            
            if (confirmation.value.err) {
                throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
            }

            console.log('Transaction confirmed!');
            setStatus(`✅ Bridge transaction sent! Signature: ${signature.slice(0, 8)}...`);
            
        } catch (error: any) {
            console.error('Solana bridge error:', error);
            setStatus(`Error: ${error.message || 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Main handler - routes to correct bridge based on network
    const handleTip = async () => {
        if (isProcessing) {
            console.log('Transaction already in progress, please wait...');
            return;
        }

        // Route to correct handler based on selected network
        if (selectedNetwork === 'solana') {
            return handleSolanaBridge();
        }

        // Base → Solana flow (existing)
        if (!baseAddress || !recipient || !amount) return;

        // Ensure we calculate the correct token amount for the tx
        const finalTokenAmount = inputMode === 'TOKEN' ? amount : tokenValue;
        if (!finalTokenAmount || parseFloat(finalTokenAmount) <= 0) {
            setStatus("Invalid amount");
            return;
        }

        try {
            setStatus('Validating...');
            let recipientPubkey: PublicKey;
            try {
                recipientPubkey = new PublicKey(recipient);
            } catch (e) {
                setStatus('Invalid Solana address');
                return;
            }

            const amountBigInt = parseUnits(finalTokenAmount, selectedToken.decimals);
            const recipientBytes32 = pubkeyToBytes32(recipientPubkey);

            // Check balance first
            setStatus('Checking balance...');
            try {
                const balance = await readContract(config, {
                    address: selectedToken.address as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [baseAddress],
                });

                console.log('Balance check:', {
                    token: selectedToken.symbol,
                    tokenAddress: selectedToken.address,
                    userAddress: baseAddress,
                    balance: formatUnits(balance, selectedToken.decimals),
                    required: formatUnits(amountBigInt, selectedToken.decimals)
                });

                if (balance < amountBigInt) {
                    setStatus(`Insufficient ${selectedToken.symbol} balance. You have ${formatUnits(balance, selectedToken.decimals)} ${selectedToken.symbol}`);
                    return;
                }
            } catch (balanceError: any) {
                console.error('Balance check error:', balanceError);
                setStatus('Could not check balance. Proceeding with caution...');
            }

            // 1. Approve
            setStatus(`Approving ${selectedToken.symbol}...`);
            console.log('=== APPROVE TRANSACTION ===');
            console.log('Token:', selectedToken.symbol, selectedToken.address);
            console.log('Spender (Bridge):', BASE_SEPOLIA_BRIDGE_ADDRESS);
            console.log('Amount:', formatUnits(amountBigInt, selectedToken.decimals), selectedToken.symbol);
            console.log('Amount (raw):', amountBigInt.toString());
            console.log('From:', baseAddress);
            try {
                const approveTx = await writeContractAsync({
                    address: selectedToken.address as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [BASE_SEPOLIA_BRIDGE_ADDRESS, amountBigInt],
                });
                console.log('Approve Tx Hash:', approveTx);
                setStatus('Waiting for approval confirmation...');

                // Wait for approval to be confirmed on-chain
                console.log('Waiting for approval to be mined...');
                const approvalReceipt = await waitForTransactionReceipt(config, {
                    hash: approveTx,
                    confirmations: 2,
                });
                console.log('Approval confirmed in block:', approvalReceipt.blockNumber);
                if (approvalReceipt.status !== 'success') {
                    setStatus('Approval failed');
                    setIsProcessing(false);
                    return;
                }
                setStatus('Approval confirmed! Preparing bridge...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (approveError: any) {
                console.error('Approval error:', approveError);
                setStatus(`Approval failed: ${approveError.shortMessage || approveError.message || 'Unknown error'}`);
                setIsProcessing(false);
                return;
            }

            // 2. Bridge
            setStatus(`Bridging ${selectedToken.symbol}...`);
            console.log('=== BRIDGE TRANSACTION ===');
            console.log('Bridge Address:', BASE_SEPOLIA_BRIDGE_ADDRESS);
            console.log('Local Token:', selectedToken.address);
            console.log('Remote Token (Solana):', selectedToken.remoteMint);
            console.log('Recipient (Solana):', recipient);
            console.log('Amount:', formatUnits(amountBigInt, selectedToken.decimals), selectedToken.symbol);
            try {
                console.log('Calling writeContractAsync for bridge...');
                const bridgeTx = await writeContractAsync({
                    address: BASE_SEPOLIA_BRIDGE_ADDRESS,
                    abi: BRIDGE_ABI,
                    functionName: 'bridgeToken',
                    args: [
                        {
                            localToken: selectedToken.address as `0x${string}`,
                            remoteToken: pubkeyToBytes32(new PublicKey(selectedToken.remoteMint)),
                            to: recipientBytes32,
                            remoteAmount: amountBigInt,
                        },
                        [],
                    ],
                    gas: BigInt(300000), // Explicit gas limit for bridge
                });

                console.log('Bridge Tx Hash:', bridgeTx);
                setStatus(`Transaction Sent! Hash: ${bridgeTx}`);
            } catch (bridgeError: any) {
                console.error('=== BRIDGE ERROR ===');
                console.error('Bridge error:', bridgeError);
                console.error('Error message:', bridgeError.message);
                console.error('Error shortMessage:', bridgeError.shortMessage);
                console.error('Error cause:', bridgeError.cause);
                console.error('Error details:', bridgeError.details);
                console.error('Error stack:', bridgeError.stack);
                setStatus(`Bridge failed: ${bridgeError.shortMessage || bridgeError.message || 'Unknown error'}. Check console for details.`);
                return;
            }
        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.shortMessage || error.message || "Unknown error"}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full max-w-md space-y-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Tip Jar</CardTitle>
                            <CardDescription>
                                Send {selectedToken.symbol} from {selectedNetwork === 'base' ? 'Base to Solana' : 'Solana to Base'}
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedNetwork(selectedNetwork === 'base' ? 'solana' : 'base')}
                            className="flex items-center gap-2"
                        >
                            <ArrowRightLeft className="h-4 w-4" />
                            {selectedNetwork === 'base' ? 'Solana' : 'Base'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>From ({selectedNetwork === 'base' ? 'Base' : 'Solana'})</Label>
                        {selectedNetwork === 'base' ? (
                            // Base wallet connection
                            !isBaseConnected ? (
                                <div className="flex flex-col gap-2">
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-lg transform transition hover:scale-105"
                                        onClick={() => connect({ connector: connectors.find(c => c.id === 'coinbaseWalletSDK') || connectors[0] })}
                                    >
                                        Connect to Base
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full font-bold py-2 px-4 rounded shadow-lg transform transition hover:scale-105"
                                        onClick={() => {
                                            const injectedConnector = connectors.find(c => c.type === 'injected' && c.id !== 'coinbaseWalletSDK');
                                            if (injectedConnector) {
                                                connect({ connector: injectedConnector });
                                            }
                                        }}
                                    >
                                        Connect Wallet (MetaMask, etc.)
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-center custom-base-wallet-wrapper">
                                        <ConnectWallet className="hover:scale-105 transition-transform shadow-lg" />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => disconnect()}
                                        className="w-full"
                                    >
                                        Disconnect Wallet
                                    </Button>
                                </div>
                            )
                        ) : (
                            // Solana wallet connection
                            <div className="flex justify-center">
                                <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !text-white !font-bold !py-2 !px-4 !rounded !shadow-lg !transform !transition hover:!scale-105" />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label>Amount</Label>
                            {/* Token Selection */}
                            <div className="flex gap-2">
                                {TOKENS.map(token => (
                                    <button
                                        key={token.symbol}
                                        onClick={() => setSelectedToken(token)}
                                        className={`text-xs px-2 py-1 rounded border ${selectedToken.symbol === token.symbol ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                                    >
                                        {token.symbol}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                            />
                            <div className="absolute right-3 top-2.5 text-sm text-muted-foreground">
                                {inputMode === 'USD' ? 'USD' : selectedToken.symbol}
                            </div>
                        </div>

                        {/* Conversion Display & Toggle */}
                        <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                            <span>
                                {inputMode === 'TOKEN'
                                    ? `≈ $${usdValue} USD`
                                    : `≈ ${tokenValue} ${selectedToken.symbol}`
                                }
                            </span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleInputMode}>
                                <ArrowRightLeft className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>To ({selectedNetwork === 'base' ? 'Solana' : 'Base'})</Label>
                        <Input
                            placeholder={selectedNetwork === 'base' ? 'Solana Wallet Address' : 'Base Wallet Address (0x...)'}
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                        />
                    </div>

                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button
                        className="w-full"
                        onClick={handleTip}
                        disabled={
                            (selectedNetwork === 'base' && !isBaseConnected) ||
                            (selectedNetwork === 'solana' && !isSolanaConnected) ||
                            !amount ||
                            !recipient ||
                            isProcessing
                        }
                    >
                        Send {inputMode === 'USD' ? `$${amount} USD` : `${amount} ${selectedToken.symbol}`}
                    </Button>
                    {selectedNetwork === 'solana' && (
                        <p className="text-sm text-yellow-600 text-center">
                            ⚠️ Solana→Base bridging requires additional setup. Currently showing UI only.
                        </p>
                    )}
                    {status && <p className="text-sm text-muted-foreground text-center">{status}</p>}
                </CardFooter>
            </Card>
        </div>
    );
}
