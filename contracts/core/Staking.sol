// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Staking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public totalStaked;
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public userRewardPaid;
    mapping(address => uint256) public rewards;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    constructor(address _stakingToken, address _rewardToken, uint256 _rewardRate, address _owner) Ownable(_owner) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        rewardRate = _rewardRate;
        lastUpdateTime = block.timestamp;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) { return rewardPerTokenStored; }
        return rewardPerTokenStored + ((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / totalStaked;
    }

    function earned(address account) public view returns (uint256) {
        return (stakedBalance[account] * (rewardPerToken() - userRewardPaid[account])) / 1e18 + rewards[account];
    }

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Staking: amount must be > 0");
        totalStaked += amount;
        stakedBalance[msg.sender] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Staking: amount must be > 0");
        require(stakedBalance[msg.sender] >= amount, "Staking: insufficient balance");
        totalStaked -= amount;
        stakedBalance[msg.sender] -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimReward() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "Staking: no reward to claim");
        rewards[msg.sender] = 0;
        rewardToken.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    function emergencyWithdraw() external nonReentrant {
        uint256 amount = stakedBalance[msg.sender];
        require(amount > 0, "Staking: nothing to withdraw");
        totalStaked -= amount;
        stakedBalance[msg.sender] = 0;
        rewards[msg.sender] = 0;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function setRewardRate(uint256 _rewardRate) external onlyOwner updateReward(address(0)) { rewardRate = _rewardRate; }
    function fundRewards(uint256 amount) external onlyOwner { rewardToken.safeTransferFrom(msg.sender, address(this), amount); }
}
