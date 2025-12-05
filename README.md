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
  - Base → Solana (fully functional)
  - Solana → Base (UI ready, requires Base bridge SDK setup)
  - Network switcher to toggle between directions
- **Dual Wallet Support**
  - Coinbase Smart Wallet (gasless, no seed phrase)
  - MetaMask and other injected wallets
  - Phantom, Solflare for Solana
- **Balance Checking** - Prevents insufficient balance errors
- **Transaction Confirmation** - Waits for approval before bridge
- **Comprehensive Error Logging** - Detailed debugging information
- **Disconnect Wallet** - Easy wallet management

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+ or Bun
- MetaMask or Coinbase Wallet
- SOL tokens on Base Sepolia (for successful bridging)

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

### Successful Bridge (SOL)
1. Connect your Base wallet (Coinbase or MetaMask)
2. Select **SOL** from the token dropdown
3. Enter your Solana wallet address
4. Enter amount and click "Send"
5. Approve both transactions (approval + bridge)
6. Wait for confirmation

### Educational Failure (USDC/ETH)
1. Select **USDC** or **ETH** from the dropdown
2. Attempt to bridge
3. Observe the "execution reverted" error
4. Check console logs for detailed error information

This demonstrates why token validation is important in cross-chain applications.

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
