// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBalancerVault {
    function flashLoan(
        address recipient,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata userData
    ) external;
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory);
}

contract FlashArbBotBalancer {
    address public owner;
    IBalancerVault public vault;
    IUniswapV2Router02 public sushiRouter;
    IUniswapV2Router02 public uniRouter;

    constructor(
        address _vault,
        address _sushiRouter,
        address _uniRouter
    ) {
        owner = msg.sender;
        vault = IBalancerVault(_vault);
        sushiRouter = IUniswapV2Router02(_sushiRouter);
        uniRouter = IUniswapV2Router02(_uniRouter);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function executeArb(
        address asset,
        uint256 amount,
        address[] calldata path,
        bool sushiFirst
    ) external onlyOwner {
        address ;
        assets[0] = asset;
        uint256 ;
        amounts[0] = amount;
        bytes memory userData = abi.encode(path, sushiFirst);
        vault.flashLoan(address(this), assets, amounts, userData);
    }

    function receiveFlashLoan(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata feeAmounts,
        bytes calldata userData
    ) external {
        require(msg.sender == address(vault), "Only Balancer vault");

        (address[] memory path, bool sushiFirst) = abi.decode(userData, (address[], bool));
        address asset = tokens[0];
        uint256 amount = amounts[0];

        IERC20(asset).approve(address(sushiRouter), amount);
        IERC20(asset).approve(address(uniRouter), amount);

        uint256 startingBal = IERC20(asset).balanceOf(address(this));

        if (sushiFirst) {
            sushiRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp);
            uint256 inter = IERC20(path[1]).balanceOf(address(this));
            IERC20(path[1]).approve(address(uniRouter), inter);
            uniRouter.swapExactTokensForTokens(inter, 0, _reverse(path), address(this), block.timestamp);
        } else {
            uniRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp);
            uint256 inter = IERC20(path[1]).balanceOf(address(this));
            IERC20(path[1]).approve(address(sushiRouter), inter);
            sushiRouter.swapExactTokensForTokens(inter, 0, _reverse(path), address(this), block.timestamp);
        }

        uint256 received = IERC20(asset).balanceOf(address(this));
        uint256 totalOwed = amount + feeAmounts[0];
        require(received > totalOwed, "Unprofitable");

        IERC20(asset).approve(address(vault), totalOwed);
    }

    function withdraw(address token) external onlyOwner {
        IERC20(token).transfer(owner, IERC20(token).balanceOf(address(this)));
    }

    function _reverse(address[] memory path) internal pure returns (address[] memory rev) {
        rev = new address[](path.length);
        for (uint256 i = 0; i < path.length; i++) {
            rev[i] = path[path.length - 1 - i];
        }
    }
}
