// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyERC721 is ERC721, ERC721URIStorage, ERC721Enumerable, ERC721Burnable, ERC721Pausable, Ownable {
    uint256 private _nextId;
    uint256 public immutable maxSupply;
    uint256 public mintPrice;
    string public baseURI;
    bool public publicMintOpen;

    event Minted(address indexed to, uint256 indexed tokenId);
    event MintPriceChanged(uint256 newPrice);
    event PublicMintToggled(bool isOpen);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply,
        uint256 _mintPrice,
        string memory _baseURI,
        address _owner
    ) ERC721(_name, _symbol) Ownable(_owner) {
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        baseURI = _baseURI;
    }

    function safeMint(address to, string calldata uri) external onlyOwner returns (uint256) {
        return _doMint(to, uri);
    }

    function batchMint(address to, string[] calldata uris) external onlyOwner {
        for (uint256 i = 0; i < uris.length; i++) {
            _doMint(to, uris[i]);
        }
    }

    function publicMint(string calldata uri) external payable {
        require(publicMintOpen, "MyERC721: public mint is not open");
        require(msg.value >= mintPrice, "MyERC721: insufficient payment");
        _doMint(msg.sender, uri);
    }

    function _doMint(address to, string calldata uri) internal returns (uint256) {
        require(maxSupply == 0 || _nextId < maxSupply, "MyERC721: max supply reached");
        uint256 tokenId = _nextId;
        _nextId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit Minted(to, tokenId);
        return tokenId;
    }

    function setMintPrice(uint256 _mintPrice) external onlyOwner {
        mintPrice = _mintPrice;
        emit MintPriceChanged(_mintPrice);
    }

    function setBaseURI(string calldata _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    function togglePublicMint() external onlyOwner {
        publicMintOpen = !publicMintOpen;
        emit PublicMintToggled(publicMintOpen);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "MyERC721: withdrawal failed");
    }

    function currentTokenId() external view returns (uint256) { return _nextId; }

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable, ERC721Pausable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) { return baseURI; }
}
