// Fix BigInt handling for profit calculations
export function calculateProfit(amount: bigint, fee: bigint): bigint {
  return amount > fee ? amount - fee : 0n;
}

export function formatProfitability(profit: bigint, amount: bigint): string {
  if (amount === 0n) return "0%";
  const percentage = (profit * 10000n) / amount;
  return `${Number(percentage) / 100}%`;
}