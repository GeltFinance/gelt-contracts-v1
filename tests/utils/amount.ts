import { BigNumber, BigNumberish } from 'ethers';

export const UINT256_MAX = BigNumber.from(2).pow(256).sub(1);

export const INT256_MAX = BigNumber.from(2).pow(255).sub(1);

export class Amount {
    public static getExact(amount: BigNumberish, decimals: BigNumberish) {
        return BigNumber.from(amount).mul(Amount.scale(decimals));
    }

    private static scale(decimals: BigNumberish): BigNumber {
        return BigNumber.from(10).pow(decimals);
    }

    public readonly decimals;

    public constructor(decimals: number) {
        this.decimals = decimals;
    }

    public getExact(amount: BigNumberish) {
        return Amount.getExact(amount, this.decimals);
    }

    public isApproximatelyEqual(a: BigNumberish, b: BigNumberish): boolean {
        const diff = BigNumber.from(a).sub(b).abs();
        // console.log(`${a.toString()} ~= ${b.toString()}, ∆ = ${diff.toString()}`);
        return diff.lte(Amount.scale(this.decimals).div(2));
    }
}

export function simulateStrategyOverTime(days: number, dailyYield: number, amount: BigNumberish): BigNumber {
    if (days > 0) {
        const yieldScale = Math.pow(10, 8);
        const scaledDailyYield = Math.floor(dailyYield * yieldScale);

        return BigNumber.from(amount)
            .mul(BigNumber.from(yieldScale).add(scaledDailyYield).pow(days))
            .div(BigNumber.from(yieldScale).pow(days));
    } else {
        return BigNumber.from(amount);
    }
}

export function scaledBps(bps: number): BigNumberish {
    return BigNumber.from(bps).mul(1e14);
}
