import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Escrow", function () {
    async function deployFixture() {
        const [owner, buyer, seller, arbiter] = await ethers.getSigners();
        const PRICE = ethers.parseEther("1");
        const now = await time.latest();
        const FUTURE = now + 86400; // +1 day

        const Escrow = await ethers.getContractFactory("Escrow");
        const escrow = await Escrow.deploy(100, owner.address);

        return { escrow, owner, buyer, seller, arbiter, PRICE, FUTURE };
    }

    describe("Create", function () {
        it("Should create an ETH escrow and emit DealCreated", async function () {
            const { escrow, buyer, seller, arbiter, PRICE, FUTURE } = await loadFixture(deployFixture);

            await expect(
                escrow.connect(buyer).createDealETH(seller.address, arbiter.address, FUTURE, { value: PRICE })
            ).to.emit(escrow, "DealCreated");

            const deal = await escrow.deals(0);
            expect(deal.buyer).to.equal(buyer.address);
            expect(deal.seller).to.equal(seller.address);
            expect(deal.amount).to.equal(PRICE);
        });
    });

    describe("Release", function () {
        it("Should pay seller minus fee on release", async function () {
            const { escrow, buyer, seller, arbiter, PRICE, FUTURE } = await loadFixture(deployFixture);

            await escrow.connect(buyer).createDealETH(seller.address, arbiter.address, FUTURE, { value: PRICE });

            const sellerBalBefore = await ethers.provider.getBalance(seller.address);
            await escrow.connect(buyer).release(0);
            const sellerBalAfter = await ethers.provider.getBalance(seller.address);

            // 100 bps = 1% fee, seller gets 0.99 ETH
            expect(sellerBalAfter - sellerBalBefore).to.equal(ethers.parseEther("0.99"));
        });
    });

    describe("Cancel", function () {
        it("Should refund buyer on cancel", async function () {
            const { escrow, buyer, seller, arbiter, PRICE, FUTURE } = await loadFixture(deployFixture);

            await escrow.connect(buyer).createDealETH(seller.address, arbiter.address, FUTURE, { value: PRICE });

            const balBefore = await ethers.provider.getBalance(buyer.address);
            const tx = await escrow.connect(buyer).cancelDeal(0);
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const balAfter = await ethers.provider.getBalance(buyer.address);

            // Buyer gets refund minus fee and gas
            expect(balAfter + gasCost - balBefore).to.be.gte(ethers.parseEther("0.99"));
        });
    });

    describe("Dispute + Resolve", function () {
        it("Should allow arbiter to resolve in seller favor", async function () {
            const { escrow, buyer, seller, arbiter, PRICE, FUTURE } = await loadFixture(deployFixture);

            await escrow.connect(buyer).createDealETH(seller.address, arbiter.address, FUTURE, { value: PRICE });
            await escrow.connect(buyer).dispute(0);

            const sellerBalBefore = await ethers.provider.getBalance(seller.address);
            await escrow.connect(arbiter).resolve(0, true);
            const sellerBalAfter = await ethers.provider.getBalance(seller.address);

            expect(sellerBalAfter - sellerBalBefore).to.equal(ethers.parseEther("0.99"));
        });

        it("Should allow arbiter to resolve in buyer favor", async function () {
            const { escrow, buyer, seller, arbiter, PRICE, FUTURE } = await loadFixture(deployFixture);

            await escrow.connect(buyer).createDealETH(seller.address, arbiter.address, FUTURE, { value: PRICE });
            await escrow.connect(seller).dispute(0);

            const buyerBalBefore = await ethers.provider.getBalance(buyer.address);
            await escrow.connect(arbiter).resolve(0, false);
            const buyerBalAfter = await ethers.provider.getBalance(buyer.address);

            // Buyer gets refund minus fee
            expect(buyerBalAfter - buyerBalBefore).to.be.gte(ethers.parseEther("0.99"));
        });
    });

    describe("Expired", function () {
        it("Should allow buyer to claim expired escrow", async function () {
            const { escrow, buyer, seller, arbiter } = await loadFixture(deployFixture);
            const PRICE = ethers.parseEther("1");
            const now = await time.latest();
            const deadline = now + 100;

            await escrow.connect(buyer).createDealETH(seller.address, arbiter.address, deadline, { value: PRICE });

            await time.increase(200);

            await expect(
                escrow.connect(buyer).claimExpired(0)
            ).to.emit(escrow, "DealCancelled");
        });
    });
});
