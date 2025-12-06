# Tip Jar - Base-Solana Bridge Demo

A Next.js application demonstrating cross-chain token transfers between Base and Solana networks using **Chainlink CCIP** (Base → Solana) and a custom Solana Bridge Program (Solana → Base).

## 🎯 Purpose

This project serves as a **test and educational demonstration** of cross-chain bridging using Chainlink CCIP, showcasing both supported and unsupported token routes to help developers understand CCIP lane limitations.

## ⚠️ Important: CCIP Lane & Token Support

### ✅ Supported (Works on Testnet)
- **SOL (CCIP-BnM)** - Fully supported via CCIP lane between Base Sepolia and Solana Devnet
  - Base Sepolia address: `0x88a2D7A512f43a021F9856A88E12a67a2181555e`
  - Solana Devnet mint: Native SOL
  - Uses Chainlink CCIP Router for secure cross-chain transfers

### ❌ Unsupported (Educational Purpose Only)
- **USDC** - Will fail with "destination chain not supported" or transaction revert
  - Base Sepolia address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
  - Solana Devnet mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
  - **Why it fails**: No direct CCIP lane exists between Base Sepolia and Solana Devnet for USDC

**Why include unsupported tokens?**  
We intentionally left USDC in the UI for **educational purposes** to demonstrate:

1. **CCIP Lane Configuration**
   - Not all tokens are supported on all cross-chain routes
   - CCIP uses "lanes" (chain pairs) with specific token allowlists
   - Base Sepolia → Solana Devnet lane only supports CCIP-BnM test tokens

2. **Real-World Bridge Limitations**
   - Production bridges have token restrictions based on liquidity and risk
   - Token support varies by chain pair (e.g., USDC works Base Sepolia → Ethereum Sepolia)
   - Always verify token support before attempting cross-chain transfers

3. **Error Handling Patterns**
   - How CCIP router reverts for unsupported tokens
   - Importance of pre-validation before user approvals
   - User experience patterns for handling failed transactions

4. **Smart Contract Validation**
   - Token pools must exist on both source and destination chains
   - Token Admin Registry manages cross-chain token configurations
   - Burn/Mint token model requires proper pool setup

## 🚀 Features

- **Hybrid Bridging Architecture**
  - **Base → Solana**: Chainlink CCIP with auto-delivery
  - **Solana → Base**: Original Base Bridge with Merkle proofs
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


## 🚶 Educational Walkthrough

### 1. Base → Solana (New CCIP Flow)

1.  **Connect Wallets**: Connect both Base (Sender) and Solana (Recipient) wallets.
2.  **Select Token**: Choose **SOL (CCIP-BnM)**.
    *   *Note: Using USDC will trigger an educational error.*
3.  **Send**: Enter amount and click "Send".
4.  **Approve**: Wallet will ask to Approve the CCIP Router to spend your tokens.
5.  **Bridge**: Wallet will ask to sign the CCIP `ccipSend` transaction.
6.  **Wait**:
    *   The UI will show a "Pending Claim" entry.
    *   **Auto-Delivery**: Chainlink CCIP network will pick up the message and deliver it to Solana automatically (~20 mins).
    *   **Tracking**: Click **"View on CCIP Explorer"** in the UI to track the message status in real-time.

> [!TIP]
> You do not need to keep the page open. The funds will arrive in your Solana wallet automatically once finalized.

### 2. Solana → Base (Original Base Bridge)

1.  **Connect Wallets**: Connect both Solana (Sender) and Base (Recipient) wallets.
2.  **Select Token**: Choose **SOL** or **USDC**.
3.  **Enter Details**: Enter amount and Base recipient address (`0x...`).
4.  **Bridge**: Sign the bridge transaction on Solana.
5.  **Wait**:
    *   Transaction is sent to Solana Devnet
    *   Bridge program locks tokens and creates outgoing message
    *   Merkle proof is generated automatically
    *   Funds arrive on Base after finalization

> [!NOTE]
> This uses the original Base bridge architecture with Merkle proofs.

### 3. Educational Failure Walkthrough (USDC)
1. Select **USDC** token on Base.
2. Attempt to bridge to Solana.
3. Transaction will fail at `ccipSend` with:
   - "Destination chain not supported for this token"
   - Or transaction revert during fee estimation
4. **This demonstrates**:
   - Why token validation is critical before user approvals
   - How to handle and communicate bridge limitations
   - The importance of checking CCIP documentation for supported lanes

## 🔍 Key Learning Points

**For Developers:**
- Always consult [CCIP Directory](https://docs.chain.link/ccip/directory/testnet) for supported tokens per lane
- Implement pre-flight checks to validate token support before user actions
- CCIP token support is per-lane, not global (a token may work on some routes but not others)
- Test tokens (CCIP-BnM, LINK) have broader support than production tokens

**CCIP Architecture Insights:**
- Each token needs a Token Pool (Burn/Mint or Lock/Release) on both chains
- Token Admin Registry manages cross-chain token configurations
- Risk Management Network (RMN) provides additional security layer
- Fees are calculated based on token type, amount, and destination

## 📚 Further Reading

- [Chainlink CCIP Documentation](https://docs.chain.link/ccip)
- [Base Sepolia Supported Lanes](https://docs.chain.link/ccip/directory/testnet/chain/ethereum-testnet-sepolia-base-1)
- [USDC Cross-Chain Support](https://docs.chain.link/ccip/directory/testnet/token/USDC)
- [Solana CCIP Integration](https://docs.chain.link/ccip/tutorials/svm)

---

**Note:** This is a testnet demonstration. In production, you would:
1. Query CCIP Router for supported tokens before showing UI options
2. Implement proper error boundaries and user notifications
3. Use only officially supported token routes
4. Add slippage protection and fee caps

## 🔗 Contract Addresses

### Base Sepolia
- CCIP Router: `0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93`
- CCIP-BnM (Mock SOL): `0x88a2D7A512f43a021F9856A88E12a67a2181555e`

### Solana Devnet
- Chain Selector: `16423721717087811551`
- Bridge Program ID: `7c6mteAcTXaQ1MFBCrnuzoZVTTAEfZwa6wgy4bqX3KXC`
- Gas Fee Receiver: `AFs1LCbodhvwpgX3u3URLsud6R1XMSaMiQ5LtXw4GKYT`

## 📚 Resources

- [Base-Solana Bridge Documentation](https://docs.base.org/base-chain/quickstart/base-solana-bridge)
- [Base Bridge Repository](https://github.com/base/bridge)
- [Solana Devnet Explorer](https://explorer.solana.com/?cluster=devnet)

## 🏗️ Built With

- **Framework**: [Next.js 16](https://nextjs.org/)
- **Core Protocol**: [Chainlink CCIP](https://docs.chain.link/ccip)
- **EVM Interop**: [Wagmi](https://wagmi.sh/) + [Viem](https://viem.sh/)
- **Solana Interop**: [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) + [Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- **Wallet Auth**: [OnchainKit](https://onchainkit.xyz/) (Coinbase)
- **UI/Styling**: [Shadcn UI](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)

## 📄 License

MIT

## 🤝 Contributing

This is an educational project. Feel free to fork and experiment with different bridge configurations!
