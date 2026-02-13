import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MyERC20", function () {
    async function deployFixture() {
        const [owner, alice, bob] = await ethers.getSigners();
        const initialSupply = ethers.parseEther("1000000");
        const maxSupply = ethers.parseEther("10000000");

        const MyERC20 = await ethers.getContractFactory("MyERC20");
        const token = await MyERC20.deploy("TestToken", "TT", initialSupply, maxSupply, owner.address);

        return { token, owner, alice, bob, initialSupply, maxSupply };
    }

    describe("Deployment", function () {
        it("Should set name, symbol, decimals correctly", async function () {
            const { token } = await loadFixture(deployFixture);
            expect(await token.name()).to.equal("TestToken");
            expect(await token.symbol()).to.equal("TT");
            expect(await token.decimals()).to.equal(18);
        });

        it("Should mint initial supply to owner", async function () {
            const { token, owner, initialSupply } = await loadFixture(deployFixture);
            expect(await token.balanceOf(owner.address)).to.equal(initialSupply);
        });

        it("Should set maxSupply correctly", async function () {
            const { token, maxSupply } = await loadFixture(deployFixture);
            expect(await token.maxSupply()).to.equal(maxSupply);
        });
    });

    describe("Mint", function () {
        it("Should allow owner to mint tokens", async function () {
            const { token, alice } = await loadFixture(deployFixture);
            await token.mint(alice.address, ethers.parseEther("500"));
            expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("500"));
        });

        it("Should revert when non-owner tries to mint", async function () {
            const { token, alice } = await loadFixture(deployFixture);
            await expect(
                token.connect(alice).mint(alice.address, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
        });

        it("Should revert when minting exceeds maxSupply", async function () {
            const { token, alice, maxSupply, initialSupply } = await loadFixture(deployFixture);
            const remaining = maxSupply - initialSupply;
            await expect(
                token.mint(alice.address, remaining + 1n)
            ).to.be.revertedWith("MyERC20: cap exceeded");
        });
    });

    describe("Burn", function () {
        it("Should allow holder to burn tokens", async function () {
            const { token, owner, initialSupply } = await loadFixture(deployFixture);
            const burnAmount = ethers.parseEther("100");
            await token.burn(burnAmount);
            expect(await token.balanceOf(owner.address)).to.equal(initialSupply - burnAmount);
        });
    });

    describe("Pause", function () {
        it("Should prevent transfers when paused", async function () {
            const { token, alice } = await loadFixture(deployFixture);
            await token.pause();
            await expect(
                token.transfer(alice.address, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("Should allow transfers after unpause", async function () {
            const { token, alice } = await loadFixture(deployFixture);
            await token.pause();
            await token.unpause();
            await expect(
                token.transfer(alice.address, ethers.parseEther("100"))
            ).to.not.be.reverted;
        });
    });

    describe("Transfer", function () {
        it("Should transfer tokens correctly", async function () {
            const { token, owner, alice, bob } = await loadFixture(deployFixture);
            await token.transfer(alice.address, ethers.parseEther("100"));
            await token.connect(alice).transfer(bob.address, ethers.parseEther("40"));
            expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("60"));
            expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("40"));
        });
    });
});
