// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Marketplace is ERC721Holder, Ownable, ReentrancyGuard {
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    uint256 public nextListingId;
    uint256 public platformFeeBps;
    uint256 public constant MAX_FEE = 1000;
    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed id, address indexed seller, address nftContract, uint256 tokenId, uint256 price);
    event Sold(uint256 indexed id, address indexed buyer, uint256 price);
    event Cancelled(uint256 indexed id);
    event PriceSet(uint256 indexed id, uint256 price);

    constructor(uint256 _feeBps, address _owner) Ownable(_owner) {
        require(_feeBps <= MAX_FEE, "Marketplace: fee exceeds max");
        platformFeeBps = _feeBps;
    }

    function list(address nft, uint256 tokenId, uint256 price) external returns (uint256) {
        require(price > 0, "Marketplace: price must be > 0");
        require(IERC721(nft).ownerOf(tokenId) == msg.sender, "Marketplace: not NFT owner");
        require(IERC721(nft).getApproved(tokenId) == address(this) || IERC721(nft).isApprovedForAll(msg.sender, address(this)), "Marketplace: not approved");
        IERC721(nft).safeTransferFrom(msg.sender, address(this), tokenId);
        uint256 id = nextListingId;
        nextListingId++;
        listings[id] = Listing({seller: msg.sender, nftContract: nft, tokenId: tokenId, price: price, active: true});
        emit Listed(id, msg.sender, nft, tokenId, price);
        return id;
    }

    function cancel(uint256 id) external {
        Listing storage listing = listings[id];
        require(listing.active, "Marketplace: not active");
        require(listing.seller == msg.sender, "Marketplace: not seller");
        listing.active = false;
        IERC721(listing.nftContract).safeTransferFrom(address(this), msg.sender, listing.tokenId);
        emit Cancelled(id);
    }

    function updatePrice(uint256 id, uint256 price) external {
        Listing storage listing = listings[id];
        require(listing.active, "Marketplace: not active");
        require(listing.seller == msg.sender, "Marketplace: not seller");
        require(price > 0, "Marketplace: price must be > 0");
        listing.price = price;
        emit PriceSet(id, price);
    }

    function buy(uint256 id) external payable nonReentrant {
        Listing storage listing = listings[id];
        require(listing.active, "Marketplace: not active");
        require(msg.value >= listing.price, "Marketplace: insufficient payment");
        require(msg.sender != listing.seller, "Marketplace: buyer is seller");
        listing.active = false;
        uint256 fee = (listing.price * platformFeeBps) / 10000;
        uint256 sellerProceeds = listing.price - fee;
        IERC721(listing.nftContract).safeTransferFrom(address(this), msg.sender, listing.tokenId);
        (bool success, ) = payable(listing.seller).call{value: sellerProceeds}("");
        require(success, "Marketplace: seller payment failed");
        uint256 excess = msg.value - listing.price;
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Marketplace: refund failed");
        }
        emit Sold(id, msg.sender, listing.price);
    }

    function setFee(uint256 bps) external onlyOwner {
        require(bps <= MAX_FEE, "Marketplace: fee exceeds max");
        platformFeeBps = bps;
    }

    function withdrawFees() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Marketplace: withdrawal failed");
    }
}
