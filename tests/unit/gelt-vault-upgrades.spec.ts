import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
    ERC20,
    MstableGeltVaultV2,
    MstableGeltVaultV2__factory, MstableGeltVaultV2Incompatible__factory
} from '../../types';
import {
    defaultErc20Options,
    deployErc20Token,
    deployProxiedMstableVault,
    upgradeProxiedContract,
} from '../utils/fixtures';
import { hardhatDisableFork } from '../utils/network';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('[Unit] Gelt Vault: Upgrades', () => {
    let signer: SignerWithAddress; // Default signer unless otherwise specified.
    let user1: SignerWithAddress;
    let bAsset: ERC20;

    before(async () => {
        [signer, user1] = await ethers.getSigners();

        // Disable network forking for unit tests.
        await hardhatDisableFork();
    });

    beforeEach(async () => {
         bAsset = await deployErc20Token(signer, defaultErc20Options);
    });

    it('should deploy the vault via a proxy', async () => {
        const vault = await deployProxiedMstableVault(signer, { bAsset: bAsset.address, useMockStrategy: false });
        expect(await vault.bAsset()).to.equal(bAsset.address);
    });

    it('should update an already deployed vault', async () => {
        const vaultV1 = await deployProxiedMstableVault(signer, { bAsset: bAsset.address, useMockStrategy: false });

        const factoryV2 = new MstableGeltVaultV2__factory(signer);
        const vaultV2 = await upgradeProxiedContract<MstableGeltVaultV2>(factoryV2, vaultV1.address, 'migrateV2', [10]);
        expect(await vaultV2.bAsset()).to.equal(bAsset.address);
        expect(await vaultV2.newData()).to.equal(10);
        expect(await vaultV2.newFunction()).to.equal(20);
    });

    it('should fail to migrate an already migrated vault', async () => {
        const vaultV1 = await deployProxiedMstableVault(signer, { bAsset: bAsset.address, useMockStrategy: false });

        const factoryV2 = new MstableGeltVaultV2__factory(signer);
        const vaultV2 = await upgradeProxiedContract<MstableGeltVaultV2>(factoryV2, vaultV1.address, 'migrateV2', [10]);

        await expect(vaultV2.migrateV2(10)).to.be.revertedWith('contract already migrated');
    });

    it('should fail to upgrade when storage is incompatible', async () => {
        const vaultV1 = await deployProxiedMstableVault(signer, { bAsset: bAsset.address, useMockStrategy: false });

        const factoryV2 = new MstableGeltVaultV2Incompatible__factory(signer);
        await expect(upgradeProxiedContract<MstableGeltVaultV2>(factoryV2, vaultV1.address, 'migrateV2', [10]))
            .to.be.rejectedWith('New storage layout is incompatible');
    });
});
