import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BigNumber, Contract, ethers, Signer } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";

const hre: HardhatRuntimeEnvironment = require('hardhat');
const daiAbi = require("./abi/DAIABI.json");
const poolAddressProvider: string = '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e';
const daiAddress: string = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const aDaiAddree: string = '0x018008bfb33d285247A21d44E50697654f754e63';
const WALLET_ADDRESS="0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549"

const aTokenAbi = ["function balanceOf(address account) external view returns (uint256)",];
const debtTokenABI = ["function approveDelegation(address delegatee, uint256 amount) external"]

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

  // DEPOSIT 1000 DAI IN AAVE
  const DAI = new ethers.Contract(daiAddress, daiAbi, fakeSigner);
  const poolAddress = await flashLoan.POOL();
  const poolAbi = await (await hre.artifacts.readArtifact("IPool")).abi;
  const POOL = new ethers.Contract(poolAddress, poolAbi, fakeSigner);
  const aDai = new ethers.Contract(aDaiAddree, aTokenAbi, fakeSigner);

  const balance = await DAI.balanceOf(fakeSigner.address);
  console.log("Wallet Address is balance: ", balance);

  const depositAmount = ethers.utils.parseUnits("500", 18);
  const approveAmount = depositAmount.mul(3); 
  const approve = await DAI.connect(fakeSigner).approve(poolAddress, approveAmount);
  console.log("DAI allowance for pool address", await DAI.allowance(fakeSigner.address, poolAddress));

  const tx1 = await POOL.connect(fakeSigner).supply(daiAddress, depositAmount, fakeSigner.address, 0);
  let accountData = await POOL.getUserAccountData(fakeSigner.address);
  console.log(accountData);
  const aTokenBalance = await aDai.balanceOf(fakeSigner.address);
  // console.log("aTokenBalance ", aTokenBalance);
  // FLASH LOAN 3000 DAI and deposit in Aave

  // apporve flashloan to increase debt on fakesigner
  const flashloanAmount = ethers.utils.parseUnits("700", 18);
  const debtTokenAddress = (await POOL.getReserveData(daiAddress)).variableDebtTokenAddress;
  const debtToken = new ethers.Contract(debtTokenAddress, debtTokenABI, fakeSigner);
  const approveDebt = await debtToken.connect(fakeSigner).approveDelegation(flashLoan.address, flashloanAmount);

  const transfer = await DAI.connect(fakeSigner).transfer(flashLoan.address, flashloanAmount.mul(2));
  const assets : string[] = [daiAddress,];
  const amounts : ethers.BigNumber[] = [flashloanAmount, ]; 
  const interestRateModes : ethers.BigNumber[] = [BigNumber.from("2"), ];
  const params = ethers.utils.formatBytes32String("hello");
  const tx2 = await flashLoan.callAAVEFlashLoan(
    flashLoan.address,
    assets,
    amounts,
    interestRateModes,
    params,
    0
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
