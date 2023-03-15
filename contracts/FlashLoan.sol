// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {IFlashLoanReceiver} from "./interfaces/AAVE/IFlashLoanReceiver.sol";
import {IPoolAddressesProvider} from "./interfaces/AAVE/IPoolAddressesProvider.sol";
import {IPool} from "./interfaces/AAVE/IPool.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {IWstETH} from "./interfaces/LIDO/IWstETH.sol";
import {ILido} from "./interfaces/LIDO/ILido.sol";

import {ISwapRouter} from '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

import "hardhat/console.sol";

contract FlashLoan is IFlashLoanReceiver{
    IPoolAddressesProvider public override ADDRESSES_PROVIDER;
    ISwapRouter public SWAP_ROUTER;

    IPool public override POOL;
    address public OWNER;

    bytes32 public constant LIDOMODE = '0';
    address public LIDOADDRESS = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    address payable public WSTADDRESS = payable(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);

    constructor(address provider, address swapRouter, address owner) public {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        SWAP_ROUTER = ISwapRouter(swapRouter);
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
        uint16 poolFee = uint16(bytes2(params[20:22]));
        uint256 expectAmountOut = uint256(bytes32(params[22:]));
        console.log("Long address", Long);
        console.log("poolFee is: ", poolFee);
        console.log("expectAmountOut: ", expectAmountOut);
        // if (keccak256(abi.encodePacked(params)) == keccak256(abi.encodePacked(LIDOMODE))) {
        //     _excuteLIDO(assets[0], amounts[0]);
        //     return true;
        // }

        // uint256 balance = IERC20(assets[0]).balanceOf(address(this));
        // console.log("excuteOp balance is: ", IERC20(assets[0]).balanceOf(address(this)));
        // console.log("supply");
        console.log("short asset is ",assets[0]);
        console.log("flash loan amount is ", amounts[0]);
        console.log("premiums is ", premiums[0]);
        uint256 amountOut = swapExactInputSingle(assets[0], Long, amounts[0], poolFee, expectAmountOut);
        console.log("After swap amount is :", amountOut);

        // deposit the amount of asset to IPOOL

        // approve pool to pull money form this to deposit
        IERC20(Long).approve(address(POOL), amountOut);
        POOL.supply(
            Long,
            amountOut,
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

    /**
     * @notice swapExactInputSingle swaps a fixed amount of DAI for a maximum possible amount of WETH9
     * using the DAI/WETH9 0.3% pool by calling `exactInputSingle` in the swap router.
     * @dev The calling address must approve this contract to spend at least `amountIn` worth of its asset for this function to succeed.
     * @param shortAsset The address of the short asset, which is borrow from flash loan
     * @param longAsset The address of the short asset, which is used to deposit in AAVE
     * @param amountIn The exact amount of DAI that will be swapped for WETH9.
     * @param poolFee The pool Fee level
     * @param expectAmountOut The expected amount of the Swap Output, calculated by the slip point acceptable to the user
     * @return amountOut The amount of Long asset received.
     */
    function swapExactInputSingle(
        address shortAsset, 
        address longAsset, 
        uint256 amountIn,
        uint24 poolFee,
        uint256 expectAmountOut
    ) public returns (uint256 amountOut) {
        // msg.sender must approve this contract

        // Approve the router to spend short asset.
        console.log("short asset is", shortAsset);
        _safeApprove(shortAsset, address(SWAP_ROUTER), amountIn);
        console.log("approve done");
        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: shortAsset,
                tokenOut: longAsset,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        // The call to `exactInputSingle` executes the swap.
        amountOut = SWAP_ROUTER.exactInputSingle(params);
        console.log("swap done");
    }

    function _safeApprove(
        address token,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.approve.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'SA');
    }

    receive() external payable {}
}