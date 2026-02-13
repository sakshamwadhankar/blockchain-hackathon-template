// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract Vault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    mapping(address => uint256) public ethBalances;
    mapping(address => mapping(address => uint256)) public tokenBalances;
    uint256 public totalETH;
    mapping(address => uint256) public totalTokens;

    event ETHDeposited(address indexed user, uint256 amount);
    event ETHWithdrawn(address indexed user, uint256 amount);
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event TokenWithdrawn(address indexed user, address indexed token, uint256 amount);

    constructor(address _owner) Ownable(_owner) {}

    function depositETH() external payable whenNotPaused {
        require(msg.value > 0, "Vault: amount must be > 0");
        ethBalances[msg.sender] += msg.value;
        totalETH += msg.value;
        emit ETHDeposited(msg.sender, msg.value);
    }

    function withdrawETH(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Vault: amount must be > 0");
        require(ethBalances[msg.sender] >= amount, "Vault: insufficient balance");
        ethBalances[msg.sender] -= amount;
        totalETH -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Vault: ETH transfer failed");
        emit ETHWithdrawn(msg.sender, amount);
    }

    function depositToken(address token, uint256 amount) external whenNotPaused {
        require(amount > 0, "Vault: amount must be > 0");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        tokenBalances[msg.sender][token] += amount;
        totalTokens[token] += amount;
        emit TokenDeposited(msg.sender, token, amount);
    }

    function withdrawToken(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Vault: amount must be > 0");
        require(tokenBalances[msg.sender][token] >= amount, "Vault: insufficient balance");
        tokenBalances[msg.sender][token] -= amount;
        totalTokens[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit TokenWithdrawn(msg.sender, token, amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
