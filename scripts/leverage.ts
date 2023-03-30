import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract, ethers, Signer, BigNumber } from "ethers";
import {
    AAVE_Price_Oricle_Address
} from './address';
import {
    getLtv
  } from "./configHelper";
const hre: HardhatRuntimeEnvironment = require('hardhat');

let priceOricleABI;
let AavePriceOricle : Contract;

export const initPriceOracle = async (signer: Signer) => {
    priceOricleABI = await (await hre.artifacts.readArtifact("IAaveOracle")).abi;
    AavePriceOricle = new ethers.Contract(AAVE_Price_Oricle_Address, priceOricleABI, signer);
}

export const getAssetPriceOnAAVE = async (asset: string) => {
    let price = await AavePriceOricle.getAssetPrice(asset);
    return price;
}

export const getMaxLeverage =async (asset: string, POOL: Contract, TokenName: string) => {
    let assetConfig = (await POOL.getConfiguration(asset)).data;
    let assetLTV = getLtv(assetConfig);
    // MAX Leverage = 1 / (1 - LTV)
    let maxleverage = 10000n / (10000n - assetLTV);
    console.log("   According to the AAVE %s Asset Configuration:", TokenName);
    console.log("       The Maximum leverage abilidity = ", maxleverage.toString());
    return maxleverage;
}

export const getUserATokenBalance = async (aToken: Contract, userAddress: string) => {
    return (await aToken.balanceOf(userAddress));
}

export const calcAssetValue =async (userAddress: string, asset: string, decimal: number, aToken: Contract) => {
    let price = await getAssetPriceOnAAVE(asset);
    console.log("   Now Asset Price = $%d", ethers.utils.formatUnits(price, 8));
    let userBalance = await getUserATokenBalance(aToken, userAddress);
    console.log("   User aToken Balance = ", userBalance.toString());
    let assetValue = price.mul(userBalance).div(ethers.utils.parseUnits("1.0", decimal));
    console.log("   User asset Value = ", ethers.utils.formatUnits(assetValue, 8));
    return assetValue;
}

export const calcLeveragePosition = (userPosition: BigNumber, userleverage: number) => {
    return ethers.utils.formatUnits(userPosition.mul(userleverage), 8)
}

export const calcNeedBorrowValue = (userPosition: BigNumber, userleverage: number) => {
    return userPosition.mul(userleverage).sub(userPosition);
}

export const calcNeedBorrowAmount = (flashLoanValue: BigNumber, tokenPrice: BigNumber) => {
    return flashLoanValue.mul(ethers.utils.parseUnits("1.0", 8)).div(tokenPrice);
}

export const adoptTokenDicimals = (amount: BigNumber, srcDecimal: number, dstDecimal: number) => {
    return amount.mul(10 ** (dstDecimal - srcDecimal));
}

/**
 * slippage control
 */
export const getAmountOutleast = (amount:BigNumber, slippage: number) => {
    return amount.mul(10000 - slippage).div(10000);
}