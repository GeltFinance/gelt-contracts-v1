export class MockVault {
    private static INITIAL_EXCHANGE_RATE = 1;

    private totalTokenSupply = 0;
    private totalAssetsInVault = 0;
    private totalStrategyValue = 0;

    /**
     * Total value held in the Vault which includes the amount loaned out to the strategy (mStable)
     * and the value held directly in the Vault.
     */
    public totalAssets(): number {
        return this.totalAssetsInVault + this.totalStrategyValue;
    }

    public exchangeRate(): number {
        if (this.totalTokenSupply === 0) {
            return MockVault.INITIAL_EXCHANGE_RATE;
        } else {
            return this.totalAssets() / this.totalTokenSupply;
        }
    }

    public mint(amount: number): number {
        if (amount <= 0) {
            throw new Error(`Failed to mint, supplied amount is less than or equal to zero`);
        }

        const tokens = this.mintTokens(amount / this.exchangeRate());

        this.totalAssetsInVault += amount;

        return tokens;
    }

    public redeem(tokens: number): number {
        if (tokens > this.totalTokenSupply) {
            throw new Error(`Failed to redeem, insufficient token supply (${tokens} > ${this.totalTokenSupply})`);
        }

        const amount = tokens * this.exchangeRate();
        if (amount > this.totalAssetsInVault) {
            throw new Error(`Failed to redeem, insufficient funds on contract (${amount} > ${this.totalAssetsInVault})`);
        }

        this.totalAssetsInVault -= amount;

        return this.burnTokens(amount);
    }

    public executeStrategy(amount: number) {
        this.totalAssetsInVault -= amount;
        this.totalStrategyValue += amount;
    }

    public addStrategyYield(amount: number) {
        this.totalStrategyValue += amount;
    }

    private mintTokens(tokens: number): number {
        this.totalTokenSupply += tokens;
        return tokens;
    }

    private burnTokens(tokens: number): number {
        this.totalTokenSupply -= tokens;
        return tokens;
    }
}
