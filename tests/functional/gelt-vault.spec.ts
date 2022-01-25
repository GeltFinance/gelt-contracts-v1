import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, IInterestBearingMasset, IVaultedInterestBearingMasset, MstableGeltVaultHarness } from '../../types';
import { EIP712Domain } from '../utils/eip712';
import { Amount } from '../utils/amount';
import { mintWithAuthorization, redeemWithAuthorization } from '../utils/meta-transactions';
import { given, initFunctionalTestContext, scenarioOutline, then, when } from './functional-test-context';

describe('[Functional] Gelt Vault', function () {
    this.timeout(120 * 1000);

    const bAssetAmount = new Amount(6);
    const mAssetAmount = new Amount(18);

    let signer: SignerWithAddress; // Default signer unless otherwise specified.
    let operator: SignerWithAddress;
    let user1: SignerWithAddress;
    let withdraw: SignerWithAddress;
    let vault: MstableGeltVaultHarness;
    let domain: EIP712Domain;
    let bAsset: ERC20;
    let imAsset: IInterestBearingMasset;
    let vimAsset: IVaultedInterestBearingMasset;

    before(async () => {
        [signer, operator, user1, withdraw] = await ethers.getSigners();
    });

    async function setup() {
        // Reset fork before each test case.
        ({ vault, domain, bAsset, imAsset, vimAsset } = await initFunctionalTestContext([signer, user1]));
        await vault.grantRole(await vault.OPERATOR_ROLE(), operator.address);
        vault = vault.connect(operator);
    }

    /*
     * Scenario Outline: A user deposits funds to the vault
     *   Given the user has ${amount} USDC
     *   And the user approves the Vault to access ${amount} USDC
     *   When the operator mints supplying ${amount} USDC with the user's signed authorisation
     *   Then the user should receive ${token} gUSDC
     *   When the operator deposits ${amount} USDC to the strategy
     *   Then the total value of the strategy is approximately ${strategyValue} USDC
     *
     *   Examples:
     *     | amount | token   | strategyValue
     *     | 1000   | 100000  | 999.4
     *     | 10000  | 1000000 | 9994
     */
    scenarioOutline('A user deposits funds to the Vault', setup, [{
        amount: bAssetAmount.getExact(1000),
        token: mAssetAmount.getExact(100_000),
        strategyValue: bAssetAmount.getExact(9994).div(10)
    }, {
        amount: bAssetAmount.getExact(10_000),
        token: mAssetAmount.getExact(1_000_000),
        strategyValue: bAssetAmount.getExact(9994)
    }], async ({ amount, token, strategyValue }) => {
        given(`the user has ${amount} USDC`, async () => {
            await bAsset.transfer(user1.address, amount);
        });

        given(`the user approves the Vault to access ${amount} USDC`, async () => {
            await bAsset.connect(user1).approve(vault.address, amount);
        });

        when(`the operator mints ${amount} USDC with the user's signed authorisation`, async () => {
            await mintWithAuthorization({ signer, domain, vault, minter: user1.address, mintAmount: amount });
        });

        then(`the user should receive ${token} gUSDC`, async () => {
            expect(await vault.balanceOf(user1.address)).to.equal(token);
        });

        when(`the operator deposits ${amount} USDC to the strategy`, async () => {
            await vault.executeStrategyNetDeposit(amount);
        });

        then(`the total value of the strategy is approximately ${strategyValue} USDC`, async () => {
            expect(bAssetAmount.isApproximatelyEqual(await vault.harnessGetStrategyValue(), strategyValue)).to.be.true;
        });
    });

    /*
     * Scenario Outline: A user redeems from the Vault
     *   Given the user minted by depositing ${mintAmount} USDC to the Vault
     *   And ${interest} mUSD total interest has been accumulated by the strategy
     *   When the operator withdraws ${redeemAmount} USDC from the strategy
     *   And the operator redeems ${redeemAmount} USDC worth of gUSDC with the user's signed authorisation
     *   Then the user should receive ${redeemAmount} USDC
     *
     *   Examples:
     *     | mintAmount | interest | redeemAmount
     *     | 1000       | 20000    | 1001
     *     | 10000      | 20000    | 10002
     */
    scenarioOutline('A user redeems from the Vault', setup, [{
        mintAmount: bAssetAmount.getExact(1000),
        interest: mAssetAmount.getExact(20_000),
        redeemAmount: bAssetAmount.getExact(1001)
    }, {
        mintAmount: bAssetAmount.getExact(10_000),
        interest: mAssetAmount.getExact(20_000),
        redeemAmount: bAssetAmount.getExact(10002)
    }], async ({ mintAmount, interest, redeemAmount }) => {
        given(`the user minted by depositing ${mintAmount} USDC to the Vault`, async () => {
            await bAsset.transfer(user1.address, mintAmount);
            await bAsset.connect(user1).approve(vault.address, mintAmount);
            await mintWithAuthorization({ signer, domain, vault, minter: user1.address, mintAmount });
            await vault.executeStrategyNetDeposit(mintAmount);
        });

        given(`${interest} mUSD total interest has been accumulated by the strategy`, async () => {
            await imAsset.depositInterest(interest);
        });

        when(`the operator withdraws ${redeemAmount} USDC from the strategy`, async () => {
            await vault.executeStrategyNetWithdraw(redeemAmount);
        });

        when(`the operator redeems ${redeemAmount} USDC worth of gUSDC with the user's signed authorisation`, async () => {
            const redeemTokens = (await vault.harnessCalcMintTokens(redeemAmount)).add(1);
            await redeemWithAuthorization({ signer, domain, vault, redeemer: user1.address, redeemTokens, withdrawTo: withdraw.address });
        });

        then(`the user should receive ${redeemAmount} USDC`, async () => {
            expect(await bAsset.balanceOf(withdraw.address)).to.equal(redeemAmount);
        });
    });

    /*
     * Scenario Outline: User voluntarily exits the Vault
     *   Given the user minted by depositing ${mintAmount} USDC to the Vault
     *   When the user voluntarily exists the Vault
     *   Then the user should receive approximately ${redeemAmount} USDC
     *
     *   Examples:
     *     | mintAmount | redeemAmount
     *     | 1000       | 999
     *     | 10000      | 9988
     */
    scenarioOutline('User voluntarily exits the Vault', setup, [{
        mintAmount: bAssetAmount.getExact(1000),
        redeemAmount: bAssetAmount.getExact(999)
    }, {
        mintAmount: bAssetAmount.getExact(10_000),
        redeemAmount: bAssetAmount.getExact(9_988)
    }], ({ mintAmount, redeemAmount }) => {
        given(`the user minted by depositing ${mintAmount} USDC to the Vault`, async () => {
            await bAsset.transfer(user1.address, mintAmount);
            await bAsset.connect(user1).approve(vault.address, mintAmount);
            await mintWithAuthorization({ signer, domain, vault, minter: user1.address, mintAmount });
            await vault.executeStrategyNetDeposit(mintAmount);
        });

        when(`the user voluntarily exits the Vault`, async () => {
            await vault.connect(user1).voluntaryExit(withdraw.address, 1);
        });

        then(`the user should receive approximately ${redeemAmount} USDC`, async () => {
            expect(bAssetAmount.isApproximatelyEqual(await bAsset.balanceOf(withdraw.address), redeemAmount)).to.be.true;
        });
    });
});
