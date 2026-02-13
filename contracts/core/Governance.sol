// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Governance is Ownable {
    IERC20 public immutable governanceToken;
    uint256 public votingPeriod;
    uint256 public quorumPercent;
    uint256 public proposalThreshold;
    uint256 public nextProposalId;

    enum ProposalState { Pending, Active, Succeeded, Defeated, Executed, Cancelled }

    struct Proposal {
        address proposer;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Proposal) public proposals;

    event ProposalCreated(uint256 indexed id, address indexed proposer, string description);
    event Voted(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);

    constructor(address _token, uint256 _votingPeriod, uint256 _quorumPercent, uint256 _threshold, address _owner) Ownable(_owner) {
        governanceToken = IERC20(_token);
        votingPeriod = _votingPeriod;
        quorumPercent = _quorumPercent;
        proposalThreshold = _threshold;
    }

    function propose(string calldata description) external returns (uint256) {
        require(governanceToken.balanceOf(msg.sender) >= proposalThreshold, "Governance: below proposal threshold");
        uint256 id = nextProposalId;
        nextProposalId++;
        Proposal storage p = proposals[id];
        p.proposer = msg.sender;
        p.description = description;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + votingPeriod;
        emit ProposalCreated(id, msg.sender, description);
        return id;
    }

    function vote(uint256 id, bool support) external {
        Proposal storage p = proposals[id];
        require(state(id) == ProposalState.Active, "Governance: proposal not active");
        require(!p.hasVoted[msg.sender], "Governance: already voted");
        uint256 weight = governanceToken.balanceOf(msg.sender);
        require(weight > 0, "Governance: no voting power");
        p.hasVoted[msg.sender] = true;
        if (support) { p.forVotes += weight; } else { p.againstVotes += weight; }
        emit Voted(id, msg.sender, support, weight);
    }

    function execute(uint256 id) external onlyOwner {
        require(state(id) == ProposalState.Succeeded, "Governance: proposal not succeeded");
        proposals[id].executed = true;
        emit ProposalExecuted(id);
    }

    function cancel(uint256 id) external {
        Proposal storage p = proposals[id];
        require(msg.sender == p.proposer || msg.sender == owner(), "Governance: not authorised");
        require(!p.executed, "Governance: already executed");
        require(!p.cancelled, "Governance: already cancelled");
        p.cancelled = true;
        emit ProposalCancelled(id);
    }

    function state(uint256 id) public view returns (ProposalState) {
        Proposal storage p = proposals[id];
        if (p.cancelled) return ProposalState.Cancelled;
        if (p.executed) return ProposalState.Executed;
        if (block.timestamp < p.startTime) return ProposalState.Pending;
        if (block.timestamp <= p.endTime) return ProposalState.Active;
        uint256 totalVotes = p.forVotes + p.againstVotes;
        uint256 tokenSupply = governanceToken.totalSupply();
        uint256 quorumVotes = (tokenSupply * quorumPercent) / 100;
        if (totalVotes >= quorumVotes && p.forVotes > p.againstVotes) return ProposalState.Succeeded;
        return ProposalState.Defeated;
    }

    function setVotingPeriod(uint256 _period) external onlyOwner { votingPeriod = _period; }
    function setQuorum(uint256 _quorum) external onlyOwner { quorumPercent = _quorum; }
    function setThreshold(uint256 _threshold) external onlyOwner { proposalThreshold = _threshold; }

    function getProposal(uint256 id) external view returns (
        address proposer, string memory description, uint256 forVotes, uint256 againstVotes,
        uint256 startTime, uint256 endTime, bool executed, bool cancelled
    ) {
        Proposal storage p = proposals[id];
        return (p.proposer, p.description, p.forVotes, p.againstVotes, p.startTime, p.endTime, p.executed, p.cancelled);
    }

    function hasVoted(uint256 id, address account) external view returns (bool) { return proposals[id].hasVoted[account]; }
}
