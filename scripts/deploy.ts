import { ethers } from "hardhat";
import hre from "hardhat";
import fs from "fs";

// ============================================
// TOGGLE DEPLOYMENT — flip true/false per hackathon
// ============================================
const DEPLOY = {
    ERC20: true,
    ERC721: true,
    ERC1155: false,
    MARKETPLACE: true,
    STAKING: false,
    GOVERNANCE: false,
    ESCROW: false,
    VAULT: false,
};

// ============================================
// CONSTRUCTOR PARAMETERS
// ============================================
const P = {
    ERC20: {
        name: "MyToken",
        symbol: "MTK",
        initialSupply: ethers.parseEther("1000000"),
        maxSupply: ethers.parseEther("10000000"),
    },
    ERC721: {
        name: "MyNFT",
        symbol: "MNFT",
        maxSupply: 10000,
        mintPrice: ethers.parseEther("0.01"),
        baseURI: "ipfs://QmYourBaseURI/",
    },
    ERC1155: {
        name: "MyMultiToken",
        symbol: "MMT",
        uri: "ipfs://QmYourURI/{id}.json",
    },
    MARKETPLACE: {
        feeBps: 250,
    },
    STAKING: {
        rewardRate: ethers.parseEther("1"),
    },
    GOVERNANCE: {
        votingPeriod: 259200, // 3 days
        quorumPct: 4,
        proposalThreshold: ethers.parseEther("100"),
    },
    ESCROW: {
        feeBps: 100,
    },
};

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    const network = hre.network.name;

    console.log("=".repeat(60));
    console.log(`Deployer:  ${deployer.address}`);
    console.log(`Balance:   ${ethers.formatEther(balance)} ETH`);
    console.log(`Network:   ${network}`);
    console.log("=".repeat(60));

    const out: Record<string, string> = {};

    // ---------- ERC20 ----------
    if (DEPLOY.ERC20) {
        const factory = await ethers.getContractFactory("MyERC20");
        const contract = await factory.deploy(
            P.ERC20.name,
            P.ERC20.symbol,
            P.ERC20.initialSupply,
            P.ERC20.maxSupply,
            deployer.address
        );
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        out.MyERC20 = addr;
        console.log(`✅ MyERC20 deployed to: ${addr}`);
    }

    // ---------- ERC721 ----------
    if (DEPLOY.ERC721) {
        const factory = await ethers.getContractFactory("MyERC721");
        const contract = await factory.deploy(
            P.ERC721.name,
            P.ERC721.symbol,
            P.ERC721.maxSupply,
            P.ERC721.mintPrice,
            P.ERC721.baseURI,
            deployer.address
        );
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        out.MyERC721 = addr;
        console.log(`✅ MyERC721 deployed to: ${addr}`);
    }

    // ---------- ERC1155 ----------
    if (DEPLOY.ERC1155) {
        const factory = await ethers.getContractFactory("MyERC1155");
        const contract = await factory.deploy(
            P.ERC1155.name,
            P.ERC1155.symbol,
            P.ERC1155.uri,
            deployer.address
        );
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        out.MyERC1155 = addr;
        console.log(`✅ MyERC1155 deployed to: ${addr}`);
    }

    // ---------- Marketplace ----------
    if (DEPLOY.MARKETPLACE) {
        const factory = await ethers.getContractFactory("Marketplace");
        const contract = await factory.deploy(P.MARKETPLACE.feeBps, deployer.address);
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        out.Marketplace = addr;
        console.log(`✅ Marketplace deployed to: ${addr}`);
    }

    // ---------- Staking ----------
    if (DEPLOY.STAKING) {
        const stakeToken = out.MyERC20 || "0x_STAKE_TOKEN";
        const rewardToken = out.MyERC20 || "0x_STAKE_TOKEN";
        const factory = await ethers.getContractFactory("Staking");
        const contract = await factory.deploy(
            stakeToken,
            rewardToken,
            P.STAKING.rewardRate,
            deployer.address
        );
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        out.Staking = addr;
        console.log(`✅ Staking deployed to: ${addr}`);
    }

    // ---------- Governance ----------
    if (DEPLOY.GOVERNANCE) {
        const tokenAddr = out.MyERC20 || "0x_GOV_TOKEN";
        const factory = await ethers.getContractFactory("Governance");
        const contract = await factory.deploy(
            tokenAddr,
            P.GOVERNANCE.votingPeriod,
            P.GOVERNANCE.quorumPct,
            P.GOVERNANCE.proposalThreshold,
            deployer.address
        );
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        out.Governance = addr;
        console.log(`✅ Governance deployed to: ${addr}`);
    }

    // ---------- Escrow ----------
    if (DEPLOY.ESCROW) {
        const factory = await ethers.getContractFactory("Escrow");
        const contract = await factory.deploy(
            deployer.address, // arbiter = deployer
            P.ESCROW.feeBps,
            deployer.address
        );
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        out.Escrow = addr;
        console.log(`✅ Escrow deployed to: ${addr}`);
    }

    // ---------- Vault ----------
    if (DEPLOY.VAULT) {
        const factory = await ethers.getContractFactory("Vault");
        const contract = await factory.deploy(deployer.address);
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        out.Vault = addr;
        console.log(`✅ Vault deployed to: ${addr}`);
    }

    // ---------- Save deployment file ----------
    fs.mkdirSync("./deployments", { recursive: true });
    const filePath = `./deployments/${network}.json`;
    fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
    console.log("=".repeat(60));
    console.log(`📄 Deployment addresses saved to ${filePath}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
