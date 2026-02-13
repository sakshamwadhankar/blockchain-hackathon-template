import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MyERC721", function () {
    async function deployFixture() {
        const [owner, alice, bob] = await ethers.getSigners();
        const mintPrice = ethers.parseEther("0.01");

        const MyERC721 = await ethers.getContractFactory("MyERC721");
        const nft = await MyERC721.deploy("TestNFT", "TNFT", 100, mintPrice, "ipfs://base/", owner.address);

        return { nft, owner, alice, bob, mintPrice };
    }

    describe("Deployment", function () {
        it("Should set name and symbol correctly", async function () {
            const { nft } = await loadFixture(deployFixture);
            expect(await nft.name()).to.equal("TestNFT");
            expect(await nft.symbol()).to.equal("TNFT");
        });

        it("Should start with tokenId 0", async function () {
            const { nft } = await loadFixture(deployFixture);
            expect(await nft.currentTokenId()).to.equal(0);
        });
    });

    describe("Owner Mint", function () {
        it("Should allow owner to mint", async function () {
            const { nft, alice } = await loadFixture(deployFixture);
            await nft.safeMint(alice.address, "token0.json");
            expect(await nft.ownerOf(0)).to.equal(alice.address);
            expect(await nft.tokenURI(0)).to.equal("ipfs://base/token0.json");
        });

        it("Should revert when non-owner tries to mint", async function () {
            const { nft, alice } = await loadFixture(deployFixture);
            await expect(
                nft.connect(alice).safeMint(alice.address, "token0.json")
            ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
        });
    });

    describe("Public Mint", function () {
        it("Should revert when public mint is closed", async function () {
            const { nft, alice, mintPrice } = await loadFixture(deployFixture);
            await expect(
                nft.connect(alice).publicMint("uri.json", { value: mintPrice })
            ).to.be.revertedWith("MyERC721: public mint is not open");
        });

        it("Should allow public mint when open", async function () {
            const { nft, alice, mintPrice } = await loadFixture(deployFixture);
            await nft.togglePublicMint();
            await nft.connect(alice).publicMint("uri.json", { value: mintPrice });
            expect(await nft.ownerOf(0)).to.equal(alice.address);
        });

        it("Should revert on underpayment", async function () {
            const { nft, alice } = await loadFixture(deployFixture);
            await nft.togglePublicMint();
            await expect(
                nft.connect(alice).publicMint("uri.json", { value: ethers.parseEther("0.001") })
            ).to.be.revertedWith("MyERC721: insufficient payment");
        });
    });

    describe("Max Supply", function () {
        it("Should enforce max supply", async function () {
            const [owner, alice] = await ethers.getSigners();
            const MyERC721 = await ethers.getContractFactory("MyERC721");
            const nft = await MyERC721.deploy("Limited", "LTD", 2, 0, "", owner.address);

            await nft.safeMint(alice.address, "a");
            await nft.safeMint(alice.address, "b");
            await expect(
                nft.safeMint(alice.address, "c")
            ).to.be.revertedWith("MyERC721: max supply reached");
        });
    });

    describe("Withdraw", function () {
        it("Should allow owner to withdraw ETH", async function () {
            const { nft, owner, alice, mintPrice } = await loadFixture(deployFixture);
            await nft.togglePublicMint();
            await nft.connect(alice).publicMint("uri.json", { value: mintPrice });

            const balBefore = await ethers.provider.getBalance(owner.address);
            const tx = await nft.withdraw();
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const balAfter = await ethers.provider.getBalance(owner.address);

            expect(balAfter + gasCost - balBefore).to.equal(mintPrice);
        });
    });
});
