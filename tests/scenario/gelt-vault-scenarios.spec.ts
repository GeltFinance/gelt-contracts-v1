import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, MstableGeltVaultHarness } from '../../types';
import { EIP712Domain } from '../utils/eip712';
import { defaultErc20Options, deployDefaultVault } from '../utils/fixtures';
import { mintWithAuthorization, redeemWithAuthorization } from '../utils/meta-transactions';
import { Amount, simulateStrategyOverTime } from '../utils/amount';
import { hardhatDisableFork } from '../utils/network';

describe('[Scenario] Gelt Vault', () => {
    const APY = 0.1;
    const DAILY_YIELD = APY / 365.25;

    const stablecoinAmount = new Amount(6);
    const gtokenAmount = new Amount(18);

    let signer: SignerWithAddress; // Default signer unless otherwise specified.
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let user3: SignerWithAddress;
    let token: ERC20;
    let vault: MstableGeltVaultHarness;
    let domain: EIP712Domain;

    before(async () => {
        [signer, user1, user2, user3] = await ethers.getSigners();

        await hardhatDisableFork();
    });

    beforeEach(async () => {
        const erc20Options = { ...defaultErc20Options, decimals: stablecoinAmount.decimals };
        ({ token, vault, domain } = await deployDefaultVault(signer, erc20Options));
    });

    it('3 party deposit', async () => {
        // Scenario:
        //    user 1 deposits $100 at d_0
        // -> execute strategy once a day
        // -> user 2 deposits $100 at d_50
        // -> execute strategy once a day
        // -> user 3 deposits $100 at d_51

        // Setup
        const mintAmount = stablecoinAmount.getExact(100);
        await token.transfer(user1.address, mintAmount);
        await token.transfer(user2.address, mintAmount);
        await token.transfer(user3.address, mintAmount);

        // Day 0
        await token.connect(user1).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user1.address, mintAmount });
        expect(await vault.balanceOf(user1.address)).to.equal(gtokenAmount.getExact(10000));

        // Accumulate yield over 50 days (day 0 - day 49).
        await vault.harnessExecuteStrategyNetDeposit(
            mintAmount,
            simulateStrategyOverTime(50, DAILY_YIELD, (await vault.strategyValue()).add(mintAmount))
        );

        expect(await vault.strategyValue()).to.equal(101378122);

        // Day 50
        await token.connect(user2).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user2.address, mintAmount });
        // console.log(await vault.balanceOf(user2.address));
        expect(gtokenAmount.isApproximatelyEqual(await vault.balanceOf(user2.address), gtokenAmount.getExact(9864))).to.be.true;

        await vault.harnessExecuteStrategyNetDeposit(
            mintAmount,
            simulateStrategyOverTime(1, DAILY_YIELD, (await vault.strategyValue()).add(mintAmount))
        );

        expect(await vault.strategyValue()).to.equal(201433255);

        // Day 51
        await token.connect(user3).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user3.address, mintAmount });
        expect(gtokenAmount.isApproximatelyEqual(await vault.balanceOf(user3.address), gtokenAmount.getExact(9861))).to.be.true;
    });

    it('3 party deposits with partial withdrawal', async () => {
        // Scenario:
        //    user 1 deposits $100 at d_0
        // -> execute strategy once a day
        // -> user 2 deposits $100 at d_50
        // -> execute strategy once a day
        // -> user 1 withdraws $50 at d_60
        // -> execute strategy once a day
        // -> user 3 deposits $100 at d_70

        // Setup
        const mintAmount = stablecoinAmount.getExact(100);
        await token.transfer(user1.address, mintAmount);
        await token.transfer(user2.address, mintAmount);
        await token.transfer(user3.address, mintAmount);

        // Day 0
        await token.connect(user1).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user1.address, mintAmount });
        expect(await token.balanceOf(vault.address)).to.equal(mintAmount);
        expect(await vault.balanceOf(user1.address)).to.equal(gtokenAmount.getExact(10000));

        // Accumulate yield over 50 days (day 0 - day 49).
        await vault.harnessExecuteStrategyNetDeposit(
            mintAmount,
            simulateStrategyOverTime(50, DAILY_YIELD, (await vault.strategyValue()).add(mintAmount))
        );

        // Day 50
        await token.connect(user2).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user2.address, mintAmount });
        expect(await token.balanceOf(vault.address)).to.equal(mintAmount);
        expect(gtokenAmount.isApproximatelyEqual(await vault.balanceOf(user2.address), gtokenAmount.getExact(9864))).to.be.true;

        // Accumulate yield over 10 days (day 50 - day 59).
        await vault.harnessExecuteStrategyNetDeposit(
            mintAmount,
            simulateStrategyOverTime(10, DAILY_YIELD, (await vault.strategyValue()).add(mintAmount))
        );

        expect(await vault.strategyValue()).to.equal(201930134);

        // Day 60
        const redeemAmount = stablecoinAmount.getExact(50);
        await token.approve(vault.address, redeemAmount);
        await vault.harnessExecuteStrategyNetWithdraw(
            redeemAmount,
            simulateStrategyOverTime(1, DAILY_YIELD, await vault.strategyValue()).sub(redeemAmount)
        );

        expect(await vault.strategyValue()).to.equal(151985418);
        expect(await token.balanceOf(vault.address)).to.equal(redeemAmount);
        expect(await token.balanceOf(user1.address)).to.equal(0);

        let redeemTokens = await vault.harnessCalcMintTokens(redeemAmount); // USDC amount to gUSD amount.
        redeemTokens = redeemTokens.add(1); // Add 1 to compensate for rounding errors.
        expect(gtokenAmount.isApproximatelyEqual(redeemTokens, gtokenAmount.getExact(4917)));
        await redeemWithAuthorization({ signer, vault, domain, redeemer: user1.address, redeemTokens, withdrawTo: user1.address });

        expect(await token.balanceOf(user1.address)).to.equal(redeemAmount);

        // Accumulate yield over 10 days (day 61 - day 59).
        await vault.harnessExecuteStrategyNetDeposit(
            0,
            simulateStrategyOverTime(9, DAILY_YIELD, await vault.strategyValue())
        );

        // Day 70
        await token.connect(user3).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user3.address, mintAmount });
        expect(gtokenAmount.isApproximatelyEqual(await vault.balanceOf(user3.address), gtokenAmount.getExact(9810))).to.be.true;
    });

    it('3 party deposit partial withdrawal and redeposit', async () => {
        // Scenario:
        //    user 1 deposits $100 at d_0
        // -> execute strategy once a day
        // -> user 2 deposits $100 at d_50
        // -> execute strategy once a day
        // -> user 1 withdraws $50 at d_60
        // -> execute strategy once a day
        // -> user 3 deposits $100 at d_70
        // -> user 1 deposits $100 at d_70 too

        // Setup
        const mintAmount = stablecoinAmount.getExact(100);
        await token.transfer(user1.address, mintAmount);
        await token.transfer(user2.address, mintAmount);
        await token.transfer(user3.address, mintAmount);

        // Day 0
        await token.connect(user1).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user1.address, mintAmount });
        expect(await token.balanceOf(vault.address)).to.equal(mintAmount);
        expect(await vault.balanceOf(user1.address)).to.equal(gtokenAmount.getExact(10000));

        // Accumulate yield over 50 days (day 0 - day 49).
        await vault.harnessExecuteStrategyNetDeposit(
            mintAmount,
            simulateStrategyOverTime(50, DAILY_YIELD, (await vault.strategyValue()).add(mintAmount))
        );

        // Day 50
        await token.connect(user2).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user2.address, mintAmount });
        expect(await token.balanceOf(vault.address)).to.equal(mintAmount);
        expect(gtokenAmount.isApproximatelyEqual(await vault.balanceOf(user2.address), gtokenAmount.getExact(9864))).to.be.true;

        // Accumulate yield over 10 days (day 50 - day 59).
        await vault.harnessExecuteStrategyNetDeposit(
            mintAmount,
            simulateStrategyOverTime(10, DAILY_YIELD, (await vault.strategyValue()).add(mintAmount))
        );

        expect(await vault.strategyValue()).to.equal(201930134);

        // Day 60
        const redeemAmount = stablecoinAmount.getExact(50);
        await token.approve(vault.address, redeemAmount);
        await vault.harnessExecuteStrategyNetWithdraw(
            redeemAmount,
            simulateStrategyOverTime(1, DAILY_YIELD, await vault.strategyValue()).sub(redeemAmount)
        );

        expect(await vault.strategyValue()).to.equal(151985418);
        expect(await token.balanceOf(vault.address)).to.equal(redeemAmount);
        expect(await token.balanceOf(user1.address)).to.equal(0);

        let redeemTokens = await vault.harnessCalcMintTokens(redeemAmount); // USDC amount to gUSD amount.
        redeemTokens = redeemTokens.add(1); // Add 1 to compensate for rounding errors.
        expect(gtokenAmount.isApproximatelyEqual(redeemTokens, gtokenAmount.getExact(4917)));
        await redeemWithAuthorization({ signer, vault, domain, redeemer: user1.address, redeemTokens, withdrawTo: user1.address });

        expect(await token.balanceOf(user1.address)).to.equal(redeemAmount);

        // Accumulate yield over 10 days (day 61 - day 59).
        await vault.harnessExecuteStrategyNetDeposit(
            0,
            simulateStrategyOverTime(9, DAILY_YIELD, await vault.strategyValue())
        );

        // Day 70
        await token.connect(user3).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user3.address, mintAmount });
        expect(gtokenAmount.isApproximatelyEqual(await vault.balanceOf(user3.address), gtokenAmount.getExact(9810))).to.be.true;

        expect(gtokenAmount.isApproximatelyEqual(await vault.balanceOf(user1.address), gtokenAmount.getExact(5083)));
        await token.transfer(user1.address, mintAmount);
        await token.connect(user1).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user1.address, mintAmount });
        expect(gtokenAmount.isApproximatelyEqual(await vault.balanceOf(user1.address), gtokenAmount.getExact(14893)));
    });

    it('3 party deposit partial withdrawal and concomitant deposit', async () => {
        // Scenario:
        //    user 1 deposits $100 at d_0
        // -> execute strategy once a day
        // -> user 2 deposits $100 at d_50
        // -> execute strategy once a day
        // -> user 1 withdraws $50 at d_60
        // -> user 3 deposits $100 at d_60 too

        // Setup
        const mintAmount = stablecoinAmount.getExact(100);
        await token.transfer(user1.address, mintAmount);
        await token.transfer(user2.address, mintAmount);
        await token.transfer(user3.address, mintAmount);

        // Day 0
        await token.connect(user1).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user1.address, mintAmount });
        expect(await token.balanceOf(vault.address)).to.equal(mintAmount);
        expect(await vault.balanceOf(user1.address)).to.equal(gtokenAmount.getExact(10000));

        // Accumulate yield over 50 days (day 0 - day 49).
        await vault.harnessExecuteStrategyNetDeposit(
            mintAmount,
            simulateStrategyOverTime(50, DAILY_YIELD, (await vault.strategyValue()).add(mintAmount))
        );

        // Day 50
        await token.connect(user2).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user2.address, mintAmount });
        expect(await token.balanceOf(vault.address)).to.equal(mintAmount);
        expect(gtokenAmount.isApproximatelyEqual(await vault.balanceOf(user2.address), gtokenAmount.getExact(9864))).to.be.true;

        // Accumulate yield over 10 days (day 50 - day 59).
        await vault.harnessExecuteStrategyNetDeposit(
            mintAmount,
            simulateStrategyOverTime(10, DAILY_YIELD, (await vault.strategyValue()).add(mintAmount))
        );

        expect(await vault.strategyValue()).to.equal(201930134);

        // Day 60
        await token.connect(user3).approve(vault.address, mintAmount);
        await mintWithAuthorization({ signer, vault, domain, minter: user3.address, mintAmount });
        expect(await token.balanceOf(vault.address)).to.equal(mintAmount);
        expect(gtokenAmount.isApproximatelyEqual(await vault.balanceOf(user3.address), gtokenAmount.getExact(9837))).to.be.true;

        // We need to net: mint 100 + redeem 50 = mint 50
        const redeemAmount = stablecoinAmount.getExact(50);
        const netAmount = mintAmount.sub(redeemAmount);
        await token.approve(vault.address, redeemAmount);
        await vault.harnessExecuteStrategyNetDeposit(
            netAmount,
            simulateStrategyOverTime(1, DAILY_YIELD, await vault.strategyValue()).add(netAmount)
        );

        expect(await vault.strategyValue()).to.equal(251985418);
        expect(await token.balanceOf(vault.address)).to.equal(netAmount);
        expect(await token.balanceOf(user1.address)).to.equal(0);

        let redeemTokens = await vault.harnessCalcMintTokens(redeemAmount); // USDC amount to gUSD amount.
        redeemTokens = redeemTokens.add(1); // Add 1 to compensate for rounding errors.
        expect(gtokenAmount.isApproximatelyEqual(redeemTokens, gtokenAmount.getExact(4917)));
        await redeemWithAuthorization({ signer, vault, domain, redeemer: user1.address, redeemTokens, withdrawTo: user1.address });

        expect(await token.balanceOf(user1.address)).to.equal(redeemAmount);
    });
});
