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
import { CCIP_ROUTER_ADDRESS_BASE_SEPOLIA, BASE_SEPOLIA_SOL_ADDRESS, BASE_SEPOLIA_USDC_ADDRESS, bridgeBaseToSolanaCCIP, getCCIPExplorerLink, ERC20_ABI } from '@/lib/baseBridge';
import { pubkeyToBytes32 } from '@/lib/utils/pubkeyToBytes32';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { fetchCryptoPrices, CoinPrices } from '@/lib/priceService';
import { ArrowRightLeft } from 'lucide-react';
import { bridgeSolToBase, bridgeSplToBase } from '@/lib/solanaBridge';


const TOKENS = [
    {
        symbol: 'SOL',
        address: BASE_SEPOLIA_SOL_ADDRESS,
        decimals: 9,
        coingeckoId: 'solana',
        remoteMint: "So11111111111111111111111111111111111111112" // Native SOL
    },
    {
        symbol: 'USDC',
        address: BASE_SEPOLIA_USDC_ADDRESS,
        decimals: 6,
        coingeckoId: 'usd-coin',
        remoteMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
    }
];

// Interface for Pending Claims
interface PendingBridge {
    txHash: string;
    amount: string;
    token: string;
    recipient: string;
    timestamp: number;
    status: 'pending' | 'ready' | 'claiming' | 'completed' | 'failed';
}

export function TipForm() {
    const { isConnected: isBaseConnected, address: baseAddress } = useAccount();
    const { connected: isSolanaConnected, publicKey: solanaPublicKey, sendTransaction, disconnect: disconnectSolana } = useWallet();
    const { connection } = useConnection();
    const { connectors, connect } = useConnect();
    const { disconnect } = useDisconnect();
    const { writeContractAsync } = useWriteContract();
    const config = useConfig();
    const publicClient = usePublicClient();

    const [amount, setAmount] = useState('');
    const [recipient, setRecipient] = useState('');
    const [status, setStatus] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [pendingClaims, setPendingClaims] = useState<PendingBridge[]>([]);

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
    }

    const toggleInputMode = () => {
        if (inputMode === 'TOKEN') {
            setAmount(usdValue);
            setInputMode('USD');
        } else {
            setAmount(tokenValue);
            setInputMode('TOKEN');
        }
    }

    // Load pending claims on mount
    useEffect(() => {
        const stored = localStorage.getItem('pendingBridges');
        if (stored) {
            try {
                setPendingClaims(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse pending bridges", e);
            }
        }
    }, []);

    // Save pending claims on change
    useEffect(() => {
        localStorage.setItem('pendingBridges', JSON.stringify(pendingClaims));
    }, [pendingClaims]);

    const checkClaimStatus = async (bridge: PendingBridge) => {
        // For CCIP, we basically just want to check if it's done or confirmed basically
        // But users will mostly check the explorer.
        // We can implement a status check if needed via an API, but for now we rely on the explorer link.
        // This function is kept for compatibility if we want to add auto-status-update later.
    };

    const handleSolanaBridge = async () => {
        if (!isSolanaConnected || !solanaPublicKey) {
            setStatus("Please connect Solana wallet");
            return;
        }

        // Ensure we calculate the correct token amount for the tx
        const finalTokenAmount = inputMode === 'TOKEN' ? amount : tokenValue;
        if (!finalTokenAmount || parseFloat(finalTokenAmount) <= 0) {
            setStatus("Invalid amount");
            return;
        }

        // Validate recipient is a valid Base address
        if (!recipient || !recipient.match(/^0x[0-9a-fA-F]{40}$/)) {
            setStatus("Please enter a valid Base address (0x...)");
            return;
        }

        try {
            setIsProcessing(true);
            setStatus('Preparing Solana transaction...');

            const amountNum = parseFloat(finalTokenAmount);

            // Construct wallet context
            const walletContext = {
                publicKey: solanaPublicKey,
                signTransaction: async (tx: Transaction) => tx,
                sendTransaction: sendTransaction
            };

            let signature = '';

            if (selectedToken.symbol === 'SOL') {
                signature = await bridgeSolToBase({
                    connection,
                    wallet: walletContext,
                    amount: amountNum,
                    recipient: recipient,
                    network: 'devnet'
                });
            } else {
                signature = await bridgeSplToBase({
                    connection,
                    wallet: walletContext,
                    mint: new PublicKey(selectedToken.remoteMint),
                    amount: amountNum,
                    recipient: recipient,
                    remoteToken: selectedToken.address, // Base token address
                    decimals: selectedToken.decimals,
                    network: 'devnet'
                });
            }


            console.log('Solana Bridge Sig:', signature);
            setStatus(`✅ Bridge initiated! Tx: ${signature.slice(0, 8)}...`);
            setAmount('');

        } catch (error: any) {
            console.error('Solana bridge error:', error);

            // Phantom-specific error handling
            if (error.message?.includes('User rejected')) {
                setStatus('❌ Transaction cancelled by user');
            } else if (error.message?.includes('disconnected port') ||
                error.message?.includes('Unexpected error')) {
                setStatus(
                    '⚠️ Wallet connection lost. Please:\n' +
                    '1. Disconnect wallet\n' +
                    '2. Refresh the page\n' +
                    '3. Reconnect and try again'
                );
            } else if (error.message?.includes('insufficient')) {
                setStatus(`❌ Insufficient balance: ${error.message}`);
            } else if (error.message?.includes('Wallet not connected')) {
                setStatus('❌ Please connect your Solana wallet first');
            } else if (error.message?.includes('Invalid') && error.message?.includes('address')) {
                setStatus('❌ Invalid recipient address. Please check the Base address (0x...)');
            } else {
                setStatus(`❌ Bridge error: ${error.message || 'Unknown error'}`);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTip = async () => {
        if (isProcessing) {
            console.log('Transaction already in progress, please wait...');
            return;
        }

        // Route to correct handler based on selected network
        if (selectedNetwork === 'solana') {
            return handleSolanaBridge();
        }

        // Base → Solana flow (CCIP)
        if (!baseAddress || !recipient || !amount) return;

        // Ensure we calculate the correct token amount for the tx
        const finalTokenAmount = inputMode === 'TOKEN' ? amount : tokenValue;
        if (!finalTokenAmount || parseFloat(finalTokenAmount) <= 0) {
            setStatus("Invalid amount");
            return;
        }

        try {
            setIsProcessing(true);

            console.log('=== BASE → SOLANA BRIDGE DEBUG ===');
            console.log('User Address:', baseAddress);
            console.log('Token:', selectedToken.symbol);
            console.log('Token Address:', selectedToken.address);
            console.log('Amount:', finalTokenAmount);
            console.log('Decimals:', selectedToken.decimals);
            console.log('Recipient (Solana):', recipient);

            // Validate Solana address
            setStatus('Validating...');
            let recipientPubkey: PublicKey;
            try {
                recipientPubkey = new PublicKey(recipient);
                console.log('✅ Valid Solana address');
            } catch (e) {
                setStatus('Invalid Solana address');
                setIsProcessing(false);
                return;
            }

            const amountBigInt = parseUnits(finalTokenAmount, selectedToken.decimals);
            console.log('Amount (BigInt):', amountBigInt.toString());

            // CHECK ETH BALANCE FIRST
            if (!publicClient) {
                setStatus('❌ Unable to connect to network');
                setIsProcessing(false);
                return;
            }

            setStatus('Checking ETH balance for gas...');
            const ethBalance = await publicClient.getBalance({ address: baseAddress });
            console.log('ETH Balance:', formatUnits(ethBalance, 18), 'ETH');

            if (ethBalance < parseUnits('0.001', 18)) {
                setStatus(
                    '❌ Insufficient ETH for gas fees.\n' +
                    'You need at least 0.001 ETH on Base Sepolia.\n\n' +
                    'Get ETH from: https://docs.chain.link/ccip/test-tokens'
                );
                setIsProcessing(false);
                return;
            }
            console.log('✅ ETH balance sufficient');

            // Check token balance
            setStatus('Checking token balance...');
            try {
                const balance = await readContract(config, {
                    address: selectedToken.address as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [baseAddress],
                });

                console.log('Token Balance:', formatUnits(balance, selectedToken.decimals), selectedToken.symbol);

                if (balance === BigInt(0)) {
                    setStatus(
                        `❌ You don't have any ${selectedToken.symbol} tokens!\n\n` +
                        `Get test tokens from:\n` +
                        `https://docs.chain.link/ccip/test-tokens`
                    );
                    setIsProcessing(false);
                    return;
                }

                if (balance < amountBigInt) {
                    setStatus(
                        `❌ Insufficient ${selectedToken.symbol} balance.\n` +
                        `You have: ${formatUnits(balance, selectedToken.decimals)} ${selectedToken.symbol}\n` +
                        `Trying to send: ${formatUnits(amountBigInt, selectedToken.decimals)} ${selectedToken.symbol}`
                    );
                    setIsProcessing(false);
                    return;
                }

                console.log('✅ Token balance sufficient');
            } catch (balanceError: any) {
                console.error('Balance check error:', balanceError);

                // Check if token contract exists
                const code = await publicClient.getBytecode({
                    address: selectedToken.address as `0x${string}`
                });

                if (!code || code === '0x') {
                    setStatus(
                        `❌ Token contract not found at ${selectedToken.address}\n` +
                        `The token might not exist on Base Sepolia, or the address is wrong.`
                    );
                    setIsProcessing(false);
                    return;
                }

                setStatus('⚠️ Could not check balance. Proceeding with caution...');
            }

            // APPROVE WITH MORE DETAILS
            setStatus(`Approving ${selectedToken.symbol}...`);
            console.log('=== APPROVAL TRANSACTION ===');
            console.log('Token Contract:', selectedToken.address);
            console.log('Spender (CCIP Router):', CCIP_ROUTER_ADDRESS_BASE_SEPOLIA);
            console.log('Amount to approve:', formatUnits(amountBigInt, selectedToken.decimals));

            try {
                const approveTx = await writeContractAsync({
                    address: selectedToken.address as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [CCIP_ROUTER_ADDRESS_BASE_SEPOLIA, amountBigInt],
                });

                console.log('✅ Approve tx sent:', approveTx);
                setStatus('Waiting for approval confirmation...');

                const approvalReceipt = await waitForTransactionReceipt(config, {
                    hash: approveTx,
                    confirmations: 2,
                });

                console.log('Approval receipt:', approvalReceipt);

                if (approvalReceipt.status !== 'success') {
                    setStatus('Approval failed');
                    setIsProcessing(false);
                    return;
                }

                console.log('✅ Approval confirmed!');
                setStatus('Approval confirmed! Preparing CCIP bridge...');
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (approveError: any) {
                console.error('=== APPROVAL ERROR ===');
                console.error('Full error:', approveError);
                console.error('Error name:', approveError.name);
                console.error('Error message:', approveError.message);
                console.error('Error cause:', approveError.cause);
                console.error('Error details:', approveError.details);

                // More helpful error messages
                let errorMsg = 'Approval failed';

                if (approveError.message?.includes('insufficient funds')) {
                    errorMsg = '❌ Insufficient ETH for gas fees. Get Base Sepolia ETH from faucet.';
                } else if (approveError.message?.includes('user rejected') || approveError.message?.includes('User rejected')) {
                    errorMsg = '❌ Transaction rejected in wallet';
                } else if (approveError.message?.includes('nonce')) {
                    errorMsg = '❌ Nonce error. Try refreshing the page.';
                } else {
                    errorMsg = `❌ Approval failed: ${approveError.shortMessage || approveError.message}`;
                }

                setStatus(errorMsg);
                setIsProcessing(false);
                return;
            }

            // 2. Bridge via CCIP
            setStatus(`Bridging ${selectedToken.symbol} via Chainlink CCIP...`);
            console.log('=== CCIP BRIDGE TRANSACTION ===');
            try {
                // Call our new CCIP wrapper
                const bridgeTx = await bridgeBaseToSolanaCCIP(config, {
                    token: selectedToken.address,
                    amount: amountBigInt,
                    recipient: recipient // Solana address as string
                });

                console.log('✅ CCIP Bridge Tx Hash:', bridgeTx);
                setStatus(`Transaction Sent! Hash: ${bridgeTx}`);

                // Add to pending claims
                const newClaim: PendingBridge = {
                    txHash: bridgeTx,
                    amount: finalTokenAmount,
                    token: selectedToken.symbol,
                    recipient: recipient,
                    timestamp: Date.now(),
                    status: 'pending'
                };
                setPendingClaims(prev => [newClaim, ...prev]);
                setStatus('✅ CCIP Bridge Initiated! Funds will auto-arrive on Solana.');
            } catch (bridgeError: any) {
                console.error('=== CCIP BRIDGE ERROR ===');
                console.error(bridgeError);
                setStatus(`Bridge failed: ${bridgeError.message || 'Unknown error'}.`);
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
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-center">
                                    <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !text-white !font-bold !py-2 !px-4 !rounded !shadow-lg !transform !transition hover:!scale-105" />
                                </div>
                                {isSolanaConnected && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => disconnectSolana()}
                                        className="w-full"
                                    >
                                        Disconnect Wallet
                                    </Button>
                                )}
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

                    {/* Pending Claims Section */}
                    {pendingClaims.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <h3 className="text-lg font-semibold mb-4">Pending CCIP Bridges</h3>
                            <div className="space-y-3">
                                {pendingClaims.map((claim) => (
                                    <div key={claim.txHash} className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-medium">{claim.amount} {claim.token}</span>
                                                <div className="text-xs text-gray-500">{new Date(claim.timestamp).toLocaleString()}</div>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-semibold
                                        ${claim.status === 'ready' ? 'bg-green-100 text-green-800' :
                                                    claim.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                        claim.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                            'bg-yellow-100 text-yellow-800'}`}>
                                                {claim.status.toUpperCase()}
                                            </span>
                                        </div>

                                        <div className="flex gap-2">
                                            <a
                                                href={getCCIPExplorerLink(claim.txHash)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-500 hover:text-blue-700 flex items-center bg-blue-50 px-3 py-1 rounded"
                                            >
                                                View on CCIP Explorer ↗
                                            </a>

                                            <a
                                                href={`https://sepolia.basescan.org/tx/${claim.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                                            >
                                                BaseScan ↗
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status Message */}
                    {status && <p className="text-sm text-muted-foreground text-center">{status}</p>}
                </CardFooter>
            </Card>
        </div>
    );
}
