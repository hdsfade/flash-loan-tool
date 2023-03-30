import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BigNumber, ethers } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { DaiAddress, WETHAddress, aWETHAddress, WALLET_ADDRESS} from './address';
import { 
  calcUserAssetValue,
  calcLeveragePosition,
  calcNeedBorrowValue,
  calcNeedBorrowAmount,
  adoptTokenDicimals,
  getAmountOutleast
} from './helpers/leverage';
import {
    initAavePriceOracle,
    getAssetPriceOnAAVE,
    getUserATokenBalance,
    initAAVEContract, 
    AAVE_POOL, WETH_GATEWAY, 
    aTokenContract, 
    debtTokenContract, 
    getAssetDebtTokenAddress, 
    apporve2Borrow, 
    checkBorrowAllowance,
    getMaxLeverageOnAAVE
} from "./helpers/aaveHelper";
import {deployFlashLoan} from "./helpers/deployHelper";
import {hre} from "./constant";

async function main() {

    await impersonateAccount(WALLET_ADDRESS);
    const fakeSigner: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);
    const flashLoan = await deployFlashLoan(fakeSigner);
    console.log("Now user address: ", fakeSigner.address);
  
    await initAAVEContract(fakeSigner);
    // DEPOSIT 1 ETH IN AAVE
    const aWETH = aTokenContract(aWETHAddress, fakeSigner);

    const balance = await aWETH.balanceOf(fakeSigner.address);
    console.log("Before any tx, the Wallet AToken Address is balance: ", balance.toString());
    
    console.log("");
    console.log("First, user have to deposit some token into the AAVE Pool");

    const depositAmount = ethers.utils.parseUnits("2", "ether");
    // deposit eth in aave by WETHGateWay function
    console.log("Now, User deposit %d %s token in to AAVE",depositAmount, "ETH");
    const tx1 =  await WETH_GATEWAY.connect(fakeSigner).depositETH(fakeSigner.address,fakeSigner.address, 0, {value: depositAmount});
    console.log("After Deposit...");
    // check if we actually have one aWETH
    const aTokenBalance = await getUserATokenBalance(aWETH, fakeSigner.address);
    console.log("   user a%sBalance is ", "ETH", aTokenBalance.toString());

    // check user account data
    let accountData = await AAVE_POOL.getUserAccountData(fakeSigner.address);
    // console.log(accountData);
    
    // console.log(AavePrices);
    // Price 小数位为8
    await initAavePriceOracle(fakeSigner);
    console.log("");
    console.log("Now calculate user max leverage...");
    console.log("   User deposit Asset is WETH");
    let WETHPrice = await getAssetPriceOnAAVE(WETHAddress);
    let userBalance = await getUserATokenBalance(aWETH, fakeSigner.address);
    const WETHValue = await calcUserAssetValue(userBalance, WETHPrice, 18);

    let maxleverage = await getMaxLeverageOnAAVE(WETHAddress, AAVE_POOL, "WETH");
    // WETH Value * MAX Leverage = MAX Borrow Cap 
    let maxBorrowCap = WETHValue.mul(maxleverage);
    console.log("       The MAX amount of position (in USD)  = $%d", ethers.utils.formatUnits(maxBorrowCap, 8).toString());
    
    // FLASH LOAN $2000 DAI and short DAI
    let DAIPrice = await getAssetPriceOnAAVE(DaiAddress);
    let DAISymbol = "DAI"
    console.log("   User choose to short %s Asset.", DAISymbol);
    console.log("   %s Price = $%d", DAISymbol, DAIPrice);
    let DAIdecimal = 18;
    // user leverage is the leverage be choosed
    let userleverage = 4;
    console.log("   Current leverage = ", userleverage);
    let newPosition = calcLeveragePosition(WETHValue, userleverage);
    console.log("       user want to leverage up their position to $%d", newPosition.toString());
    let needBorrowAmountUSD = calcNeedBorrowValue(WETHValue, userleverage);
    console.log("       so user need to flash loan (in USDC) = $%d", ethers.utils.formatUnits(needBorrowAmountUSD, 8).toString());
    let needBorrowAmount = calcNeedBorrowAmount(needBorrowAmountUSD, DAIPrice);
    console.log("       so user need to borrow DAI Amount = ", ethers.utils.formatUnits(needBorrowAmount, 8).toString());
    let flashloanAmount = adoptTokenDicimals(needBorrowAmount, 8, DAIdecimal);

    console.log("");
    // 20bps = 0.2%, when i test, i found the uniswap slip is about 0.1%. WETH-DAI have a lot liquidity, so the slip is small. 
    // But we need to test whether other token-pair swap can have the same slip level.
    let slippage = 20;
    let slipPercent: number = slippage / 10000;
    console.log("User's slippage = %d", slipPercent);
    let needSwapETH = calcNeedBorrowValue(userBalance, userleverage);
    console.log("   After swap, we need %s ETH to deposit into the Platform", needSwapETH.toString());
    let amountOutLeast = getAmountOutleast(needSwapETH, slippage);
    console.log("   So after swap, the output should be at least = ", amountOutLeast.toString());

    console.log("");
    // apporve flashloan to increase debt on fakesigner
    const debtTokenAddress = await getAssetDebtTokenAddress(DaiAddress);
    const debtToken = debtTokenContract(debtTokenAddress, fakeSigner);
    // it need to be approved by user, so contract can credit the debt to user address
    await apporve2Borrow(debtToken, fakeSigner, flashLoan.address, flashloanAmount); 
    await checkBorrowAllowance(debtToken, fakeSigner.address, flashLoan.address);
    
    const assets : string[] = [DaiAddress,];
    const amounts : ethers.BigNumber[] = [flashloanAmount, ]; 
    const interestRateModes : ethers.BigNumber[] = [BigNumber.from("2"), ];
    // this params is used to meet the condition in executeOperation
    // params: 1. address is long asset address 2. Slippage 500 ~ 0.05% 3000 ~ 0.3% 10000 ~ 1%
    const poolFee = 3000;
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
    accountData = await AAVE_POOL.getUserAccountData(fakeSigner.address);
    console.log(accountData);
  
    // end
  
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  