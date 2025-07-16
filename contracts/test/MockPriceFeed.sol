// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockPriceFeed {
    int256 private _price;
    uint256 private _updatedAt;
    
    constructor() {
        _price = 2000e8; // $2000 USD
        _updatedAt = block.timestamp;
    }
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, _price, _updatedAt, _updatedAt, 1);
    }
    
    function setPrice(int256 price) external {
        _price = price;
        _updatedAt = block.timestamp;
    }
}