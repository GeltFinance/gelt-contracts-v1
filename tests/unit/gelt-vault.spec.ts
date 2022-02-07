import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, MstableGeltVaultHarness } from '../../types';
import { StrategyTolerancesStruct } from '../../types/IGeltVault';
import { EIP712Domain } from '../utils/eip712';
import {
    DEAD_ADDRESS,
    ZERO_ADDRESS,
    defaultErc20Options,
    deployDefaultVault,
    deployErc20Token,
    deployMstableGeltVault
} from '../utils/fixtures';
import { mintWithAuthorization, redeemWithAuthorization } from '../utils/meta-transactions';
import { Amount, scaledBps } from '../utils/amount';
import { hardhatDisableFork } from '../utils/network';

describe('[Unit] Gelt Vault', () => {
    const stablecoinAmount = new Amount(6);
    const gtokenAmount = new Amount(18);
    let signer: SignerWithAddress; // Default signer unless otherwise specified.
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let token: ERC20;
    let vault: MstableGeltVaultHarness;
    let domain: EIP712Domain;

    before(async () => {
        [signer, user1, user2] = await ethers.getSigners();

        // Disable network forking for unit tests.
        await hardhatDisableFork();
    });

    beforeEach(async () => {
        const erc20Options = { ...defaultErc20Options, decimals: stablecoinAmount.decimals };
        ({ token, vault, domain } = await deployDefaultVault(signer, erc20Options)); // signer will be admin.
    });

    describe('#initialize', () => {
        it('should fail if one of the initialize parameters is the zero address', async () => {
            const mstableGeltVaultOptions = { bAsset: DEAD_ADDRESS, useMockStrategy: false };
            const errorMessage = 'must not be 0';

            await expect(deployMstableGeltVault(signer, { ...mstableGeltVaultOptions, bAsset: ZERO_ADDRESS }))
                .to.be.revertedWith(errorMessage);
            await expect(deployMstableGeltVault(signer, { ...mstableGeltVaultOptions, mAsset: ZERO_ADDRESS }))
                .to.be.revertedWith(errorMessage);
            await expect(deployMstableGeltVault(signer, { ...mstableGeltVaultOptions, imAsset: ZERO_ADDRESS }))
                .to.be.revertedWith(errorMessage);
            await expect(deployMstableGeltVault(signer, { ...mstableGeltVaultOptions, vimAsset: ZERO_ADDRESS }))
                .to.be.revertedWith(errorMessage);
        });
    });

    describe('#mintWithAuthorization', () => {
        const mintAmount = stablecoinAmount.getExact(100);
        let minter: string;

        before(() => {
            minter = user1.address;
        });

        beforeEach(async () => {
            await token.transfer(minter, mintAmount.mul(4));
        });

        it('should return the initial exchange rate when totalSupply = 0', async () => {
            expect(await vault.exchangeRate()).to.equal(gtokenAmount.getExact(1).div(100));
        });

        it('should mint tokens 1:100 when totalSupply == 0', async () => {
            await token.connect(user1).approve(vault.address, mintAmount);
            await mintWithAuthorization({ signer, vault, domain, minter, mintAmount });

            expect(await vault.balanceOf(minter)).to.equal(gtokenAmount.getExact(10000));
        });

        it('should return the correct exchange rate when totalSupply > 0', async () => {
            await token.connect(user1).approve(vault.address, mintAmount.mul(2));
            await mintWithAuthorization({ signer, vault, domain, minter, mintAmount });
            await mintWithAuthorization({ signer, vault, domain, minter, mintAmount });

            expect(await vault.exchangeRate()).to.equal(gtokenAmount.getExact(1).div(100));
        });

        it('should mint the correct amount of tokens when totalSupply > 0', async () => {
            await token.connect(user1).approve(vault.address, mintAmount.mul(4));
            await mintWithAuthorization({ signer, vault, domain, minter, mintAmount });
            await mintWithAuthorization({ signer, vault, domain, minter, mintAmount: mintAmount.mul(3) });

            expect(await vault.balanceOf(minter)).to.equal(gtokenAmount.getExact(40000));
        });
    });

    describe('#redeemWithAuthorization', () => {
        const mintAmount = stablecoinAmount.getExact(100);
        let minter: string;
        let redeemer: string;
        let withdrawTo: string;

        beforeEach(async () => {
            await token.transfer(redeemer, mintAmount.mul(4));
        });

        before(() => {
            minter = user1.address;
            redeemer = user1.address;
            withdrawTo = user2.address;
        });

        it('should redeem the correct amount after initial mint', async () => {
            await token.connect(user1).approve(vault.address, mintAmount);
            await mintWithAuthorization({ signer, vault, domain, minter, mintAmount });

            const redeemTokens = await vault.balanceOf(minter);
            await redeemWithAuthorization({ signer, vault, domain, redeemer, redeemTokens, withdrawTo });

            const amount = await token.balanceOf(withdrawTo);
            expect(amount).to.equal(mintAmount);
        });

        it('should redeem the correct amount after multiple mints', async () => {
            await token.connect(user1).approve(vault.address, mintAmount.mul(4));
            await mintWithAuthorization({ signer, vault, domain, minter, mintAmount });
            await mintWithAuthorization({ signer, vault, domain, minter, mintAmount: mintAmount.mul(3) });

            const redeemTokens = gtokenAmount.getExact(10000);
            await redeemWithAuthorization({ signer, vault, domain, redeemer, redeemTokens, withdrawTo });

            const amount = await token.balanceOf(withdrawTo);
            expect(amount).to.equal(mintAmount);
        });

        it('should fail to redeem when there are no tokens minted', async () => {
            const redeemTokens = gtokenAmount.getExact(10000);
            await expect(redeemWithAuthorization({ signer, vault, domain, redeemer, redeemTokens, withdrawTo }))
                .to.be.revertedWith('burn amount exceeds balance');
        });

        it('should fail to redeem when trying to redeem more tokens than minted', async () => {
            await token.connect(user1).approve(vault.address, mintAmount);
            await mintWithAuthorization({ signer, vault, domain, minter, mintAmount });

            const redeemTokens = gtokenAmount.getExact(20000);
            await expect(redeemWithAuthorization({ signer, vault, domain, redeemer, redeemTokens, withdrawTo }))
                .to.be.revertedWith('burn amount exceeds balance');
        });
    });

    describe('#executeStrategyNetDeposit', () => {
        it('should revert when amount = 0', async () => {
            await expect(vault.executeStrategyNetDeposit(0)).to.be.revertedWith('amount must not be 0');
        });
    });

    describe('#executeStrategyNetWithdraw', () => {
        it('should revert when amount = 0', async () => {
            await expect(vault.executeStrategyNetWithdraw(0)).to.be.revertedWith('amount must not be 0');
        });
    });

    describe('#emergencyExitStrategy', () => {
        it('should revert when the minimum output quantity is zero', async () => {
            await expect(vault.emergencyExitStrategy(0)).to.be.revertedWith('minOutputQuantity must not be 0');
        });
    });

    describe('#sweep', () => {
        it('should sweep the given amount of tokens', async () => {
            const otherToken = await deployErc20Token(user1, defaultErc20Options);
            await otherToken.transfer(vault.address, 1000);
            expect(await otherToken.balanceOf(signer.address)).to.equal(0);
            expect(await otherToken.balanceOf(vault.address)).to.equal(1000);

            await vault.sweep(otherToken.address, 1000);

            expect(await otherToken.balanceOf(signer.address)).to.equal(1000);
            expect(await otherToken.balanceOf(vault.address)).to.equal(0);
        });

        it('should revert when amount = 0', async () => {
            await expect(vault.sweep(ZERO_ADDRESS, 0))
              .to.be.revertedWith('amount must not be 0');
        });

        it('should revert when trying to sweep a token protected by the vault', async () => {
            await expect(vault.sweep(token.address, 1000))
              .to.be.revertedWith('token must not be protected');
        });

        it('should revert when the balance is less than the amount', async () => {
            const otherToken = await deployErc20Token(user1, defaultErc20Options);
            await otherToken.transfer(vault.address, 1000);
            expect(await otherToken.balanceOf(vault.address)).to.equal(1000);

            await expect(vault.sweep(otherToken.address, 2000))
              .to.be.revertedWith('amount must not exceed balance');
        });
    });

    describe('#setStrategyTolerances', () => {
        it('should set the strategy tolerances', async () => {
            const oldTolerances = await vault.strategyTolerances();
            const newTolerances: StrategyTolerancesStruct = {
                ...oldTolerances,
                slippage: oldTolerances.slippage.add(1),
            };

            await vault.setStrategyTolerances(newTolerances);

            expect((await vault.strategyTolerances()).slippage).to.equal(newTolerances.slippage);
        });

        it('should revert when the tolerances are out of bounds', async () => {
            await expect(vault.setStrategyTolerances({ slippage: scaledBps(10001), redemptionFee: 0 }))
              .to.be.revertedWith('slippage out of bounds');
            await expect(vault.setStrategyTolerances({ slippage: 0, redemptionFee: scaledBps(10001) }))
              .to.be.revertedWith('redemptionFee out of bounds');
        });
    });

    describe('#setRewardCollector', () => {
        it('should set the reward collector to the given address', async () => {
            expect(await vault.collector()).to.equal(ZERO_ADDRESS);
            await vault.setCollector(user1.address);
            expect(await vault.collector()).to.equal(user1.address);
        });

        it('should revert when the supplied reward collector is the zero address', async () => {
            await expect(vault.setCollector(ZERO_ADDRESS))
              .to.be.revertedWith('collector addr must not be 0');
        });
    });

    describe('#emergencyPause', () => {
        it('should pause the vault', async () => {
            await vault.emergencyPause();
            expect(await vault.paused()).to.be.true;
        });

        it('should revert when trying to pause the already paused vault', async () => {
            await vault.emergencyPause();
            await expect(vault.emergencyPause()).to.be.revertedWith('paused');
        });

        it('should prevent calling vault operations while paused', async () => {
            await vault.emergencyPause();
            await expect(vault.connect(user1).voluntaryExit(user1.address, 1)).to.be.revertedWith('paused');
        });

        it('should unpause after the pause duration', async () => {
            await vault.emergencyPause();

            const pauseDuration = await vault.pauseDuration();
            await ethers.provider.send('evm_increaseTime', [pauseDuration.add(1).toNumber()]);

            await expect(vault.connect(user1).voluntaryExit(ZERO_ADDRESS, 1))
                .to.be.revertedWith('withdrawTo addr must not be 0');
        });
    });

    describe('#emergencyUnpause', async () => {
        beforeEach(async () => {
            await vault.emergencyPause();
        });

        it('should unpause the vault', async () => {
            await vault.emergencyUnpause();
            expect(await vault.paused()).to.be.false;
        });

        it('should revert when trying to unpause the already unpaused vault', async () => {
            await vault.emergencyUnpause();
            await expect(vault.emergencyUnpause()).to.be.revertedWith('not temporarily paused');
        });

        it('should allow calling vault operations after the vault is unpaused', async () => {
            await expect(vault.connect(user1).voluntaryExit(ZERO_ADDRESS, 1)).to.be.revertedWith('paused');
            await vault.emergencyUnpause();
            await expect(vault.connect(user1).voluntaryExit(ZERO_ADDRESS, 1))
                .to.be.revertedWith('withdrawTo addr must not be 0');
        });
    });

    describe('#transferOwnership', async () => {
       it('should revert when transferring ownership to the zero address', async () => {
           await expect(vault.transferOwnership(ZERO_ADDRESS)).to.be.revertedWith('owner addr must not be 0');
       });
    });
});
