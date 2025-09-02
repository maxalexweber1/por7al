# POR7AL LOCK SCRIPT
![alt text](por7al_script.png)

POR7AL provides a simple mechanism to **lock NFTs permanently** to a user’s stake address while keeping them visible in the wallet.  
The trick is to replace the **payment credential** of a standard Cardano address with a special **locking smart contract**.  
This creates a new lock address that still carries the user’s **stake key**, but cannot ever be spent.  

More Infos: [Open main README](../README.md)

## Quickstart

### Requirements
- Node.js ≥ 18  
- npm ≥ 9  
- Blockfrost project ID  
- BIP-39 mnemonic (24 words)

### Setup
```bash
npm init -y
npm i @meshsdk/core @emurgo/cardano-serialization-lib-nodejs blakejs dotenv
npm i -D ts-node typescript @types/node
```

### Create .env.local in scripts/:
```bash
BLOCKFROST_PROJECT_ID=your_blockfrost_id
MNEMONIC="word1 word2 ... word24"
```

### Change Policy ID in lock_script.ts
```bash
line 30: const policy_id = 'def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea';
```

### Run Script
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' lock_script.ts
```