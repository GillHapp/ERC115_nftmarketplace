// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

// 0x09c8d21e22F1B0F35D92cf5C0868ADDEfdac1cfa sepolia ka address hai 
contract SimpleNFTMarketplace is ERC1155, Ownable, ERC1155Holder {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct NFT {
        uint256 tokenId;
        uint256 price;
        address payable seller;
        string tokenURI;
        uint256 supply;
        uint256 sold;
        bool isListed; // ✅ NEW: to track listing status
    }

    mapping(uint256 => NFT) public nftListings;


    mapping(address => uint256[]) public userOwnedTokens;

    event NFTMinted(uint256 indexed tokenId, address indexed creator, uint256 supply);
    event NFTListed(uint256 indexed tokenId, uint256 price);
    event NFTBought(uint256 indexed tokenId, address indexed buyer, uint256 amount);
    event NFTUnlisted(uint256 indexed tokenId);


    constructor() ERC1155("") Ownable(msg.sender) {}

    // Mint and list an NFT
    function mintAndListNFT(string memory _tokenURI, uint256 _price, uint256 _supply) external {
        require(_price > 0, "Price must be greater than zero");
        require(_supply > 0, "Supply must be greater than zero");

        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        // Mint NFTs to the contract
        _mint(address(this), newTokenId, _supply, "");

        // Save listing
        nftListings[newTokenId] = NFT({
            tokenId: newTokenId,
            price: _price,
            seller: payable(msg.sender),
            tokenURI: _tokenURI,
            supply: _supply,
            sold: 0,
            isListed: true
        });

        emit NFTMinted(newTokenId, msg.sender, _supply);
        emit NFTListed(newTokenId, _price);
    }


    // Buy an NFT
    function buyNFT(uint256 _tokenId, uint256 _amount) external payable {
        NFT storage nft = nftListings[_tokenId];
        require(nft.isListed, "NFT not listed for sale");
        require(_amount > 0, "Amount must be greater than 0");
        require(nft.sold + _amount <= nft.supply, "Not enough NFTs available");
        require(msg.value >= nft.price * _amount, "Insufficient payment");

        // Pay the seller
        nft.seller.transfer(msg.value);

        // Transfer the NFT to buyer
        _safeTransferFrom(address(this), msg.sender, _tokenId, _amount, "");

        // Track sales
        nft.sold += _amount;

        // Track ownership if not already tracked
        if (!_ownsToken(msg.sender, _tokenId)) {
            userOwnedTokens[msg.sender].push(_tokenId);
        }

        // If all NFTs are sold, mark as unlisted
        if (nft.sold >= nft.supply) {
            nft.isListed = false;
            emit NFTUnlisted(_tokenId);
        }

        emit NFTBought(_tokenId, msg.sender, _amount);
    }



    // Return only currently listed NFTs
    function getAllListings() external view returns (NFT[] memory) {
        uint256 total = _tokenIds.current();
        uint256 listedCount = 0;

        // Count how many NFTs are listed
        for (uint256 i = 1; i <= total; i++) {
            if (nftListings[i].isListed) {
                listedCount++;
            }
        }

        NFT[] memory listedNFTs = new NFT[](listedCount);
        uint256 index = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (nftListings[i].isListed) {
                listedNFTs[index] = nftListings[i];
                index++;
            }
        }

        return listedNFTs;
    }

    // View URI for a token
    function uri(uint256 _tokenId) public view override returns (string memory) {
        return nftListings[_tokenId].tokenURI;
    }

    // Get the list of NFTs owned by the caller
    function getMyNFTs() external view returns (uint256[] memory) {
        return userOwnedTokens[msg.sender];
    }

    // Check if a user already owns a token
    function _ownsToken(address user, uint256 tokenId) internal view returns (bool) {
        uint256[] memory owned = userOwnedTokens[user];
        for (uint256 i = 0; i < owned.length; i++) {
            if (owned[i] == tokenId) return true;
        }
        return false;
    }

    // Support interface for ERC1155 & Holder
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, ERC1155Holder) returns (bool) {
        return ERC1155.supportsInterface(interfaceId) || ERC1155Holder.supportsInterface(interfaceId);
    }
}
