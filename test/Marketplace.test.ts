import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Marketplace", function () {
    async function deployFixture() {
        const [owner, seller, buyer] = await ethers.getSigners();

        // Deploy NFT (no limits)
        const MyERC721 = await ethers.getContractFactory("MyERC721");
        const nft = await MyERC721.deploy("TestNFT", "TNFT", 0, 0, "", owner.address);

        // Deploy Marketplace (250 bps = 2.5%)
        const Marketplace = await ethers.getContractFactory("Marketplace");
        const marketplace = await Marketplace.deploy(250, owner.address);

        // Mint NFT #0 to seller
        await nft.safeMint(seller.address, "token0.json");

        // Seller approves marketplace
        await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

        return { nft, marketplace, owner, seller, buyer };
    }

    describe("Listing", function () {
        it("Should list an NFT and emit Listed", async function () {
            const { nft, marketplace, seller } = await loadFixture(deployFixture);
            const price = ethers.parseEther("1");

            await expect(
                marketplace.connect(seller).list(await nft.getAddress(), 0, price)
            ).to.emit(marketplace, "Listed");

            const listing = await marketplace.listings(0);
            expect(listing.seller).to.equal(seller.address);
            expect(listing.price).to.equal(price);
            expect(listing.active).to.equal(true);
        });
    });

    describe("Buying", function () {
        it("Should transfer NFT and pay seller minus fee", async function () {
            const { nft, marketplace, seller, buyer } = await loadFixture(deployFixture);
            const price = ethers.parseEther("1");

            await marketplace.connect(seller).list(await nft.getAddress(), 0, price);

            const sellerBalBefore = await ethers.provider.getBalance(seller.address);
            await marketplace.connect(buyer).buy(0, { value: price });

            expect(await nft.ownerOf(0)).to.equal(buyer.address);

            const sellerBalAfter = await ethers.provider.getBalance(seller.address);
            // Seller should receive 0.975 ETH (1 ETH - 2.5% fee)
            expect(sellerBalAfter - sellerBalBefore).to.equal(ethers.parseEther("0.975"));
        });

        it("Should revert on underpayment", async function () {
            const { nft, marketplace, seller, buyer } = await loadFixture(deployFixture);
            const price = ethers.parseEther("1");

            await marketplace.connect(seller).list(await nft.getAddress(), 0, price);

            await expect(
                marketplace.connect(buyer).buy(0, { value: ethers.parseEther("0.5") })
            ).to.be.revertedWith("Marketplace: insufficient payment");
        });
    });

    describe("Cancel", function () {
        it("Should return NFT to seller and deactivate listing", async function () {
            const { nft, marketplace, seller } = await loadFixture(deployFixture);
            const price = ethers.parseEther("1");

            await marketplace.connect(seller).list(await nft.getAddress(), 0, price);
            await marketplace.connect(seller).cancel(0);

            expect(await nft.ownerOf(0)).to.equal(seller.address);
            const listing = await marketplace.listings(0);
            expect(listing.active).to.equal(false);
        });
    });

    describe("Update Price", function () {
        it("Should update the listing price", async function () {
            const { nft, marketplace, seller } = await loadFixture(deployFixture);

            await marketplace.connect(seller).list(await nft.getAddress(), 0, ethers.parseEther("1"));
            await marketplace.connect(seller).updatePrice(0, ethers.parseEther("2"));

            const listing = await marketplace.listings(0);
            expect(listing.price).to.equal(ethers.parseEther("2"));
        });
    });
});
