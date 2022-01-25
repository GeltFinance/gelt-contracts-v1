import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, MstableGeltVaultHarness } from '../../types';
import { Amount } from '../utils/amount';
import { initIntegrationTestContext } from './integration-test-context';

describe('[Integration] Gelt Vault <> mStable - Rewards', function () {
    this.timeout(120 * 1000);

    const bAssetAmount = new Amount(6);

    let signer: SignerWithAddress; // Default signer unless otherwise specified.
    let user1: SignerWithAddress;
    let vault: MstableGeltVaultHarness;
    let bAsset: ERC20;
    let platformToken: ERC20;
    let rewardToken: ERC20;

    before(async () => {
        [signer, user1] = await ethers.getSigners();
    });

    beforeEach(async () => {
        // Reset fork before each test case.
        ({ vault, bAsset, platformToken, rewardToken } = await initIntegrationTestContext([signer, user1]));
    });


    describe('#claimRewards', () => {
        it('should claim both platform and reward tokens', async () => {
            const mintAmount = bAssetAmount.getExact(1000);
            await bAsset.connect(user1).transfer(vault.address, mintAmount);

            await vault.executeStrategyNetDeposit(mintAmount);

            expect(await platformToken.balanceOf(vault.address)).to.equal(0);
            expect(await rewardToken.balanceOf(vault.address)).to.equal(0);
            await vault.claimGovernanceTokens();

            expect((await platformToken.balanceOf(vault.address)).gt(0)).to.be.true;
            expect((await rewardToken.balanceOf(vault.address)).gt(0)).to.be.true;
        });

        it('should claim no rewards when strategy value = 0', async () => {
            expect(await platformToken.balanceOf(vault.address)).to.equal(0);
            expect(await rewardToken.balanceOf(vault.address)).to.equal(0);

            await vault.claimGovernanceTokens();

            expect(await platformToken.balanceOf(vault.address)).to.equal(0);
            expect(await rewardToken.balanceOf(vault.address)).to.equal(0);
        });
    });

    describe('#collectRewards', () => {
        it('should collect rewards to the pre-set reward collector address', async () => {
            const mintAmount = bAssetAmount.getExact(1000);
            await bAsset.connect(user1).transfer(vault.address, mintAmount);

            await vault.executeStrategyNetDeposit(mintAmount);

            await vault.claimGovernanceTokens();
            const rewardTokenBalance = await rewardToken.balanceOf(vault.address);
            const platformTokenBalance = await platformToken.balanceOf(vault.address);
            expect(rewardTokenBalance.gt(0)).to.be.true;
            expect(platformTokenBalance.gt(0)).to.be.true;

            await vault.setCollector(user1.address);
            await vault.collectGovernanceTokens();
            expect(await rewardToken.balanceOf(user1.address)).to.equal(rewardTokenBalance);
            expect(await platformToken.balanceOf(user1.address)).to.equal(platformTokenBalance);
            expect(await rewardToken.balanceOf(vault.address)).to.equal(0);
            expect(await platformToken.balanceOf(vault.address)).to.equal(0);
        });

        it('should not revert when there are no rewards to collect', async () => {
            expect(await rewardToken.balanceOf(vault.address)).to.equal(0);
            expect(await platformToken.balanceOf(vault.address)).to.equal(0);
            await vault.setCollector(user1.address);
            await vault.collectGovernanceTokens();
            expect(await rewardToken.balanceOf(user1.address)).to.equal(0);
            expect(await platformToken.balanceOf(user1.address)).to.equal(0);
        });

        it('should revert when the reward collector address is unset', async () => {
             await expect(vault.collectGovernanceTokens())
               .to.be.revertedWith('collecting governance tokens to the zero address is not allowed');
        });
    });
});
