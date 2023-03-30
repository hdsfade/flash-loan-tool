import { ethers, BigNumber } from "ethers";

export const getMaxLeverage =async (assetLTV: bigint) => {
    // MAX Leverage = 1 / (1 - LTV)
    let maxleverage = 10000n / (10000n - assetLTV);
    return maxleverage;
}

export const calcUserAssetValue =async (userBalance: BigNumber, price: BigNumber, decimal: number) => {
    console.log("   User aToken Balance = ", userBalance.toString());
    console.log("   Now Asset Price = $%d", ethers.utils.formatUnits(price, 8));
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