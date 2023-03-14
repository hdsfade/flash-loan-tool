// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {IFlashLoanReceiver} from "./interfaces/AAVE/IFlashLoanReceiver.sol";
import {IPoolAddressesProvider} from "./interfaces/AAVE/IPoolAddressesProvider.sol";
import {IPool} from "./interfaces/AAVE/IPool.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {IWstETH} from "./interfaces/LIDO/IWstETH.sol";
import {ILido} from "./interfaces/LIDO/ILido.sol";

import "hardhat/console.sol";

contract FlashLoan is IFlashLoanReceiver{
    IPoolAddressesProvider public override ADDRESSES_PROVIDER;
    IPool public override POOL;
    address public OWNER;

    bytes32 public constant LIDOMODE = '0';
    address public LIDOADDRESS = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    address payable public WSTADDRESS = payable(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);

    constructor(address provider, address owner) public {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        OWNER = owner;
    }

    /**
     * @dev call Aave flashLoanSimple func
     * @param receiverAddress The address of the contract receiving the funds, implementing IFlashLoanSimpleReceiver interface
     * @param assets The address of the asset being flash-borrowed
     * @param amounts The amount of the asset being flash-borrowed
     * @param interestRateModes The ir modes for each asset
     * @param params describe in IPool flashLoanSimple
     * @param referralCode describe in IPool flashLoanSimple
     */
    function callAAVEFlashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] memory amounts,
        uint256[] memory interestRateModes,
        bytes memory params,
        uint16 referralCode
    ) external returns (bool) {
        // uint256 balance = IERC20(assets[0]).balanceOf(address(this));
        // console.log("balance is: ", balance);
        POOL.flashLoan(
            address(this), 
            assets, 
            amounts, 
            interestRateModes,
            OWNER, 
            params,
            referralCode
        );

        return true;
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        console.log("initiator is: ", initiator);
        // console.logBytes(abi.encodePacked(params));
        // console.logBytes(abi.encodePacked(LIDOMODE));
        // (address Long, uint16 slip, uint256 expectAmountOut) = abi.decode(params, (address, uint16, uint256));
        address Long = address(bytes20(params[0:20]));
        uint16 slip = uint16(bytes2(params[20:22]));
        uint256 expectAmountOut = uint256(bytes32(params[22:]));
        console.log("Long address", Long);
        console.log("slipage is: ", slip);
        console.log("expectAmountOut: ", expectAmountOut);
        // if (keccak256(abi.encodePacked(params)) == keccak256(abi.encodePacked(LIDOMODE))) {
        //     _excuteLIDO(assets[0], amounts[0]);
        //     return true;
        // }

        // deposit the amount of asset to IPOOL
        uint256 approve = amounts[0] * 3;
        console.log(approve);
        // approve pool to pull money form this to deposit
        IERC20(assets[0]).approve(address(POOL), approve);
        // uint256 balance = IERC20(assets[0]).balanceOf(address(this));
        // console.log("excuteOp balance is: ", IERC20(assets[0]).balanceOf(address(this)));
        // console.log("supply");
        console.log("asset is ",assets[0]);
        console.log("amount is ", amounts[0]);
        console.log("premiums is ", premiums[0]);

        POOL.supply(
            assets[0],
            amounts[0],
            OWNER,
            0
        );

        console.log("finish execute Op");
        return true;
    }

    // use transfer and send run out of gas!!!!!
    // the Out-of-gas problem may be caused by sending eth between the contract and weth, and transfer eth to lido to wstcontract
    // But i think that is a little useless
    function _excuteLIDO(address weth, uint256 amount) internal returns (bool) {
        // submit eth to 
        console.log(weth);
        console.log(amount);
        // console.logBytes4(bytes4(keccak256(bytes("withdraw(uint256)"))));
        uint256 balance = IWETH(weth).balanceOf(address(this));
        console.log(balance);
        IWETH(weth).withdraw(amount);
        console.log("withdraw");
        // uint256 stETH = ILido(LIDOADDRESS).submit{value:amount}(address(this));
        // use the shortcut wstETH supply to submit eth to lido; 
        (bool sent, ) = WSTADDRESS.call{value:amount}("");
        require(sent, "send eth to wstEther fail");
        console.log("transfer done");
        uint256 wstETH = IWstETH(WSTADDRESS).balanceOf(address(this));
        console.log(wstETH);
        // approve pool to pull money form this to deposit
        IERC20(WSTADDRESS).approve(address(POOL), wstETH);
        POOL.supply(
            WSTADDRESS,
            wstETH,
            OWNER,
            0
        );

        console.log("finish _excuteLIDO Op");
        return true;
    }

    receive() external payable {}
}