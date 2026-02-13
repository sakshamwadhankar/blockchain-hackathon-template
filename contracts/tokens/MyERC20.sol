// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyERC20 is ERC20, ERC20Burnable, ERC20Pausable, ERC20Permit, Ownable {
    uint256 public immutable maxSupply;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initSupply,
        uint256 _maxSupply,
        address _owner
    ) ERC20(_name, _symbol) ERC20Permit(_name) Ownable(_owner) {
        require(
            _maxSupply == 0 || _initSupply <= _maxSupply,
            "MyERC20: initial supply exceeds max supply"
        );
        maxSupply = _maxSupply;
        if (_initSupply > 0) {
            _mint(_owner, _initSupply);
        }
    }

    function mint(address to, uint256 amount) external onlyOwner {
        if (maxSupply > 0) {
            require(totalSupply() + amount <= maxSupply, "MyERC20: cap exceeded");
        }
        _mint(to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
