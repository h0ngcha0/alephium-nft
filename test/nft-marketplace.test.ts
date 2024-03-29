import * as web3 from '@alephium/web3'
import { testWallet1, testAddress1, testAddress2 } from './signers'
import { NFTCollection } from '../utils/nft-collection'
import { NFTMarketplace } from '../utils/nft-marketplace'
import { addressFromContractId, NodeProvider } from '@alephium/web3'
import { NFTContract, NFTListingContract, NFTMarketplaceContract } from '../utils/contracts'

describe('nft marketplace', function() {
  test('Create NFT listing, update price and buy NFT through NFT marketplace', async () => {
    const provider = new web3.NodeProvider('http://127.0.0.1:22973')
    const signer = await testWallet1(provider)
    const nftCollection = new NFTCollection(provider, signer, testAddress1, true)
    const nftMarketplace = new NFTMarketplace(provider, signer, testAddress1, true)

    const nftMarketplaceDeployTx = await nftMarketplace.create()
    const nftMarketplaceContractAddress = nftMarketplaceDeployTx.contractAddress
    const nftMarketplaceContractId = nftMarketplaceDeployTx.contractId
    const nftCollectionDeployTx = await nftCollection.create(
      "CryptoPunk", "CP", "https://www.larvalabs.com/cryptopunks"
    )
    const nftCollectionContractId = nftCollectionDeployTx.contractId

    const nftUri = "https://cryptopunks.app/cryptopunks/details/1"
    const nftContractId = web3.subContractId(nftCollectionContractId, web3.stringToHex(nftUri))
    const nftContractAddress = web3.addressFromContractId(nftContractId)
    await nftCollection.mintNFT(
      nftCollectionContractId,
      "CryptoPunk #0001",
      "CP0001",
      nftUri
    )

    const nftContractState = await NFTContract.fetchState(provider, nftContractAddress, 0)
    expect(nftContractState.fields.owner).toEqual(testAddress1)

    const tokenId = nftContractId
    const price = BigInt("1000000000000000000")
    const nftListingContractId = web3.subContractId(nftMarketplaceContractId, tokenId)
    const nftListingContractAddress = web3.addressFromContractId(nftListingContractId)

    // Deposit NFT since it is withdrawn automatically when minted
    await nftCollection.depositNFT(nftContractId)

    // list NFT
    {
      await nftMarketplace.listNFT(tokenId, price, nftMarketplaceContractId)
      await web3.timeout(3000)

      const nftMarketplaceContractEvents = await provider.events.getEventsContractContractaddress(
        nftMarketplaceContractAddress,
        { start: 0, group: 0 }
      )
      expect(nftMarketplaceContractEvents.events.length).toEqual(1)

      const nftListedEventFields = nftMarketplaceContractEvents.events[0].fields
      expect(BigInt(+nftListedEventFields[0].value)).toEqual(price)
      expect(nftListedEventFields[1].value).toEqual(tokenId)
      expect(nftListedEventFields[2].value).toEqual(testAddress1)

      // Check the initial state for NFT listing
      const nftListingContractState = await NFTListingContract.fetchState(provider, nftListingContractAddress, 0)
      expect(nftListingContractState.fields.price).toEqual(price)
      expect(nftListingContractState.fields.tokenId).toEqual(tokenId)
      expect(nftListingContractState.fields.tokenOwner).toEqual(testAddress1)
      expect(nftListingContractState.fields.marketAddress).toEqual(nftMarketplaceContractAddress)
      expect(nftListingContractState.fields.commissionRate).toEqual(200)
    }

    // Update the price
    const newPrice = BigInt("2000000000000000000")
    {
      await nftMarketplace.updateNFTPrice(newPrice, tokenId, nftMarketplaceContractId)
      const nftListingContractState = await NFTListingContract.fetchState(provider, nftListingContractAddress, 0)
      expect(nftListingContractState.fields.price).toEqual(newPrice)

      const nftMarketplaceContractEvents = await provider.events.getEventsContractContractaddress(
        nftMarketplaceContractAddress,
        { start: 1, group: 0 }
      )
      expect(nftMarketplaceContractEvents.events.length).toEqual(1)

      const nftPriceUpdatedEventFields = nftMarketplaceContractEvents.events[0].fields
      expect(nftPriceUpdatedEventFields[0].value).toEqual(tokenId)
      expect(BigInt(+nftPriceUpdatedEventFields[1].value)).toEqual(price)
      expect(BigInt(+nftPriceUpdatedEventFields[2].value)).toEqual(newPrice)
    }
    // TODO: verify other signer won't be able to update price


    // Buy the NFT
    {
      const nftContractStateBefore = await NFTContract.fetchState(provider, nftContractAddress, 0)
      expect(nftContractStateBefore.fields.owner).toEqual(nftListingContractAddress)

      const totalAmount = newPrice + BigInt("1000000000000000000")
      await nftMarketplace.buyNFT(totalAmount, tokenId, nftMarketplaceContractId)
      await web3.timeout(3000)

      const nftContractStateAfter = await NFTContract.fetchState(provider, nftContractAddress, 0)
      expect(nftContractStateAfter.fields.owner).toEqual(testAddress1)

      const nftMarketplaceContractEvents = await provider.events.getEventsContractContractaddress(
        nftMarketplaceContractAddress,
        { start: 2, group: 0 }
      )
      expect(nftMarketplaceContractEvents.events.length).toEqual(1)

      const nftPriceUpdatedEventFields = nftMarketplaceContractEvents.events[0].fields
      expect(BigInt(+nftPriceUpdatedEventFields[0].value)).toEqual(newPrice)
      expect(nftPriceUpdatedEventFields[1].value).toEqual(tokenId)
      expect(nftPriceUpdatedEventFields[2].value).toEqual(testAddress1)
      expect(nftPriceUpdatedEventFields[3].value).toEqual(testAddress1)

      // TODO: Verify NFTListingContract is gone
    }

    // Withdraw & Deposit NFT
    {
      expect((await getTokens(provider, testAddress1))).not.toContain(tokenId)

      await nftCollection.withdrawNFT(nftContractId)

      expect((await getTokens(provider, testAddress1))).toContain(tokenId)

      await nftCollection.depositNFT(nftContractId)

      expect((await getTokens(provider, testAddress1))).not.toContain(tokenId)
    }

    // Cancel the listing
    {
      await nftMarketplace.listNFT(tokenId, price, nftMarketplaceContractId)

      const nftMarketplaceContractEvents = await provider.events.getEventsContractContractaddress(
        nftMarketplaceContractAddress,
        { start: 3, group: 0 }
      )

      expect(nftMarketplaceContractEvents.events.length).toEqual(1)

      const nftListedEventFields = nftMarketplaceContractEvents.events[0].fields
      const nftListingContractId = nftListedEventFields[3].value.toString()
      const nftListingContractAddress = addressFromContractId(nftListingContractId)

      const nftContractStateBefore = await NFTContract.fetchState(provider, nftContractAddress, 0)
      expect(nftContractStateBefore.fields.owner).toEqual(nftListingContractAddress)

      const nftListingContractState = await NFTListingContract.fetchState(provider, nftListingContractAddress, 0)
      expect(nftListingContractState.fields.tokenOwner).toEqual(testAddress1)

      await nftMarketplace.cancelNFTListing(tokenId, nftMarketplaceContractId)

      const nftContractStateAfter = await NFTContract.fetchState(provider, nftContractAddress, 0)
      expect(nftContractStateAfter.fields.owner).toEqual(testAddress1)

      // TODO: Verify NFTListingContract is gone
    }
  }, 30000)

  test('Update metadata in the NFT marketplace', async () => {
    const provider = new web3.NodeProvider('http://127.0.0.1:22973')
    const signer = await testWallet1(provider)
    const nftMarketplace = new NFTMarketplace(provider, signer, testAddress1, true)

    const nftMarketplaceDeployTx = await nftMarketplace.create()
    const nftMarketplaceContractAddress = nftMarketplaceDeployTx.contractAddress
    const nftMarketplaceContractId = nftMarketplaceDeployTx.contractId

    // Update listing price
    await checkListingFee(
      provider,
      nftMarketplace,
      nftMarketplaceContractId,
      nftMarketplaceContractAddress
    )(10, 20, 20)

    // Update Commission Rate
    await checkCommissionRate(
      provider,
      nftMarketplace,
      nftMarketplaceContractId,
      nftMarketplaceContractAddress
    )(200, 250, 250)

    // Update Admin
    await checkUpdateAdmin(
      provider,
      nftMarketplace,
      nftMarketplaceContractId,
      nftMarketplaceContractAddress
    )(testAddress1, testAddress2, testAddress2)

    // Update with the wrong admin will *not* update the values correctly
    await checkListingFee(
      provider,
      nftMarketplace,
      nftMarketplaceContractId,
      nftMarketplaceContractAddress
    )(20, 10, 20)

    await checkCommissionRate(
      provider,
      nftMarketplace,
      nftMarketplaceContractId,
      nftMarketplaceContractAddress
    )(250, 200, 250)

    await checkUpdateAdmin(
      provider,
      nftMarketplace,
      nftMarketplaceContractId,
      nftMarketplaceContractAddress
    )(testAddress2, testAddress1, testAddress2)
  }, 15000)

  function checkListingFee(
    provider: NodeProvider,
    nftMarketplace: NFTMarketplace,
    nftMarketplaceContractId: string,
    nftMarketplaceContractAddress: string
  ) {
    return async (previousValue: number, updateValue: number, updatedValue: number) => {
      const stateBefore = await NFTMarketplaceContract.fetchState(provider, nftMarketplaceContractAddress, 0)
      expect(stateBefore.fields.listingFee).toEqual(previousValue)

      await nftMarketplace.updateListingFee(updateValue, nftMarketplaceContractId)

      const stateAfter = await NFTMarketplaceContract.fetchState(provider, nftMarketplaceContractAddress, 0)
      expect(stateAfter.fields.listingFee).toEqual(updatedValue)
    }
  }

  function checkCommissionRate(
    provider: NodeProvider,
    nftMarketplace: NFTMarketplace,
    nftMarketplaceContractId: string,
    nftMarketplaceContractAddress: string
  ) {
    return async (previousValue: number, updateValue: number, updatedValue: number) => {
      const stateBefore = await NFTMarketplaceContract.fetchState(provider, nftMarketplaceContractAddress, 0)
      expect(stateBefore.fields.commissionRate).toEqual(previousValue)

      await nftMarketplace.updateCommissionRate(updateValue, nftMarketplaceContractId)

      const stateAfter = await NFTMarketplaceContract.fetchState(provider, nftMarketplaceContractAddress, 0)
      expect(stateAfter.fields.commissionRate).toEqual(updatedValue)
    }
  }

  function checkUpdateAdmin(
    provider: NodeProvider,
    nftMarketplace: NFTMarketplace,
    nftMarketplaceContractId: string,
    nftMarketplaceContractAddress: string
  ) {
    return async (previousValue: string, updateValue: string, updatedValue: string) => {
      const stateBefore = await NFTMarketplaceContract.fetchState(provider, nftMarketplaceContractAddress, 0)
      expect(stateBefore.fields.admin).toEqual(previousValue)

      await nftMarketplace.updateAdmin(updateValue, nftMarketplaceContractId)

      const stateAfter = await NFTMarketplaceContract.fetchState(provider, nftMarketplaceContractAddress, 0)
      expect(stateAfter.fields.admin).toEqual(updatedValue)
    }
  }

  async function getTokens(
    provider: NodeProvider,
    address: string
  ): Promise<string[]> {
    const utxos = await provider.addresses.getAddressesAddressUtxos(address)
    return utxos.utxos.flatMap((utxo) => utxo.tokens).map((token) => token.id)
  }
})
