import { run } from "hardhat";
import hre from "hardhat";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// ============================================
// Must match the params used in deploy.ts
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
    ESCROW: {
        feeBps: 100,
    },
};

async function main() {
    const network = hre.network.name;
    const filePath = path.resolve(__dirname, `../deployments/${network}.json`);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ No deployment file found at ${filePath}`);
        console.log(`   Run "npm run deploy:${network}" first.`);
        return;
    }

    const addresses: Record<string, string> = JSON.parse(
        fs.readFileSync(filePath, "utf-8")
    );

    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log(`Network:  ${network}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log("=".repeat(60));

    // Build verification list from deployed addresses
    const verifyList: Record<string, { address: string; constructorArguments: any[] }> = {};

    if (addresses.MyERC20) {
        verifyList.MyERC20 = {
            address: addresses.MyERC20,
            constructorArguments: [
                P.ERC20.name,
                P.ERC20.symbol,
                P.ERC20.initialSupply,
                P.ERC20.maxSupply,
                deployer.address,
            ],
        };
    }

    if (addresses.MyERC721) {
        verifyList.MyERC721 = {
            address: addresses.MyERC721,
            constructorArguments: [
                P.ERC721.name,
                P.ERC721.symbol,
                P.ERC721.maxSupply,
                P.ERC721.mintPrice,
                P.ERC721.baseURI,
                deployer.address,
            ],
        };
    }

    if (addresses.MyERC1155) {
        verifyList.MyERC1155 = {
            address: addresses.MyERC1155,
            constructorArguments: [
                P.ERC1155.name,
                P.ERC1155.symbol,
                P.ERC1155.uri,
                deployer.address,
            ],
        };
    }

    if (addresses.Marketplace) {
        verifyList.Marketplace = {
            address: addresses.Marketplace,
            constructorArguments: [P.MARKETPLACE.feeBps, deployer.address],
        };
    }

    if (addresses.Staking) {
        const stakeToken = addresses.MyERC20 || "0x_STAKE_TOKEN";
        const rewardToken = addresses.MyERC20 || "0x_STAKE_TOKEN";
        verifyList.Staking = {
            address: addresses.Staking,
            constructorArguments: [
                stakeToken,
                rewardToken,
                ethers.parseEther("1"),
                deployer.address,
            ],
        };
    }

    if (addresses.Governance) {
        const tokenAddr = addresses.MyERC20 || "0x_GOV_TOKEN";
        verifyList.Governance = {
            address: addresses.Governance,
            constructorArguments: [
                tokenAddr,
                259200,
                4,
                ethers.parseEther("100"),
                deployer.address,
            ],
        };
    }

    if (addresses.Escrow) {
        verifyList.Escrow = {
            address: addresses.Escrow,
            constructorArguments: [deployer.address, P.ESCROW.feeBps, deployer.address],
        };
    }

    if (addresses.Vault) {
        verifyList.Vault = {
            address: addresses.Vault,
            constructorArguments: [deployer.address],
        };
    }

    // Verify each contract
    for (const [name, info] of Object.entries(verifyList)) {
        console.log(`\nVerifying ${name} at ${info.address}...`);
        try {
            await run("verify:verify", {
                address: info.address,
                constructorArguments: info.constructorArguments,
            });
            console.log(`✅ ${name} verified`);
        } catch (error: any) {
            if (error.message?.includes("Already Verified")) {
                console.log(`ℹ️  ${name} already verified`);
            } else {
                console.log(`❌ ${name}: ${error.message}`);
            }
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("Verification complete.");
}

main().catch(console.error);
