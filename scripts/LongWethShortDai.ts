import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BigNumber, Contract, ethers, Signer } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";

const hre: HardhatRuntimeEnvironment = require('hardhat');
const poolAddressProvider: string = '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e';
const daiAddress: string = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const WETHAddress: string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

const WETHGateWai: string = '0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C';
const aDaiAddree: string = '0x018008bfb33d285247A21d44E50697654f754e63';

const aWETHAddress: string = '0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8';
const WALLET_ADDRESS="0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549"
const daiAbi = require("./abi/DAIABI.json");

const aTokenAbi = ["function balanceOf(address account) external view returns (uint256)",];
const debtTokenABI = [
  "function approveDelegation(address delegatee, uint256 amount) external",
  "function borrowAllowance(address fromUser, address toUser) external view returns (uint256)"
];
const WETHGateABI = ["function depositETH(address,address onBehalfOf,uint16 referralCode) payable external"];

async function main() {

    await impersonateAccount(WALLET_ADDRESS);
    const fakeSigner: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);
    const flashLoanContract: Contract = await hre.ethers.getContractFactory("FlashLoan");
    console.log(fakeSigner.address);
    const flashLoan = await flashLoanContract.connect(fakeSigner).deploy(poolAddressProvider, fakeSigner.address);
    await flashLoan.deployed();
    console.log(
      `flash loan deployed to ${flashLoan.address}`
    );
  
    // DEPOSIT 1 ETH IN AAVE
    const poolAddress = await flashLoan.POOL();
    const poolAbi = await (await hre.artifacts.readArtifact("IPool")).abi;
    const POOL = new ethers.Contract(poolAddress, poolAbi, fakeSigner);
    const WETHGateWay = new ethers.Contract(WETHGateWai, WETHGateABI, fakeSigner);
    const aWETH = new ethers.Contract(aWETHAddress, aTokenAbi, fakeSigner);

    const balance = await aWETH.balanceOf(fakeSigner.address);
    console.log("Wallet AToken Address is balance: ", balance);
  
    const depositAmount = ethers.utils.parseUnits("1", "ether");
    // deposit eth in aave by WETHGateWay function
    const tx1 =  await WETHGateWay.connect(fakeSigner).depositETH(fakeSigner.address,fakeSigner.address, 0, {value: depositAmount});
    
    // check if we actually have one aWETH
    const aTokenBalance = await aWETH.balanceOf(fakeSigner.address);
    console.log("aTokenBalance ", aTokenBalance);

    // check user account data
    let accountData = await POOL.getUserAccountData(fakeSigner.address);
    console.log(accountData);

    // FLASH LOAN $2000 DAI and short DAI
  
    // apporve flashloan to increase debt on fakesigner
    const flashloanAmount = ethers.utils.parseUnits("700", 18);
    const debtTokenAddress = (await POOL.getReserveData(daiAddress)).variableDebtTokenAddress;
    const debtToken = new ethers.Contract(debtTokenAddress, debtTokenABI, fakeSigner);
    // it need to be approved by user, so contract can credit the debt to user address
    const approveDebt = await debtToken.connect(fakeSigner).approveDelegation(flashLoan.address, flashloanAmount);
    // const borrowAllowance = await debtToken.connect(fakeSigner).borrowAllowance(fakeSigner.address, flashLoan.address);
    // console.log("borrowAllowance is ", borrowAllowance);
    const assets : string[] = [daiAddress,];
    const amounts : ethers.BigNumber[] = [flashloanAmount, ]; 
    const interestRateModes : ethers.BigNumber[] = [BigNumber.from("2"), ];
    // this params is used to meet the condition in executeOperation
    // params: 1. address is long asset address 2. Slippage 500 ~ 0.05% 3000 ~ 0.3% 10000 ~ 1%
    const slip = 3000;
    const amountOutLeast = ethers.utils.parseUnits("700", "ether");
    // const params = ethers.utils.solidityPack(["address", "uint16", "uint256"], [WETHAddress, slip, amountOutLeast]);
    const params = ethers.utils.formatBytes32String("hello");

    const tx2 = await flashLoan.connect(fakeSigner).callAAVEFlashLoan(
      flashLoan.address,
      assets,
      amounts,
      interestRateModes,
      params,
      0,
    );
    accountData = await POOL.getUserAccountData(fakeSigner.address);
    console.log(accountData);
  
    // end
  
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  