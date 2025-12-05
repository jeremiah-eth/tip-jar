# Tip Jar - Base-Solana Bridge Demo

A Next.js application demonstrating the new [Base-Solana Bridge](https://docs.base.org/base-chain/quickstart/base-solana-bridge) for cross-chain token transfers between Base and Solana networks.

## 🎯 Purpose

This project serves as a **test and educational demonstration** of the Base-Solana bridge, showcasing both supported and unsupported token transfers to help developers understand bridge limitations.

## ⚠️ Important: Token Support

### ✅ Supported Tokens
- **SOL** - Fully supported for bridging between Base Sepolia and Solana Devnet

### ❌ Unsupported Tokens (Educational Purpose)
- **USDC** - Will fail with "execution reverted"

**Why include unsupported tokens?**  
We intentionally left USDC in the UI for **educational purposes** to demonstrate:
- Which assets are transferable on the Base-Solana bridge
- What happens when attempting to bridge unsupported tokens
- How to handle and debug bridge transaction failures

The Base-Solana bridge currently **only supports SOL tokens**. Attempts to bridge other tokens will fail at the contract level.

## 🚀 Features

- **Bidirectional Bridging**
  - **Base → Solana**: Fully functional using Base Bridge contract
  - **Solana → Base**: Fully functional using Solana Bridge program
  - **Network Switcher**: Toggle seamlessly between networks
- **Dual Wallet Support**
  - **Base**: Coinbase Smart Wallet, MetaMask, etc.
  - **Solana**: Phantom, Solflare, etc.
- **Smart UI**
  - Dynamic labels and wallet connections based on network
  - Automatic address validation
  - Disconnect button for both wallets
- **Safety Features**
  - Balance checking before transactions
  - Transaction confirmation steps
  - Comprehensive error logging

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+ or Bun
- MetaMask or Coinbase Wallet (for Base)
- Phantom or Solflare Wallet (for Solana)
- SOL tokens on Base Sepolia or Solana Devnet

### Installation

```bash
# Install dependencies
bun install

# Run development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

## 📝 How to Test

### Base → Solana (Bridging SOL)
1. Select **Base** network
2. Connect your Base wallet
3. Select **SOL** token
4. Enter your Solana wallet address
5. Enter amount and click "Send"
6. Approve and wait for confirmation

### Solana → Base (Bridging SOL)
1. Select **Solana** network
2. Connect your Solana wallet
3. Select **SOL** token
4. Enter your Base wallet address (0x...)
5. Enter amount and click "Send"
6. Approve transaction in Phantom/Solflare
7. Wait for confirmation

### Educational Failure (USDC)
1. Select **USDC** token
2. Attempt to bridge in either direction
3. Observe the error handling
4. This demonstrates why token validation is important

This project serves as a reference implementation for developers building on the Base-Solana bridge.

## 🔗 Contract Addresses

### Base Sepolia
- Bridge: `0x01824a90d32A69022DdAEcC6C5C14Ed08dB4EB9B`
- SOL Token: `0xCace0c896714DaF7098FFD8CC54aFCFe0338b4BC`

### Solana Devnet
- Bridge Program: `7c6mteAcTXaQ1MFBCrnuzoZVTTAEfZwa6wgy4bqX3KXC`

## 📚 Resources

- [Base-Solana Bridge Documentation](https://docs.base.org/base-chain/quickstart/base-solana-bridge)
- [Base Bridge Repository](https://github.com/base/bridge)
- [Base Sepolia Explorer](https://sepolia.basescan.org/)
- [Solana Devnet Explorer](https://explorer.solana.com/?cluster=devnet)

## 🏗️ Built With

- [Next.js 16](https://nextjs.org/)
- [Wagmi](https://wagmi.sh/) - Ethereum interactions
- [OnchainKit](https://onchainkit.xyz/) - Coinbase wallet integration
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) - Solana interactions
- [Viem](https://viem.sh/) - Ethereum utilities

## 📄 License

MIT

## 🤝 Contributing

This is an educational project. Feel free to fork and experiment with different bridge configurations!
