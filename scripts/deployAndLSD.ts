import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BigNumber, Contract, ethers, Signer } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";

const hre: HardhatRuntimeEnvironment = require('hardhat');
const poolAddressProvider: string = '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e';
const daiAddress: string = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const WETHAddress: string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

const WETHGateWai: string = '0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C';

const aWETHAddress: string = '0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8';
const WALLET_ADDRESS="0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549"

const aTokenAbi = ["function balanceOf(address account) external view returns (uint256)",];
const debtTokenABI = ["function approveDelegation(address delegatee, uint256 amount) external"];
const WETHGateABI = ["function depositETH(address,address onBehalfOf,uint16 referralCode) payable external"];

const LIDO_ABI =  [
    {
        constant: false,
        inputs: [{ name: "_referral", type: "address" }],
        name: "submit",
        outputs: [{ name: "", type: "uint256" }],
        payable: true,
        stateMutability: "payable",
        type: "function"
    }
];

const LIDO_ADDRESS = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";

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

  // FLASH LOAN 2 wETH and summit it to LiDo and then use the stETH warp in wstETH, deposit wstETH in Aave

  // apporve flashloan to increase debt on fakesigner
  const flashloanAmount = ethers.utils.parseUnits("1", "ether");
  const debtTokenAddress = (await POOL.getReserveData(WETHAddress)).variableDebtTokenAddress;
  const debtToken = new ethers.Contract(debtTokenAddress, debtTokenABI, fakeSigner);
  const approveDebt = await debtToken.connect(fakeSigner).approveDelegation(flashLoan.address, flashloanAmount);

  const assets : string[] = [WETHAddress,];
  const amounts : ethers.BigNumber[] = [flashloanAmount, ]; 
  const interestRateModes : ethers.BigNumber[] = [BigNumber.from("2"), ];
  // this params is used to meet the condition in executeOperation
  const params = ethers.utils.formatBytes32String("0");
  const tx2 = await flashLoan.connect(fakeSigner).callAAVEFlashLoan(
    flashLoan.address,
    assets,
    amounts,
    interestRateModes,
    params,
    0,
    {gasLimit: 20000000}
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
