import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Staking", function () {
    async function deployFixture() {
        const [owner, user1, user2] = await ethers.getSigners();

        const MyERC20 = await ethers.getContractFactory("MyERC20");

        // Deploy stake and reward tokens (no max supply)
        const stakeToken = await MyERC20.deploy("Stake", "STK", ethers.parseEther("1000000"), 0, owner.address);
        const rewardToken = await MyERC20.deploy("Reward", "RWD", ethers.parseEther("1000000"), 0, owner.address);

        // Deploy Staking (1 token/sec reward rate)
        const rewardRate = ethers.parseEther("1");
        const Staking = await ethers.getContractFactory("Staking");
        const staking = await Staking.deploy(
            await stakeToken.getAddress(),
            await rewardToken.getAddress(),
            rewardRate,
            owner.address
        );

        // Fund 100K reward tokens to staking contract
        const fundAmount = ethers.parseEther("100000");
        await rewardToken.approve(await staking.getAddress(), fundAmount);
        await staking.fundRewards(fundAmount);

        // Give user1 and user2 each 10K stake tokens
        const userAmount = ethers.parseEther("10000");
        await stakeToken.transfer(user1.address, userAmount);
        await stakeToken.transfer(user2.address, userAmount);

        // Both approve staking contract with MaxUint256
        await stakeToken.connect(user1).approve(await staking.getAddress(), ethers.MaxUint256);
        await stakeToken.connect(user2).approve(await staking.getAddress(), ethers.MaxUint256);

        return { stakeToken, rewardToken, staking, owner, user1, user2 };
    }

    it("Should stake tokens correctly", async function () {
        const { staking, user1 } = await loadFixture(deployFixture);
        const amount = ethers.parseEther("1000");

        await staking.connect(user1).stake(amount);

        expect(await staking.stakedBalance(user1.address)).to.equal(amount);
        expect(await staking.totalStaked()).to.equal(amount);
    });

    it("Should unstake tokens correctly", async function () {
        const { staking, user1 } = await loadFixture(deployFixture);

        await staking.connect(user1).stake(ethers.parseEther("1000"));
        await staking.connect(user1).unstake(ethers.parseEther("400"));

        expect(await staking.stakedBalance(user1.address)).to.equal(ethers.parseEther("600"));
    });

    it("Should accrue rewards over time", async function () {
        const { staking, user1 } = await loadFixture(deployFixture);

        await staking.connect(user1).stake(ethers.parseEther("1000"));
        await time.increase(100);

        const earned = await staking.earned(user1.address);
        expect(earned).to.be.gte(ethers.parseEther("99"));
    });

    it("Should allow claiming rewards", async function () {
        const { staking, rewardToken, user1 } = await loadFixture(deployFixture);

        await staking.connect(user1).stake(ethers.parseEther("1000"));
        await time.increase(50);

        await staking.connect(user1).claimReward();
        const rewardBal = await rewardToken.balanceOf(user1.address);
        expect(rewardBal).to.be.gte(ethers.parseEther("49"));
    });

    it("Should support emergency withdraw", async function () {
        const { staking, stakeToken, user1 } = await loadFixture(deployFixture);

        await staking.connect(user1).stake(ethers.parseEther("1000"));
        await time.increase(100);

        await staking.connect(user1).emergencyWithdraw();

        expect(await staking.stakedBalance(user1.address)).to.equal(0);
        expect(await staking.rewards(user1.address)).to.equal(0);
        expect(await stakeToken.balanceOf(user1.address)).to.equal(ethers.parseEther("10000"));
    });

    it("Should split rewards between two stakers", async function () {
        const { staking, user1, user2 } = await loadFixture(deployFixture);

        await staking.connect(user1).stake(ethers.parseEther("1000"));
        await staking.connect(user2).stake(ethers.parseEther("1000"));

        await time.increase(100);

        const earned1 = await staking.earned(user1.address);
        const earned2 = await staking.earned(user2.address);

        // Each should earn approximately 50 tokens (half of 100 seconds * 1 token/sec)
        expect(earned1).to.be.gte(ethers.parseEther("49"));
        expect(earned2).to.be.gte(ethers.parseEther("49"));
    });
});
