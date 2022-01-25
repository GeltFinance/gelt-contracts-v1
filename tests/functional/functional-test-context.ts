import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
    ERC20,
    ERC20__factory,
    IInterestBearingMasset,
    IInterestBearingMasset__factory,
    IVaultedInterestBearingMasset,
    IVaultedInterestBearingMasset__factory,
    MstableGeltVaultHarness
} from '../../types';
import { EIP712Domain } from '../utils/eip712';
import { Amount } from '../utils/amount';
import { deployMstableGeltVault } from '../utils/fixtures';
import { hardhatEnableFork, hardhatImpersonateAccount, hardhatSetBalance } from '../utils/network';

const addresses = {
    bAsset: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
    mAsset: '0xE840B73E5287865EEc17d250bFb1536704B43B21',
    imAsset: '0x5290Ad3d83476CA6A2b178Cd9727eE1EF72432af',
    vimAsset: '0x32aBa856Dc5fFd5A56Bcd182b13380e5C855aa29',
    saveWrapper: '0x299081f52738A4204C3D58264ff44f6F333C6c88',
    savingsManager: '0x10bFcCae079f31c451033798a4Fd9D2c33Ea5487',
    bAssetUser: '0x986a2fCa9eDa0e06fBf7839B89BfC006eE2a23Dd' // USDC whale
};

export interface IntegrationTestContext {
    vault: MstableGeltVaultHarness;
    domain: EIP712Domain;
    bAsset: ERC20;
    imAsset: IInterestBearingMasset;
    vimAsset: IVaultedInterestBearingMasset;
    savingsManager: SignerWithAddress;
    platformToken: ERC20;
    rewardToken: ERC20;
}

export async function initFunctionalTestContext(signers: SignerWithAddress[]): Promise<IntegrationTestContext> {
    const [signer] = signers;

    // Reset fork.
    await hardhatEnableFork(`https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ACCESS_TOKEN}`, 20_000_000);

    await hardhatImpersonateAccount(addresses.bAssetUser);
    await hardhatImpersonateAccount(addresses.savingsManager);
    await hardhatSetBalance(addresses.savingsManager, ethers.utils.parseEther('100.0'));
    const savingsManager = await ethers.getSigner(addresses.savingsManager);

    const bAsset = ERC20__factory.connect(addresses.bAsset, await ethers.getSigner(addresses.bAssetUser));
    const imAsset = IInterestBearingMasset__factory.connect(addresses.imAsset, savingsManager);
    const vimAsset = IVaultedInterestBearingMasset__factory.connect(addresses.vimAsset, signer);
    const platformToken = ERC20__factory.connect(await vimAsset.getPlatformToken(), signer);
    const rewardToken = ERC20__factory.connect(await vimAsset.getRewardToken(), signer);

    const vault = await deployMstableGeltVault(signer, {
        ...addresses,
        name: 'Gelt USDC Vault',
        symbol: 'gUSDC',
        useMockStrategy: false
    });
    const network = await ethers.provider.getNetwork();
    const domain = new EIP712Domain(await vault.name(), 1, network.chainId, vault.address);

    const bAssetAmount = new Amount(6);
    for (let i = 1; i < signers.length; ++i) {
        await bAsset.transfer(signers[i].address, bAssetAmount.getExact(10_000));
    }

    return { vault, domain, bAsset, imAsset, vimAsset, savingsManager, platformToken, rewardToken };
}

export const scenario = (title: string, setup: () => void, fn: () => void) =>
    describe(`Scenario: ${title}`, () => {
        before(setup);
        fn();
    });

export const scenarioOutline = <T>(title: string, setup: () => void, dataTable: T[], fn: (row: T) => void) =>
    dataTable.forEach((row) => {
        scenario(title, setup, () => fn(row));
    });

export const given = (title: string, fn?: Mocha.Func) => it(`Given ${title}`, fn);
export const when = (title: string, fn?: Mocha.Func) => it(`When ${title}`, fn);
export const then = (title: string, fn?: Mocha.Func) => it(`Then ${title}`, fn);

