// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyERC1155 is ERC1155, ERC1155Burnable, ERC1155Pausable, ERC1155Supply, Ownable {
    string public name;
    string public symbol;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => uint256) public tokenMaxSupply;
    mapping(uint256 => uint256) public tokenMintPrice;

    event TokenCreated(uint256 indexed id, uint256 maxSupply, uint256 price);

    constructor(string memory _name, string memory _symbol, string memory _uri, address _owner) ERC1155(_uri) Ownable(_owner) {
        name = _name;
        symbol = _symbol;
    }

    function createToken(uint256 id, uint256 _maxSupply, uint256 _price, string calldata _uri) external onlyOwner {
        tokenMaxSupply[id] = _maxSupply;
        tokenMintPrice[id] = _price;
        if (bytes(_uri).length > 0) { _tokenURIs[id] = _uri; }
        emit TokenCreated(id, _maxSupply, _price);
    }

    function mint(address to, uint256 id, uint256 amount, bytes memory data) external onlyOwner {
        _checkCap(id, amount);
        _mint(to, id, amount, data);
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) { _checkCap(ids[i], amounts[i]); }
        _mintBatch(to, ids, amounts, data);
    }

    function publicMint(uint256 id, uint256 amount) external payable {
        require(msg.value >= tokenMintPrice[id] * amount, "MyERC1155: insufficient payment");
        _checkCap(id, amount);
        _mint(msg.sender, id, amount, "");
    }

    function _checkCap(uint256 id, uint256 amount) internal view {
        if (tokenMaxSupply[id] > 0) { require(totalSupply(id) + amount <= tokenMaxSupply[id], "MyERC1155: cap exceeded"); }
    }

    function setURI(string calldata newUri) external onlyOwner { _setURI(newUri); }
    function setTokenURI(uint256 id, string calldata _uri) external onlyOwner { _tokenURIs[id] = _uri; }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "MyERC1155: withdrawal failed");
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory _tokenURI = _tokenURIs[tokenId];
        if (bytes(_tokenURI).length > 0) { return _tokenURI; }
        return super.uri(tokenId);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override(ERC1155, ERC1155Pausable, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
