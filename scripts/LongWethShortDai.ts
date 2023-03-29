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
  WALLET_ADDRESS,
  AAVE_Price_Oricle_Address
 } from './address';
import {
  aTokenAbi,
  debtTokenABI,
  WETHGateABI
} from "./ABI";
import {
  getLtv
} from "./configHelper";
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
    console.log("Before any tx, the Wallet AToken Address is balance: ", balance.toString());
    
    console.log("");
    console.log("First, user have to deposit some token into the AAVE Pool");

    const depositAmount = ethers.utils.parseUnits("2", "ether");
    // deposit eth in aave by WETHGateWay function
    console.log("Now, User deposit %d %s token in to AAVE",depositAmount, "ETH");
    const tx1 =  await WETHGateWay.connect(fakeSigner).depositETH(fakeSigner.address,fakeSigner.address, 0, {value: depositAmount});
    console.log("After Deposit...");
    // check if we actually have one aWETH
    const aTokenBalance = await aWETH.balanceOf(fakeSigner.address);
    console.log("   user a%sBalance is ", "ETH", aTokenBalance.toString());

    // check user account data
    let accountData = await POOL.getUserAccountData(fakeSigner.address);
    // console.log(accountData);
    
    // calculate the maximum amount of Long asset that user can borrow;
    const priceOricleABI = await (await hre.artifacts.readArtifact("IAaveOracle")).abi;
    const priveOricle = new ethers.Contract(AAVE_Price_Oricle_Address, priceOricleABI, fakeSigner);
    
    let checkAsset = [WETHAddress, DaiAddress];
    let AavePrices : ethers.BigNumber[] = await priveOricle.getAssetsPrices(checkAsset);
    // console.log(AavePrices);
    // Price 小数位为8
    console.log("");
    console.log("Now calculate user max leverage...");
    let WETHPrice = AavePrices[0];
    let WETHDecimal = 18;
    console.log("   Now WETH Price = $%d", ethers.utils.formatUnits(WETHPrice, 8));
    let userBalance: BigNumber = await aWETH.balanceOf(fakeSigner.address);
    console.log("   User aWETH Balance = ", userBalance.toString());
    let WETHValue = WETHPrice.mul(userBalance).div(ethers.utils.parseUnits("1.0", WETHDecimal));
    console.log("   User Total WETH Value = ", ethers.utils.formatUnits(WETHValue, 8));
    let WETHconfiguration = (await POOL.getConfiguration(WETHAddress)).data;
    let WETH_LTV = getLtv(WETHconfiguration);
    // console.log(WETH_LTV);
    // MAX Leverage = 1 / (1 - LTV)
    let maxleverage = 10000n / (10000n - WETH_LTV);
    console.log("   According to the AAVE WETH Asset Configuration:")
    console.log("       The Maximum leverage abilidity = ", maxleverage.toString());
    // WETH Value * MAX Leverage = MAX Borrow Cap 
    let maxBorrowCap = WETHValue.mul(maxleverage);
    console.log("       The MAX amount of position (in USD)  = $%d", ethers.utils.formatUnits(maxBorrowCap, 8).toString());
    
    // FLASH LOAN $2000 DAI and short DAI
    let DAIPrice = AavePrices[1];
    let DAISymbol = "DAI"
    console.log("   User choose to short %s Asset.", DAISymbol);
    console.log("   %s Price = $%d", DAISymbol, DAIPrice);
    let DAIdecimal = 18;
    // user leverage is the leverage be choosed
    let userleverage = 4n;
    console.log("   Current leverage = ", userleverage);
    console.log("       user want to leverage up their position to $%d", ethers.utils.formatUnits(WETHValue.mul(userleverage), 8).toString());
    let needBorrowAmountUSD = WETHValue.mul(userleverage).sub(WETHValue);
    console.log("       so user need to flash loan (in USDC) = $%d", ethers.utils.formatUnits(needBorrowAmountUSD, 8).toString());
    let needDAIAmount = needBorrowAmountUSD.mul(ethers.utils.parseUnits("1.0", 8)).div(DAIPrice);
    console.log("       so user need to borrow DAI Amount = ", ethers.utils.formatUnits(needDAIAmount, 8).toString());
    let flashloanAmount = needDAIAmount.mul(10 ** (DAIdecimal - 8));
    // let DAIValue = flashloanAmount.mul(DAIPrice).div(ethers.utils.parseUnits("1.0", 18));
    // console.log("DAI Value = ", ethers.utils.formatUnits(DAIValue, 8));
    
    console.log("");
    // 100bps = 1%
    let slippage = 100;
    console.log("User's slippage = %d", Number(slippage / 10000))
    let amountOutLeast = flashloanAmount.mul(10000 - slippage).div(10000);
    console.log("   So after swap, the output should be at least = ", amountOutLeast.toString());

    console.log("");
    // apporve flashloan to increase debt on fakesigner
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
    const mode = 1;
    const params = ethers.utils.solidityPack(["uint8","address", "uint16", "uint256"], [mode, WETHAddress, poolFee, amountOutLeast]);
    // const params = ethers.utils.formatBytes32String("hello");

    // const tx2 = await flashLoan.connect(fakeSigner).callAAVEFlashLoan(
    //   flashLoan.address,
    //   assets,
    //   amounts,
    //   interestRateModes,
    //   params,
    //   0,
    // );
    // accountData = await POOL.getUserAccountData(fakeSigner.address);
    // console.log(accountData);
  
    // end
  
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  