# Alephium NFT

## Install

```
npm install
```

## Getting Started

First, run the development server:

```
npm run dev
# or
yarn dev
```

## Start a devnet

```
npm run start-devnet // this will start a devnet for smart contract tests
```

## Stop/restart devnet

```
npm run stop-devnet
npm run restart-devnet
```

## Testing Smart Contract

```
npm run test:contracts
```

or

```
npm run test:contracts -- nft-marketplace.test.ts
```

## Deploy Smart Contracts
Before running the application, two smart contracts need to be created:
1. A [marketplace smart contract](contracts/nft_marketplace.ral) where
   NFTs can be traded
2. A default [NFT collection smart
   contract](contracts/nft_collection.ral), which will be the default
   collection for NFTs that do not explicitly belong to any NFT
   collections

```
npm run deploy:contracts
```

## Config Environments
There are two environments available during development:
`development-nodewallet` and `browser-extension` as configured
in [alephium-configs.ts](configs/alephium-configs.ts). In
`development-nodewallet` environment, node wallet is used as signer
for authentication and signing transactions. In
`browser-extension` environment Wallet Connect is used
instead.

`development-nodewallet` is the default environment. To switch
environment, update the `ENVIRONMENT` variable in
[next.config.js](configs/next.config.js) file.

