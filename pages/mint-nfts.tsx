import { useState } from 'react'
import { create as ipfsHttpClient } from 'ipfs-http-client'
import { useRouter } from 'next/router'
import { Contract, Script, stringToHex, contractIdFromAddress, binToHex } from 'alephium-web3'
import { testAddress1, testWallet1 } from '../utils/signers'
import { subContractId, addressFromContractId } from '../utils'
import { provider } from '../utils/providers'

const client = ipfsHttpClient('https://ipfs.infura.io:5001/api/v0')

import { NFTCollectionContract } from '../utils/contracts'
import { NFTContract } from '../utils/contracts'
import { mintNFTScript } from '../utils/contracts'
import { withdrawNFTScript } from '../utils/contracts'
import { debug } from 'util'

export default function MintNFT() {
    const [fileUrl, setFileUrl] = useState(null)
    const [formInput, updateFormInput] = useState({ name: '', description: '' })
    const router = useRouter()

    async function onChange(e) {
        const file = e.target.files[0]
        try {
            const added = await client.add(
                file,
                {
                    progress: (prog) => console.log(`received: ${prog}`)
                }
            )
            const url = `https://ipfs.infura.io/ipfs/${added.path}`
            setFileUrl(url)
        } catch (error) {
            console.log('Error uploading file: ', error)
        }
    }

    async function uploadToIPFS() {
        const { name, description } = formInput
        if (!name || !description || !fileUrl) return
        /* first, upload to IPFS */
        const data = JSON.stringify({
            name, description, image: fileUrl
        })
        try {
            const added = await client.add(data)
            const url = `https://ipfs.infura.io/ipfs/${added.path}`
            /* after file is uploaded to IPFS, return the URL to use it in the transaction */
            return url
        } catch (error) {
            console.log('Error uploading file: ', error)
        }
    }

    async function mintNFT() {
        const signer = await testWallet1(provider)
        const uri = await uploadToIPFS()
        const name = formInput.name
        const description = formInput.description

        // TODO: Figure out UI to create collection
        const nftCollectionTx = await NFTCollectionContract.transactionForDeployment(
            signer,
            {
                initialFields: {
                    nftByteCode: NFTContract.bytecode,
                    collectionName: stringToHex(name),
                    collectionDescription: stringToHex(description),
                    collectionUri: stringToHex(uri)
                }
            }
        )

        const nftCollectionTxResult = await signer.submitTransaction(
            nftCollectionTx.unsignedTx, nftCollectionTx.txId, testAddress1
        )

        const nftCollectionContractId = nftCollectionTx.contractId
        const nftContractId = subContractId(nftCollectionContractId, stringToHex(uri))

        const mintNFTTx = await mintNFTScript.transactionForDeployment(
            signer,
            {
                initialFields: {
                    nftCollectionContractId: nftCollectionContractId,
                    name: stringToHex(name),
                    description: stringToHex(description),
                    uri: stringToHex(uri)
                },
                gasAmount: 200000
            }
        )

        const mintNFTResult = await signer.submitTransaction(
            mintNFTTx.unsignedTx, mintNFTTx.txId, testAddress1
        )

        const withdrawNFTTx = await withdrawNFTScript.transactionForDeployment(
            signer,
            {
                initialFields: {
                    nftContractId: nftContractId
                }
            }
        )

        const withdrawNFTResult = await signer.submitTransaction(
            withdrawNFTTx.unsignedTx, withdrawNFTTx.txId, testAddress1
        )

        router.push('/')
    }

    return (
        <div className="flex justify-center">
            <div className="w-1/2 flex flex-col pb-12">
                <input
                    placeholder="Asset Name"
                    className="mt-8 border rounded p-4"
                    onChange={e => updateFormInput({ ...formInput, name: e.target.value })}
                />
                <textarea
                    placeholder="Asset Description"
                    className="mt-2 border rounded p-4"
                    onChange={e => updateFormInput({ ...formInput, description: e.target.value })}
                />
                <input
                    type="file"
                    name="Asset"
                    className="my-4"
                    onChange={onChange}
                />
                {
                    fileUrl && (
                        <img className="rounded mt-4" width="350" src={fileUrl} />
                    )
                }
                <button onClick={mintNFT} className="font-bold mt-4 bg-pink-500 text-white rounded p-4 shadow-lg">
                    Mint NFT
                </button>
            </div>
        </div>
    )
}