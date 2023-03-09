// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {IFlashLoanReceiver} from "./interfaces/AAVE/IFlashLoanReceiver.sol";
import {IPoolAddressesProvider} from "./interfaces/AAVE/IPoolAddressesProvider.sol";
import {IPool} from "./interfaces/AAVE/IPool.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import "hardhat/console.sol";

contract FlashLoan is IFlashLoanReceiver{
    IPoolAddressesProvider public override ADDRESSES_PROVIDER;
    IPool public override POOL;
    address public OWNER;

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
        uint256 balance = IERC20(assets[0]).balanceOf(address(this));
        console.log("balance is: ", balance);
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
        // deposit the amount of asset to IPOOL
        uint256 approve = amounts[0] * 3;
        console.log(approve);
        IERC20(assets[0]).approve(address(POOL), approve);
        // uint256 balance = IERC20(assets[0]).balanceOf(address(this));
        console.log("excuteOp balance is: ", IERC20(assets[0]).balanceOf(address(this)));
        console.log("supply");
        console.log("asset is ",assets[0]);
        console.log("amount is ", amounts[0]);
        console.log("premiums is ", premiums[0]);
        // POOL.supply(
        //     assets[0],
        //     amounts[0],
        //     OWNER,
        //     0
        // );
        // uint256 availableBorrowBase;
        // uint256 totalCollateralBase;
        // uint256 totalDebtBase;
        // uint256 currentLiquidationThreshold;
        // (
        //     totalCollateralBase,
        //     totalDebtBase,
        //     availableBorrowBase,
        //     currentLiquidationThreshold,
        //     ,
        // ) = POOL.getUserAccountData(OWNER);
        // console.log("totalCollateralBase is ", totalCollateralBase);
        // console.log("totalDebtBase is ", totalDebtBase);
        // console.log("availableBorrowBase is ", availableBorrowBase);
        POOL.supply(
            assets[0],
            amounts[0],
            OWNER,
            0
        );
        // (
        //     totalCollateralBase,
        //     totalDebtBase,
        //     availableBorrowBase,
        //     currentLiquidationThreshold,
        //     ,
        // ) = POOL.getUserAccountData(OWNER);
        // console.log("totalCollateralBase is ", totalCollateralBase);
        // console.log("totalDebtBase is ", totalDebtBase);
        // console.log("availableBorrowBase is ", availableBorrowBase);
        // calculate the amount can borrow and the fee should repay
        // borrow, for variable ir
        // POOL.borrow(
        //     assets[0], 
        //     borrowAmount, 
        //     2, 
        //     0, 
        //     address(this)
        // );

        // swap the 
        console.log("finish execute Op");
        return true;
    }
}