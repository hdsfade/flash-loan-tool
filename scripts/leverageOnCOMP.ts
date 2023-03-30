import { BigNumber, Contract, ethers } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { 
  poolAddressProvider,
  AAVE_POOL_ADDRESS,
  V3_SWAP_ROUTER_ADDRESS,
  DaiAddress,
  WETHAddress,
  WALLET_ADDRESS,
  bulker_ADDRESS,
  cUSDC_comet_ADDRESS,
 } from './address';
import {hre} from "./constant";

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
  
    // DEPOSIT 1 ETH IN COMP
    // use bulker to supply eth
    const bulkerABI = await (await hre.artifacts.readArtifact("IBulker")).abi;
    const bulker = new ethers.Contract(bulker_ADDRESS, bulkerABI, fakeSigner);
    const cometABI = await (await hre.artifacts.readArtifact("IComet")).abi;
    const comet = new ethers.Contract(cUSDC_comet_ADDRESS, cometABI, fakeSigner);

    // deposit wETH in cETH
    const ethAmount = ethers.utils.parseUnits("1", "ether");
    const abiCoder = new ethers.utils.AbiCoder;
    // 2 mean supply eth 
    const action = [abiCoder.encode(["uint"], [2]), ];
    console.log(action);
    const data: string[] = [abiCoder.encode(["address", "address", "uint"], [cUSDC_comet_ADDRESS, fakeSigner.address, ethAmount]),];
    console.log(data);

    // check cETH balanceOf
    const tx = await bulker.connect(fakeSigner).invoke(action, data, {value: ethAmount});
    let tx_receipt = await tx.wait();
    // console.log(tx_receipt);
    
    let userCollateralBalance = await comet.collateralBalanceOf(fakeSigner.address, WETHAddress); 
    console.log("User collateral balance is: ", userCollateralBalance);

    // FLASH LOAN $2000 WETH which means long WETH
    // the contract should borrow 1 WETH and then deposit it in COMP
    // the borrow USDC from COMP and swap USDC to Dai and repay debt in flash loan 
    const flashloanAmount = ethers.utils.parseUnits("1", 18);

    const assets : string[] = [WETHAddress,];
    const amounts : ethers.BigNumber[] = [flashloanAmount, ]; 
    const interestRateModes : ethers.BigNumber[] = [BigNumber.from("0"), ];
    // this params is used to meet the condition in executeOperation
    // params: 1. address is long asset address 2. Slippage 500 ~ 0.05% 3000 ~ 0.3% 10000 ~ 1%
    const poolFee = 3000;
    const amountOutLeast = ethers.utils.parseUnits("1", "ether");
    // mode: 1 = leverage AAVE position; 2 = leverage Compound position
    const mode = 2;
    const params = ethers.utils.solidityPack(["uint8","address", "uint16", "uint256"], [mode, WETHAddress, poolFee, amountOutLeast]);
    // const params = ethers.utils.formatBytes32String("hello");
    const tx2 = await comet.connect(fakeSigner).allow(flashLoan.address, true);
    tx_receipt = await tx2.wait();
    let allowance = await comet.connect(fakeSigner).allowance(fakeSigner.address, flashLoan.address);
    console.log("allowance is: ", allowance);
    // AAVE pool
    const aavePoolABI = await (await hre.artifacts.readArtifact("IPool")).abi;
    const pool = new ethers.Contract(AAVE_POOL_ADDRESS, aavePoolABI, fakeSigner);

    const tx3 = pool.connect(fakeSigner).flashLoan(
      flashLoan.address,
      assets,
      amounts,
      interestRateModes,
      fakeSigner.address,
      params,
      0,
      {gasLimit: 20000000}
    );

    let borrowBalanceOf = await comet.borrowBalanceOf(fakeSigner.address);
    console.log("After leverage, user borrowBalanceOf is: ", borrowBalanceOf);
    userCollateralBalance = await comet.collateralBalanceOf(fakeSigner.address, WETHAddress); 
    console.log("After leverage, user collateral balance is: ", userCollateralBalance);

    // const tx2 = await flashLoan.connect(fakeSigner).callAAVEFlashLoan(
    //   flashLoan.address,
    //   assets,
    //   amounts,
    //   interestRateModes,
    //   params,
    //   0,
    // );
  
    // end
  
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  