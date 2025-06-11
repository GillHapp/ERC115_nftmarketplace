'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import CONTRACTABI from './contractABI.json';

export default function Home() {
  const CONTRACT_ADDRESS = "0x2a909c6806a4e6c14864F8407C0AAC6671DAeEfE";
  const [walletAddress, setWalletAddress] = useState(null);
  const [contract, setContract] = useState(null);
  const [nftName, setNftName] = useState('');
  const [nftMetadata, setNftMetadata] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [price, setPrice] = useState('');
  const [supply, setSupply] = useState('');
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACTABI, signer);
        setContract(contractInstance);
        console.log('✅ Contract connected');
      } catch (err) {
        console.error('❌ Wallet connection error:', err);
      }
    } else {
      alert('Please install MetaMask.');
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setContract(null);
  };

  const fetchListings = async () => {
    if (!contract) return;
    setLoadingListings(true);
    try {
      const rawListings = await contract.getAllListings();
      const processedListings = await Promise.all(
        rawListings.map(async (nft) => {
          try {
            const res = await fetch(nft.tokenURI);
            const metadata = await res.json();

            return {
              tokenId: Number(nft.tokenId),
              seller: nft.seller,
              price: ethers.formatEther(nft.price),
              supply: Number(nft.supply),
              metadata,
            };
          } catch (err) {
            console.error(`❌ Failed to fetch metadata for tokenId ${nft.tokenId}:`, err);
            return null;
          }
        })
      );
      setListings(processedListings.filter(Boolean));

      setListings(processedListings);
    } catch (err) {
      console.error('❌ Fetching listings failed:', err);
    } finally {
      setLoadingListings(false);
    }
  };

  useEffect(() => {
    if (contract) fetchListings();
  }, [contract]);





  const uploadToIPFS = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
        headers: {
          pinata_api_key: '3f964d49ce5beca2da5c',
          pinata_secret_api_key: 'dff92d908f3bba1f58524fde93a23c000bf459062e75bf4bbaabe912b24b4d5c',
          'Content-Type': 'multipart/form-data',
        },
      });
      const cid = res.data.IpfsHash;
      console.log('✅ Image uploaded:', cid);

      return cid;
    } catch (err) {
      console.error('❌ IPFS Image Upload Error:', err);
    }
  };

  const pinJSONToIPFS = async (name, description, imageCID, price, supply) => {
    const metadata = {
      name,
      description,
      image: `https://gateway.pinata.cloud/ipfs/${imageCID}`,
      price,
      supply,
    };

    try {
      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxNTAzYWNlOC1hZTc3LTRmYzUtOGFmOS0xZTIzYjhiZDhmMTIiLCJlbWFpbCI6ImdpbGxoYXJwcmVldHNpbmdoMjExQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiIzZjk2NGQ0OWNlNWJlY2EyZGE1YyIsInNjb3BlZEtleVNlY3JldCI6ImRmZjkyZDkwOGYzYmJhMWY1ODUyNGZkZTkzYTIzYzAwMGJmNDU5MDYyZTc1YmY0YmJhYWJlOTEyYjI0YjRkNWMiLCJleHAiOjE3ODExNDY3NTB9.2tIux_0yNi7yjzAEp1UFcTsX8PkY9vnsV5AW3o9Gnls`,
        },
        body: JSON.stringify(metadata),
      });
      const data = await res.json();
      console.log('✅ Metadata uploaded:', data.IpfsHash);
      return data.IpfsHash;
    } catch (err) {
      console.error('❌ Metadata upload failed:', err);
    }
  };

  const handleMintAndList = async (e) => {
    e.preventDefault();

    if (!contract) return alert('Contract not connected.');
    if (!nftName || !nftMetadata || !imageFile || !price || !supply) {
      return alert('Please fill in all fields.');
    }

    try {
      const imageCID = await uploadToIPFS(imageFile);
      if (!imageCID) return alert('Image upload failed.');

      const metadataCID = await pinJSONToIPFS(nftName, nftMetadata, imageCID, price, supply);
      const metadataURL = `https://gateway.pinata.cloud/ipfs/${metadataCID}`;

      const tx = await contract.mintAndListNFT(
        metadataURL,
        ethers.parseEther(price.toString()),
        parseInt(supply)
      );
      await tx.wait();

      alert('✅ NFT minted and listed!');
      fetchListings();
    } catch (err) {
      console.error('❌ Minting/listing error:', err);
      alert('Minting failed.');
    }
  };

  // 

  // useEffect(() => {
  //   if (contract) fetchListings();
  // }, [contract]);

  return (
    <div className="App">
      <h1>ERC1155 NFT Marketplace</h1>
      {walletAddress ? (
        <>
          <p>Connected Wallet: {walletAddress}</p>
          <button onClick={disconnectWallet}>Disconnect</button>

          <form onSubmit={handleMintAndList} className="nft-form">
            <div>
              <label>NFT Name:</label>
              <input type="text" value={nftName} onChange={(e) => setNftName(e.target.value)} />
            </div>
            <div>
              <label>Description:</label>
              <textarea value={nftMetadata} onChange={(e) => setNftMetadata(e.target.value)} />
            </div>
            <div>
              <label>Image File:</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
              />
            </div>
            <div>
              <label>Price (in ETH):</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label>Supply:</label>
              <input type="number" value={supply} onChange={(e) => setSupply(e.target.value)} />
            </div>
            <button type="submit">Mint & List NFT</button>
          </form>

          <h2>Marketplace Listings</h2>
          {loadingListings ? (
            <p>Loading...</p>
          ) : listings.length === 0 ? (
            <p>No NFTs listed.</p>
          ) : (
            <div className="nft-grid">
              {listings.map((item) => (
                <div key={item.tokenId} className="nft-card">
                  <img src={item.metadata.image} alt={item.metadata.name} width={200} />
                  <h3>{item.metadata.name}</h3>
                  <p>{item.metadata.description}</p>
                  <p><strong>Token ID:</strong> {item.tokenId}</p>
                  <p><strong>Price:</strong> Ξ {item.price}</p>
                  <p>
                    <strong>Seller:</strong> {item.seller.slice(0, 6)}...{item.seller.slice(-4)}
                  </p>
                </div>
              ))}
            </div>


          )}
        </>
      ) : (
        <button onClick={connectWallet}>Connect Wallet</button>
      )}
    </div>
  );
}

