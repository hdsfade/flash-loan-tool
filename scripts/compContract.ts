import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract, Signer, ethers } from 'ethers';
import { 
    bulker_ADDRESS,
    cUSDC_comet_ADDRESS,
} from './address';

export var BULKER: Contract;
export var COMET: Contract;
import {hre} from "./constant";

export const initCompContract = async (signer: Signer) => {
    let bulkerABI = await (await hre.artifacts.readArtifact("IBulker")).abi;
    BULKER = new ethers.Contract(bulker_ADDRESS, bulkerABI, signer);
    let cometABI = await (await hre.artifacts.readArtifact("IComet")).abi;
    COMET = new ethers.Contract(cUSDC_comet_ADDRESS, cometABI, signer);
}

export const supplyWETH =async (user: SignerWithAddress, amount: BigNumber) => {
    const abiCoder = new ethers.utils.AbiCoder;
    // 2 mean supply eth 
    const action = [abiCoder.encode(["uint"], [2]), ];
    // console.log(action);
    const data: string[] = [abiCoder.encode(["address", "address", "uint"], [cUSDC_comet_ADDRESS, user.address, amount]),];
    // console.log(data);
    const tx = await BULKER.connect(user).invoke(action, data, {value: amount});
    let tx_receipt = await tx.wait();
    // console.log(tx_receipt);
}

export const getUserCollateralBalance = async (userAddress: string, assetAddress: string) => {
    return (await COMET.collateralBalanceOf(userAddress, assetAddress));
}

export const 