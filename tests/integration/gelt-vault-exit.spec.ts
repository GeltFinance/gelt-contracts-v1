import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, IInterestBearingMasset, IVaultedInterestBearingMasset, MstableGeltVaultHarness } from '../../types';
import { ZERO_ADDRESS } from '../utils/fixtures';
import { Amount } from '../utils/amount';
import { mintWithAuthorization } from '../utils/meta-transactions';
import { EIP712Domain } from '../utils/eip712';
import { initIntegrationTestContext } from './integration-test-context';

describe('[Integration] Gelt Vault <> mStable - Exits', function () {
    this.timeout(120 * 1000);

    const bAssetAmount = new Amount(6);

    let signer: SignerWithAddress; // Default signer unless otherwise specified.
    let user1: SignerWithAddress;
    let vault: MstableGeltVaultHarness;
    let domain: EIP712Domain;
    let bAsset: ERC20;
    let imAsset: IInterestBearingMasset;
    let vimAsset: IVaultedInterestBearingMasset;
    let rewardToken: ERC20;

    before(async () => {
        [signer, user1] = await ethers.getSigners();
    });

    beforeEach(async () => {
        // Reset fork before each test case.
        ({ vault, domain, bAsset, imAsset, vimAsset, rewardToken } =
          await initIntegrationTestContext([signer, user1]));
    });

    describe('#voluntaryExit', async () => {
        it('should redeem all funds for the calling user (redeem amount <= free vault funds)', async () => {
            const mintAmount = bAssetAmount.getExact(1000);

            await bAsset.connect(user1).approve(vault.address, mintAmount);
            await mintWithAuthorization({ signer, vault, domain, minter: user1.address, mintAmount });
            expect(await bAsset.balanceOf(vault.address)).to.equal(mintAmount);

            const balanceBeforeExit = await bAsset.balanceOf(user1.address);
            await vault.connect(user1).voluntaryExit(user1.address, 1);
            const balanceAfterExit = await bAsset.balanceOf(user1.address);

            const redeemAmount = balanceAfterExit.sub(balanceBeforeExit);
            expect(bAssetAmount.isApproximatelyEqual(redeemAmount, mintAmount));
        });

        it('should redeem all funds for the calling user (redeem amount > free vault funds)', async () => {
            const mintAmount = bAssetAmount.getExact(1000);

            await bAsset.connect(user1).approve(vault.address, mintAmount);
            await mintWithAuthorization({ signer, vault, domain, minter: user1.address, mintAmount });
            expect(await bAsset.balanceOf(vault.address)).to.equal(mintAmount);

            await vault.executeStrategyNetDeposit(mintAmount);
            expect(await bAsset.balanceOf(vault.address)).to.equal(0);

            const balanceBeforeExit = await bAsset.balanceOf(user1.address);
            await vault.connect(user1).voluntaryExit(user1.address, 1);
            const balanceAfterExit = await bAsset.balanceOf(user1.address);

            const redeemAmount = balanceAfterExit.sub(balanceBeforeExit);
            expect(bAssetAmount.isApproximatelyEqual(redeemAmount, mintAmount));
            expect(await vault.balanceOf(user1.address)).to.equal(0);
        });

        it('should fail to redeem when minimum output quantity is not satisfied', async () => {
            const mintAmount = bAssetAmount.getExact(1000);

            await bAsset.connect(user1).approve(vault.address, mintAmount);
            await mintWithAuthorization({ signer, vault, domain, minter: user1.address, mintAmount });
            expect(await bAsset.balanceOf(vault.address)).to.equal(mintAmount);

            await expect(vault.connect(user1).voluntaryExit(user1.address, mintAmount.mul(2)))
                .to.be.revertedWith('minimum output quantity is not satisfied');
        });

        it('should redeem even when the strategy redemption fees are outside of tolerance', async () => {
            const mintAmount = bAssetAmount.getExact(1000);

            await bAsset.connect(user1).approve(vault.address, mintAmount);
            await mintWithAuthorization({ signer, vault, domain, minter: user1.address, mintAmount });
            expect(await bAsset.balanceOf(vault.address)).to.equal(mintAmount);

            const strategyTolerances = await vault.strategyTolerances();
            const newStrategyTolerances = {
                ...strategyTolerances,
                redemptionFeeBps: 0,
            }
            await vault.setStrategyTolerances(newStrategyTolerances);

            const balanceBeforeExit = await bAsset.balanceOf(user1.address);
            await vault.connect(user1).voluntaryExit(user1.address, 1);
            const balanceAfterExit = await bAsset.balanceOf(user1.address);

            const redeemAmount = balanceAfterExit.sub(balanceBeforeExit);
            expect(bAssetAmount.isApproximatelyEqual(redeemAmount, mintAmount));
        });

        it('should fail to redeem to the zero address', async () => {
            await expect(vault.connect(user1).voluntaryExit(ZERO_ADDRESS, 1))
              .to.be.revertedWith('withdrawing to the zero address is not allowed');
        });
    });

    describe('#emergencyExitStrategy', () => {
        it('should exit all positions and claim rewards from the strategy', async () => {
            const mintAmount = bAssetAmount.getExact(1000);
            await bAsset.connect(user1).transfer(vault.address, mintAmount);

            await vault.executeStrategyNetDeposit(mintAmount);
            expect(await bAsset.balanceOf(vault.address)).to.equal(0);

            await vault.emergencyExitStrategy();

            expect(await vimAsset.balanceOf(vault.address)).to.equal(0);
            expect(await imAsset.balanceOf(vault.address)).to.equal(0);
            expect(bAssetAmount.isApproximatelyEqual(await bAsset.balanceOf(vault.address), mintAmount));
            expect((await rewardToken.balanceOf(vault.address)).gt(0)).to.be.true;
        });

        it('should not revert when there are no funds in the strategy', async () => {
            expect(await vault.harnessGetStrategyValue()).to.equal(0);
            await vault.emergencyExitStrategy();
        });
    });
});
