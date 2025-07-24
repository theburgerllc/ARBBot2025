"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatProfitability = exports.calculateProfit = void 0;
// Fix BigInt handling for profit calculations
function calculateProfit(amount, fee) {
    return amount > fee ? amount - fee : 0n;
}
exports.calculateProfit = calculateProfit;
function formatProfitability(profit, amount) {
    if (amount === 0n)
        return "0%";
    const percentage = (profit * 10000n) / amount;
    return `${Number(percentage) / 100}%`;
}
exports.formatProfitability = formatProfitability;
