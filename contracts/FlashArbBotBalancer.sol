// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

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
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

interface IUniswapV3Quoter {
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut);
}

interface IAggregatorV3 {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract FlashArbBotBalancer is Ownable, ReentrancyGuard, Pausable {
    IBalancerVault public vault;
    IUniswapV2Router02 public sushiRouter;
    IUniswapV2Router02 public uniRouter;
    IUniswapV3Quoter public uniV3Quoter;
    
    // Additional routers for extended functionality
    IUniswapV2Router02 public uniV2RouterNew;
    IUniswapV2Router02 public sushiRouterNew;
    
    // Token addresses - Arbitrum
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address public constant USDC = 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8;
    address public constant USDT = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
    address public constant WBTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;
    
    // Router addresses - Arbitrum
    address public constant UNI_V2_ROUTER_NEW = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372ad24;
    address public constant SUSHI_ROUTER_NEW = 0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55;
    
    // Router addresses - Optimism
    address public constant UNI_V2_ROUTER_OPT = 0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2;
    address public constant SUSHI_ROUTER_OPT = 0x2ABf469074dc0b54d793850807E6eb5Faf2625b1;
    
    // Network identification
    uint256 public currentChainId;
    bool public isOptimism;
    bool public isArbitrum;
    
    uint256 public constant MAX_SLIPPAGE = 500; // 5%
    uint256 public constant MIN_PROFIT_BPS = 50; // 0.5%
    uint256 public slippageTolerance = 200; // 2%
    uint256 public minProfitBps = 30; // 0.3%
    
    mapping(address => address) public priceFeeds;
    mapping(address => bool) public authorizedCallers;
    
    event ArbitrageExecuted(
        address indexed asset,
        uint256 amount,
        uint256 profit,
        bool sushiFirst
    );
    
    event TriangularArbitrageExecuted(
        address indexed tokenA,
        address indexed tokenB,
        address indexed tokenC,
        uint256 amount,
        uint256 profit
    );
    
    event CrossChainOpportunityDetected(
        uint256 indexed chainId,
        address indexed asset,
        uint256 spread,
        uint256 estimatedProfit
    );
    
    event ProfitWithdrawn(address indexed token, uint256 amount);
    
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(
        address _vault,
        address _sushiRouter,
        address _uniRouter,
        address _uniV3Quoter
    ) {
        vault = IBalancerVault(_vault);
        sushiRouter = IUniswapV2Router02(_sushiRouter);
        uniRouter = IUniswapV2Router02(_uniRouter);
        uniV3Quoter = IUniswapV3Quoter(_uniV3Quoter);
        
        // Initialize additional routers based on chain
        currentChainId = block.chainid;
        isArbitrum = currentChainId == 42161;
        isOptimism = currentChainId == 10;
        
        if (isArbitrum) {
            uniV2RouterNew = IUniswapV2Router02(UNI_V2_ROUTER_NEW);
            sushiRouterNew = IUniswapV2Router02(SUSHI_ROUTER_NEW);
        } else if (isOptimism) {
            uniV2RouterNew = IUniswapV2Router02(UNI_V2_ROUTER_OPT);
            sushiRouterNew = IUniswapV2Router02(SUSHI_ROUTER_OPT);
        }
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }
    
    function setSlippageTolerance(uint256 _slippage) external onlyOwner {
        require(_slippage <= MAX_SLIPPAGE, "Slippage too high");
        slippageTolerance = _slippage;
    }
    
    function setMinProfitBps(uint256 _minProfit) external onlyOwner {
        require(_minProfit > 0, "Min profit must be positive");
        minProfitBps = _minProfit;
    }
    
    function setPriceFeed(address token, address feed) external onlyOwner {
        priceFeeds[token] = feed;
    }

    function executeArb(
        address asset,
        uint256 amount,
        address[] calldata path,
        bool sushiFirst,
        uint256 expectedProfit
    ) external onlyAuthorized whenNotPaused nonReentrant {
        require(path.length >= 2, "Invalid path");
        require(amount > 0, "Amount must be positive");
        require(expectedProfit > 0, "Expected profit must be positive");
        
        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        
        bytes memory userData = abi.encode(path, sushiFirst, expectedProfit, false); // false = not triangular
        vault.flashLoan(address(this), assets, amounts, userData);
    }
    
    function executeTriangularArb(
        address asset,
        uint256 amount,
        address[] calldata path,
        uint256 expectedProfit
    ) external onlyAuthorized whenNotPaused nonReentrant {
        require(path.length == 4, "Triangular path must have 4 tokens (A->B->C->A)");
        require(path[0] == path[3], "Path must start and end with same token");
        require(amount > 0, "Amount must be positive");
        require(expectedProfit > 0, "Expected profit must be positive");
        
        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        
        bytes memory userData = abi.encode(path, false, expectedProfit, true); // true = triangular
        vault.flashLoan(address(this), assets, amounts, userData);
    }

    function receiveFlashLoan(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata feeAmounts,
        bytes calldata userData
    ) external {
        require(msg.sender == address(vault), "Only Balancer vault");

        (address[] memory path, bool sushiFirst, uint256 expectedProfit, bool isTriangular) = abi.decode(userData, (address[], bool, uint256, bool));
        address asset = tokens[0];
        uint256 amount = amounts[0];

        require(_validatePriceFeeds(path), "Invalid price feed");

        uint256 startingBal = IERC20(asset).balanceOf(address(this));
        
        if (isTriangular) {
            _executeTriangularSwap(asset, amount, path);
        } else {
            _executeDualSwap(asset, amount, path, sushiFirst);
        }

        uint256 received = IERC20(asset).balanceOf(address(this));
        uint256 totalOwed = amount + feeAmounts[0];
        require(received >= totalOwed, "Unprofitable");
        
        uint256 profit = received - totalOwed;
        uint256 minProfit = (amount * minProfitBps) / 10000;
        require(profit >= minProfit, "Profit too low");
        
        require(profit >= expectedProfit * 95 / 100, "Profit deviation too high");

        IERC20(asset).approve(address(vault), totalOwed);
        
        if (isTriangular) {
            emit TriangularArbitrageExecuted(path[0], path[1], path[2], amount, profit);
        } else {
            emit ArbitrageExecuted(asset, amount, profit, sushiFirst);
        }
    }
    
    function _executeDualSwap(
        address asset,
        uint256 amount,
        address[] memory path,
        bool sushiFirst
    ) internal {
        IERC20(asset).approve(address(sushiRouter), amount);
        IERC20(asset).approve(address(uniRouter), amount);
        IERC20(asset).approve(address(uniV2RouterNew), amount);
        IERC20(asset).approve(address(sushiRouterNew), amount);

        uint256 intermediateAmount;
        if (sushiFirst) {
            uint256 minOut1 = _calculateMinOutput(amount, path, true);
            uint256[] memory amounts1 = _getBestRouter(true).swapExactTokensForTokens(
                amount, 
                minOut1, 
                path, 
                address(this), 
                block.timestamp + 300
            );
            intermediateAmount = amounts1[amounts1.length - 1];
            
            IERC20(path[1]).approve(address(_getBestRouter(false)), intermediateAmount);
            address[] memory reversePath = _reverse(path);
            uint256 minOut2 = _calculateMinOutput(intermediateAmount, reversePath, false);
            _getBestRouter(false).swapExactTokensForTokens(
                intermediateAmount, 
                minOut2, 
                reversePath, 
                address(this), 
                block.timestamp + 300
            );
        } else {
            uint256 minOut1 = _calculateMinOutput(amount, path, false);
            uint256[] memory amounts1 = _getBestRouter(false).swapExactTokensForTokens(
                amount, 
                minOut1, 
                path, 
                address(this), 
                block.timestamp + 300
            );
            intermediateAmount = amounts1[amounts1.length - 1];
            
            IERC20(path[1]).approve(address(_getBestRouter(true)), intermediateAmount);
            address[] memory reversePath = _reverse(path);
            uint256 minOut2 = _calculateMinOutput(intermediateAmount, reversePath, true);
            _getBestRouter(true).swapExactTokensForTokens(
                intermediateAmount, 
                minOut2, 
                reversePath, 
                address(this), 
                block.timestamp + 300
            );
        }
    }
    
    function _executeTriangularSwap(
        address asset,
        uint256 amount,
        address[] memory path
    ) internal {
        // Approve all routers
        IERC20(asset).approve(address(uniV2RouterNew), amount);
        IERC20(asset).approve(address(sushiRouterNew), amount);
        
        // Step 1: A -> B
        address[] memory pathAB = new address[](2);
        pathAB[0] = path[0];
        pathAB[1] = path[1];
        
        uint256 minOut1 = _calculateMinOutput(amount, pathAB, false);
        uint256[] memory amounts1 = uniV2RouterNew.swapExactTokensForTokens(
            amount,
            minOut1,
            pathAB,
            address(this),
            block.timestamp + 300
        );
        uint256 amountB = amounts1[amounts1.length - 1];
        
        // Step 2: B -> C
        address[] memory pathBC = new address[](2);
        pathBC[0] = path[1];
        pathBC[1] = path[2];
        
        IERC20(path[1]).approve(address(sushiRouterNew), amountB);
        uint256 minOut2 = _calculateMinOutput(amountB, pathBC, true);
        uint256[] memory amounts2 = sushiRouterNew.swapExactTokensForTokens(
            amountB,
            minOut2,
            pathBC,
            address(this),
            block.timestamp + 300
        );
        uint256 amountC = amounts2[amounts2.length - 1];
        
        // Step 3: C -> A
        address[] memory pathCA = new address[](2);
        pathCA[0] = path[2];
        pathCA[1] = path[0];
        
        IERC20(path[2]).approve(address(uniV2RouterNew), amountC);
        uint256 minOut3 = _calculateMinOutput(amountC, pathCA, false);
        uniV2RouterNew.swapExactTokensForTokens(
            amountC,
            minOut3,
            pathCA,
            address(this),
            block.timestamp + 300
        );
    }
    
    function _getBestRouter(bool useSushi) internal view returns (IUniswapV2Router02) {
        if (useSushi) {
            return address(sushiRouterNew) != address(0) ? sushiRouterNew : sushiRouter;
        } else {
            return address(uniV2RouterNew) != address(0) ? uniV2RouterNew : uniRouter;
        }
    }

    function _calculateMinOutput(
        uint256 amountIn, 
        address[] memory path, 
        bool useSushi
    ) internal view returns (uint256) {
        uint256[] memory amounts;
        IUniswapV2Router02 router = _getBestRouter(useSushi);
        amounts = router.getAmountsOut(amountIn, path);
        
        uint256 expectedOut = amounts[amounts.length - 1];
        return expectedOut * (10000 - slippageTolerance) / 10000;
    }
    
    function _validatePriceFeeds(address[] memory path) internal view returns (bool) {
        for (uint256 i = 0; i < path.length; i++) {
            if (priceFeeds[path[i]] != address(0)) {
                IAggregatorV3 priceFeed = IAggregatorV3(priceFeeds[path[i]]);
                (, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
                require(price > 0, "Invalid price");
                require(block.timestamp - updatedAt < 3600, "Price too old");
            }
        }
        return true;
    }

    function withdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        IERC20(token).transfer(owner(), balance);
        emit ProfitWithdrawn(token, balance);
    }
    
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner(), balance);
        }
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    function _reverse(address[] memory path) internal pure returns (address[] memory rev) {
        rev = new address[](path.length);
        for (uint256 i = 0; i < path.length; i++) {
            rev[i] = path[path.length - 1 - i];
        }
    }
    
    function simulateArbitrage(
        address asset,
        uint256 amount,
        address[] calldata path,
        bool sushiFirst
    ) external view returns (uint256 profit) {
        uint256[] memory amounts1;
        uint256[] memory amounts2;
        
        IUniswapV2Router02 router1 = _getBestRouter(sushiFirst);
        IUniswapV2Router02 router2 = _getBestRouter(!sushiFirst);
        
        if (sushiFirst) {
            amounts1 = router1.getAmountsOut(amount, path);
            amounts2 = router2.getAmountsOut(amounts1[amounts1.length - 1], _reverse(path));
        } else {
            amounts1 = router2.getAmountsOut(amount, path);
            amounts2 = router1.getAmountsOut(amounts1[amounts1.length - 1], _reverse(path));
        }
        
        uint256 finalAmount = amounts2[amounts2.length - 1];
        if (finalAmount > amount) {
            profit = finalAmount - amount;
        } else {
            profit = 0;
        }
    }
    
    function simulateTriangularArbitrage(
        address asset,
        uint256 amount,
        address[] calldata path
    ) external view returns (uint256 profit) {
        require(path.length == 4, "Triangular path must have 4 tokens");
        require(path[0] == path[3], "Path must start and end with same token");
        
        // Step 1: A -> B
        address[] memory pathAB = new address[](2);
        pathAB[0] = path[0];
        pathAB[1] = path[1];
        uint256[] memory amounts1 = uniV2RouterNew.getAmountsOut(amount, pathAB);
        uint256 amountB = amounts1[amounts1.length - 1];
        
        // Step 2: B -> C
        address[] memory pathBC = new address[](2);
        pathBC[0] = path[1];
        pathBC[1] = path[2];
        uint256[] memory amounts2 = sushiRouterNew.getAmountsOut(amountB, pathBC);
        uint256 amountC = amounts2[amounts2.length - 1];
        
        // Step 3: C -> A
        address[] memory pathCA = new address[](2);
        pathCA[0] = path[2];
        pathCA[1] = path[0];
        uint256[] memory amounts3 = uniV2RouterNew.getAmountsOut(amountC, pathCA);
        uint256 finalAmount = amounts3[amounts3.length - 1];
        
        if (finalAmount > amount) {
            profit = finalAmount - amount;
        } else {
            profit = 0;
        }
    }
}
