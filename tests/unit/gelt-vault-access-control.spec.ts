import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, MstableGeltVault } from '../../types';
import { EIP712Domain } from '../utils/eip712';
import {
    defaultErc20Options,
    deployErc20Token,
    deployProxiedMstableVault,
    ZERO_ADDRESS
} from '../utils/fixtures';
import { hardhatDisableFork } from '../utils/network';
import { mintWithAuthorization } from '../utils/meta-transactions';

interface Role {
    role: string;
    signer: SignerWithAddress;
    address: string;
}

describe('[Unit] Gelt Vault: Access Control', () => {
    let owner: Role; // Default signer unless otherwise specified.
    let admin: Role;
    let operator: Role;
    let user1: SignerWithAddress;
    let bAsset: ERC20;
    let vault: MstableGeltVault;

    before(async () => {
        // Disable network forking for unit tests.
        await hardhatDisableFork();
    });

    beforeEach(async () => {
        const signers = await ethers.getSigners();
        const [ownerSigner] = signers;

        bAsset = await deployErc20Token(ownerSigner, defaultErc20Options);
        vault = await deployProxiedMstableVault(ownerSigner, { bAsset: bAsset.address, useMockStrategy: false });

        [owner, admin, operator] = [
            await vault.OWNER_ROLE(),
            await vault.ADMINISTRATOR_ROLE(),
            await vault.OPERATOR_ROLE()
        ].map((role, idx) => ({
            role,
            signer: signers[idx],
            address: signers[idx].address
        }));

        user1 = signers[3];
    });

    describe('Role: Owner', () => {
        it('should grant the owner role on deployment to the deployer', async () => {
            expect(await vault.hasRole(owner.role, owner.address)).to.be.true;
        });

        it('should make the owner role the administrator of all the other roles', async () => {
            expect(await vault.getRoleAdmin(admin.role)).to.equal(owner.role);
            expect(await vault.getRoleAdmin(operator.role)).to.equal(owner.role);
        });

        it('should allow owner to grant and revoke roles', async () => {
            const roles = [admin, operator];

            for (let role of roles) {
                expect(await vault.hasRole(role.role, role.address)).to.be.false;
                await vault.grantRole(role.role, role.address);
                expect(await vault.hasRole(role.role, role.address)).to.be.true;
                await vault.revokeRole(role.role, role.address);
                expect(await vault.hasRole(role.role, role.address)).to.be.false;
            }
        });
    });

    describe('Role: Administrator', () => {
        beforeEach(async () => {
            await vault.grantRole(admin.role, admin.address);
            vault = vault.connect(admin.signer);
        });

        it('should allow administrator to trigger emergency operations', async () => {
            await expect(vault.emergencyPause()).to.be.not.reverted;
        });

        it('should allow administrator to configure the vault', async () => {
            await expect(vault.setCollector(admin.address)).to.be.not.reverted;
        });

        it('should disallow administrator to submit meta-transactions', async () => {
            const mintAmount = 100;
            const minter = user1.address;
            const network = await ethers.provider.getNetwork()
            const domain = new EIP712Domain(await vault.name(), 1, network.chainId, vault.address);
            await expect(mintWithAuthorization({ signer: operator.signer, vault, domain, minter, mintAmount }))
                .to.be.revertedWith('missing role');
        });

        it('should disallow administrator to interact with the strategy', async () => {
            await expect(vault.executeStrategyNetDeposit(0)).to.be.revertedWith('missing role');
        });

        it('should disallow administrator to upgrade the vault', async () => {
            await expect(vault.upgradeTo(ZERO_ADDRESS)).to.be.revertedWith('missing role');
        });
    });

    describe('Role: Operator', () => {
        beforeEach(async () => {
            await vault.grantRole(operator.role, operator.address);
            vault = vault.connect(operator.signer);
        });

        it('should allow operator to submit meta-transactions', async () => {
            const mintAmount = 100;
            const minter = user1.address;
            await bAsset.transfer(minter, mintAmount);
            await bAsset.connect(user1).increaseAllowance(vault.address, mintAmount);

            const network = await ethers.provider.getNetwork()
            const domain = new EIP712Domain(await vault.name(), 1, network.chainId, vault.address);
            await expect(mintWithAuthorization({ signer: operator.signer, vault, domain, minter, mintAmount }))
                .to.be.not.reverted;
        });

        it('should disallow operator to trigger emergency operations', async () => {
            await expect(vault.emergencyPause()).to.be.revertedWith('missing role');
        });

        it('should disallow operator to configure the vault', async () => {
            await expect(vault.setStrategyTolerances({ slippageBps: 0, redemptionFeeBps: 0 }))
                .to.be.revertedWith('missing role');
        });

        it('should disallow operator to upgrade the vault', async () => {
            await expect(vault.upgradeTo(ZERO_ADDRESS)).to.be.revertedWith('missing role');
        });
    });
});
