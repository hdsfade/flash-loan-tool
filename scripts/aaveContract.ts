import { Contract, Signer, ethers, BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
    AAVE_POOL_ADDRESS,
    WETH_GATEWAY_ADDRESS,
    aWETHAddress
} from "./address";

import {
    aTokenAbi,
    debtTokenABI,
    WETHGateABI
  } from "./ABI";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
export var AAVE_POOL: Contract;
export var WETH_GATEWAY: Contract;
// export var ;
export const hre: HardhatRuntimeEnvironment = require('hardhat');

export const initAAVEContract = async (signer: Signer) => {
    let poolAbi = await (await hre.artifacts.readArtifact("IPool")).abi;
    AAVE_POOL = new ethers.Contract(AAVE_POOL_ADDRESS, poolAbi, signer);
    WETH_GATEWAY = new ethers.Contract(WETH_GATEWAY_ADDRESS, WETHGateABI, signer);
}

export const aTokenContract = (aTokenAddress: string, signer: SignerWithAddress) => {
    return (new ethers.Contract(aWETHAddress, aTokenAbi, signer));
}

export const getAssetDebtTokenAddress = async (asset: string) => {
    return (await AAVE_POOL.getReserveData(asset)).variableDebtTokenAddress;
}

export const debtTokenContract = (debtTokenAddress: string, signer: Signer) => {
    return (new ethers.Contract(debtTokenAddress, debtTokenABI, signer));
}

// Before helping user to flash loan, user need to approve us to borrow on behalf of their account
export const apporve2Borrow = async (debtToken: Contract, user: Signer, flashLoanAddress: string, amount: BigNumber) => {
    const approveDebt = await debtToken.connect(user).approveDelegation(flashLoanAddress, amount);
    return;
}

export const checkBorrowAllowance = async (debtToken: Contract, userAddress: string, flashLoanAddress: string) => {
    const borrowAllowance = await debtToken.borrowAllowance(userAddress, flashLoanAddress);
    console.log("borrowAllowance is ", borrowAllowance);
}

