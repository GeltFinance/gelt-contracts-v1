import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, IInterestBearingMasset, IVaultedInterestBearingMasset, MstableGeltVaultHarness } from '../../types';
import { Amount } from '../utils/amount';
import { initIntegrationTestContext } from './integration-test-context';

describe('[Integration] Gelt Vault <> mStable - Execute strategy', function () {
    this.timeout(120 * 1000);

    const bAssetAmount = new Amount(6);
    const mAssetAmount = new Amount(18);

    let signer: SignerWithAddress; // Default signer unless otherwise specified.
    let user1: SignerWithAddress;
    let vault: MstableGeltVaultHarness;
    let bAsset: ERC20;
    let imAsset: IInterestBearingMasset;
    let vimAsset: IVaultedInterestBearingMasset;
    let precisionMultiplier: BigNumber;

    before(async () => {
        [signer, user1] = await ethers.getSigners();
    });

    beforeEach(async () => {
        // Reset fork before each test case.
        ({ vault, bAsset, imAsset, vimAsset } = await initIntegrationTestContext([signer, user1]));
        precisionMultiplier = await vault.precisionMultiplier();
    });

    describe('#executeStrategy', () => {
        it('should mint, save and stake the given amount of bAssets', async () => {
            const mintAmount = bAssetAmount.getExact(1000);
            await bAsset.connect(user1).transfer(vault.address, mintAmount);

            expect(await bAsset.balanceOf(vault.address)).to.equal(mintAmount);
            await vault.executeStrategyNetDeposit(mintAmount);
            expect(await bAsset.balanceOf(vault.address)).to.equal(0);

            const credits = await vimAsset.balanceOf(vault.address);
            const creditsRedeemed = await imAsset.creditsToUnderlying(credits);

            expect(credits.isZero()).to.be.false;
            expect(mAssetAmount.isApproximatelyEqual(creditsRedeemed, mintAmount.mul(precisionMultiplier))).to.be.true;
        });

        it('should unstake and redeem the given amount of bAssets', async () => {
            const mintAmount = bAssetAmount.getExact(100);
            await bAsset.connect(user1).transfer(vault.address, mintAmount);

            await vault.executeStrategyNetDeposit(mintAmount);

            const strategyValueBeforeInterest = await vault.harnessGetStrategyValue();
            await imAsset.depositInterest(mAssetAmount.getExact(10_000)); // Accumulate interest over time.
            const strategyValueAfterInterest = await vault.harnessGetStrategyValue();

            expect(strategyValueAfterInterest.gt(strategyValueBeforeInterest)).to.be.true;
            expect(strategyValueAfterInterest.gte(mintAmount)).to.be.true;

            await vault.executeStrategyNetWithdraw(mintAmount);

            expect(bAssetAmount.isApproximatelyEqual(await bAsset.balanceOf(vault.address), mintAmount)).to.be.true;
        });
    });
});
