import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BigNumber, Contract, ethers, Signer } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { 
  poolAddressProvider, 
  V3_SWAP_ROUTER_ADDRESS,
  DaiAddress,
  WETHAddress,
  WETHGateWai,
  aWETHAddress,
  WALLET_ADDRESS
 } from './address';
import {
  aTokenAbi,
  debtTokenABI,
  WETHGateABI
} from "./ABI";

const hre: HardhatRuntimeEnvironment = require('hardhat');

async function main() {

    await impersonateAccount(WALLET_ADDRESS);
    const fakeSigner: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);
    const flashLoanContract: Contract = await hre.ethers.getContractFactory("FlashLoan");
    console.log(fakeSigner.address);
    const flashLoan = await flashLoanContract.connect(fakeSigner).deploy(poolAddressProvider, V3_SWAP_ROUTER_ADDRESS, fakeSigner.address);
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
    const flashloanAmount = ethers.utils.parseUnits("1000", 18);
    const debtTokenAddress = (await POOL.getReserveData(DaiAddress)).variableDebtTokenAddress;
    const debtToken = new ethers.Contract(debtTokenAddress, debtTokenABI, fakeSigner);
    // it need to be approved by user, so contract can credit the debt to user address
    const approveDebt = await debtToken.connect(fakeSigner).approveDelegation(flashLoan.address, flashloanAmount);
    // const borrowAllowance = await debtToken.connect(fakeSigner).borrowAllowance(fakeSigner.address, flashLoan.address);
    // console.log("borrowAllowance is ", borrowAllowance);
    const assets : string[] = [DaiAddress,];
    const amounts : ethers.BigNumber[] = [flashloanAmount, ]; 
    const interestRateModes : ethers.BigNumber[] = [BigNumber.from("2"), ];
    // this params is used to meet the condition in executeOperation
    // params: 1. address is long asset address 2. Slippage 500 ~ 0.05% 3000 ~ 0.3% 10000 ~ 1%
    const poolFee = 3000;
    const amountOutLeast = ethers.utils.parseUnits("1000", "ether");
    const mode = 1;
    const params = ethers.utils.solidityPack(["uint8","address", "uint16", "uint256"], [mode, WETHAddress, poolFee, amountOutLeast]);
    // const params = ethers.utils.formatBytes32String("hello");

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
  