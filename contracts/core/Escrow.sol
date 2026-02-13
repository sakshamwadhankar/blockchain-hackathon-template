// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Escrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum DealState { Created, Delivered, Released, Cancelled, Disputed, Resolved }

    struct Deal {
        address buyer;
        address seller;
        address arbiter;
        address token; // address(0) = ETH
        uint256 amount;
        uint256 deadline;
        DealState state;
    }

    uint256 public nextDealId;
    uint256 public feeBps;
    uint256 public constant MAX_FEE = 500;
    mapping(uint256 => Deal) public deals;

    event DealCreated(uint256 indexed id, address buyer, address seller, address arbiter, uint256 amount, address token);
    event DealDelivered(uint256 indexed id);
    event DealReleased(uint256 indexed id);
    event DealCancelled(uint256 indexed id);
    event DealDisputed(uint256 indexed id);
    event DealResolved(uint256 indexed id, bool releasedToSeller);

    constructor(uint256 _feeBps, address _owner) Ownable(_owner) {
        require(_feeBps <= MAX_FEE, "Escrow: fee exceeds max");
        feeBps = _feeBps;
    }

    function createDealETH(address seller, address arbiter, uint256 deadline) external payable returns (uint256) {
        require(msg.value > 0, "Escrow: amount must be > 0");
        require(seller != address(0), "Escrow: invalid seller");
        require(deadline > block.timestamp, "Escrow: deadline must be future");
        uint256 id = nextDealId++;
        deals[id] = Deal(msg.sender, seller, arbiter, address(0), msg.value, deadline, DealState.Created);
        emit DealCreated(id, msg.sender, seller, arbiter, msg.value, address(0));
        return id;
    }

    function createDealToken(address seller, address arbiter, address token, uint256 amount, uint256 deadline) external returns (uint256) {
        require(amount > 0, "Escrow: amount must be > 0");
        require(seller != address(0), "Escrow: invalid seller");
        require(token != address(0), "Escrow: invalid token");
        require(deadline > block.timestamp, "Escrow: deadline must be future");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 id = nextDealId++;
        deals[id] = Deal(msg.sender, seller, arbiter, token, amount, deadline, DealState.Created);
        emit DealCreated(id, msg.sender, seller, arbiter, amount, token);
        return id;
    }

    function markDelivered(uint256 id) external {
        Deal storage deal = deals[id];
        require(deal.state == DealState.Created, "Escrow: invalid state");
        require(msg.sender == deal.seller, "Escrow: not seller");
        deal.state = DealState.Delivered;
        emit DealDelivered(id);
    }

    function release(uint256 id) external nonReentrant {
        Deal storage deal = deals[id];
        require(deal.state == DealState.Created || deal.state == DealState.Delivered, "Escrow: invalid state");
        require(msg.sender == deal.buyer, "Escrow: not buyer");
        deal.state = DealState.Released;
        _pay(deal.seller, deal.token, deal.amount);
        emit DealReleased(id);
    }

    function cancelDeal(uint256 id) external nonReentrant {
        Deal storage deal = deals[id];
        require(deal.state == DealState.Created, "Escrow: invalid state");
        require(msg.sender == deal.buyer || msg.sender == deal.seller, "Escrow: not party");
        deal.state = DealState.Cancelled;
        _pay(deal.buyer, deal.token, deal.amount);
        emit DealCancelled(id);
    }

    function dispute(uint256 id) external {
        Deal storage deal = deals[id];
        require(deal.state == DealState.Created || deal.state == DealState.Delivered, "Escrow: invalid state");
        require(msg.sender == deal.buyer || msg.sender == deal.seller, "Escrow: not party");
        require(deal.arbiter != address(0), "Escrow: no arbiter");
        deal.state = DealState.Disputed;
        emit DealDisputed(id);
    }

    function resolve(uint256 id, bool releaseToSeller) external nonReentrant {
        Deal storage deal = deals[id];
        require(deal.state == DealState.Disputed, "Escrow: not disputed");
        require(msg.sender == deal.arbiter, "Escrow: not arbiter");
        deal.state = DealState.Resolved;
        address recipient = releaseToSeller ? deal.seller : deal.buyer;
        _pay(recipient, deal.token, deal.amount);
        emit DealResolved(id, releaseToSeller);
    }

    function claimExpired(uint256 id) external nonReentrant {
        Deal storage deal = deals[id];
        require(deal.state == DealState.Created || deal.state == DealState.Delivered, "Escrow: invalid state");
        require(block.timestamp > deal.deadline, "Escrow: not expired");
        require(msg.sender == deal.buyer, "Escrow: not buyer");
        deal.state = DealState.Cancelled;
        _pay(deal.buyer, deal.token, deal.amount);
        emit DealCancelled(id);
    }

    function _pay(address to, address token, uint256 amount) internal {
        uint256 fee = (amount * feeBps) / 10000;
        uint256 payout = amount - fee;
        if (token == address(0)) {
            (bool success, ) = payable(to).call{value: payout}("");
            require(success, "Escrow: ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, payout);
        }
    }

    function setFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE, "Escrow: fee exceeds max");
        feeBps = _feeBps;
    }

    function withdrawFees() external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal > 0) {
            (bool success, ) = payable(owner()).call{value: bal}("");
            require(success, "Escrow: ETH withdrawal failed");
        }
    }

    function withdrawTokenFees(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) { IERC20(token).safeTransfer(owner(), bal); }
    }
}
