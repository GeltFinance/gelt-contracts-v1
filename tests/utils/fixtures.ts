import { ethers, upgrades } from 'hardhat';
import { BigNumberish, Contract, ContractFactory, Signer } from 'ethers';
import {
    ERC20,
    ERC20Harness__factory,
    MstableGeltVault,
    MstableGeltVault__factory,
    MstableGeltVaultHarness,
    MstableGeltVaultHarness__factory,
} from '../../types';
import { EIP712Domain } from './eip712';
import { UINT256_MAX } from './amount';

interface Erc20Options {
    name?: string;
    symbol?: string;
    initialSupply: BigNumberish;
    decimals: number;
}

interface GeltVaultOptions {
    name?: string;
    symbol?: string;
}

interface MstableGeltVaultOptions extends GeltVaultOptions {
    bAsset: string;
    mAsset?: string;
    imAsset?: string;
    vimAsset?: string;
    saveWrapper?: string;
    useMockStrategy: boolean;
}

export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const defaultErc20Options: Erc20Options = {
    initialSupply: UINT256_MAX,
    decimals: 18
};

export async function deployErc20Token(signer: Signer, options: Erc20Options): Promise<ERC20> {
    const { name, symbol, initialSupply, decimals } = options;

    const factory = new ERC20Harness__factory(signer);

    const token = await factory.deploy(
        name || 'Mock Token',
        symbol || 'TKN',
        initialSupply,
        await signer.getAddress(),
        decimals
    );
    await token.deployed();

    return token;
}

export async function deployMstableGeltVault(signer: Signer, options: MstableGeltVaultOptions): Promise<MstableGeltVaultHarness> {
    const { bAsset, mAsset, imAsset, vimAsset, saveWrapper, name, symbol, useMockStrategy } = options;

    const factory = new MstableGeltVaultHarness__factory(signer);

    const vault = await factory.deploy(
        bAsset,
        mAsset || DEAD_ADDRESS,
        imAsset || DEAD_ADDRESS,
        vimAsset || DEAD_ADDRESS,
        saveWrapper || DEAD_ADDRESS,
        name || 'Mock Gelt Vault',
        symbol || 'gTKN',
        useMockStrategy
    );

    await vault.deployed();

    // Grant roles needed for testing.
    await vault.grantRole(await vault.ADMINISTRATOR_ROLE(), await signer.getAddress());
    await vault.grantRole(await vault.OPERATOR_ROLE(), await signer.getAddress());

    return vault;
}

export async function deployProxiedMstableVault(
    signer: Signer,
    options: MstableGeltVaultOptions
): Promise<MstableGeltVault> {
    const { bAsset, mAsset, imAsset, vimAsset, saveWrapper, name, symbol } = options;

    const factory = new MstableGeltVault__factory(signer);

    const args = [
        bAsset,
        mAsset || DEAD_ADDRESS,
        imAsset || DEAD_ADDRESS,
        vimAsset || DEAD_ADDRESS,
        saveWrapper || DEAD_ADDRESS,
        name || 'Upgradable Mock Gelt Vault',
        symbol || 'gTKN'
    ];

    const proxy = await upgrades.deployProxy(factory, args, {
        initializer: 'initialize',
        kind: 'uups'
    });
    await proxy.deployed();

    return proxy as MstableGeltVault;
}

export async function deployDefaultVault(
    signer: Signer,
    erc20Options: Erc20Options = defaultErc20Options,
    extraVaultOptions?: MstableGeltVaultOptions
): Promise<{ token: ERC20, vault: MstableGeltVaultHarness, domain: EIP712Domain }> {
    const token = await deployErc20Token(signer, erc20Options);
    const credit = await deployErc20Token(signer, erc20Options);

    const vault = await deployMstableGeltVault(signer, {
        bAsset: token.address,
        vimAsset: credit.address,
        useMockStrategy: true,
        ...extraVaultOptions
    });

    const network = await ethers.provider.getNetwork();
    const domain = new EIP712Domain(await vault.name(), 1, network.chainId, vault.address);

    return { token, vault, domain };
}

export async function upgradeProxiedContract<T extends Contract>(
    factory: ContractFactory,
    proxyAddress: string,
    migrateFn: string,
    migrateArgs: unknown[]
): Promise<T> {
    await upgrades.upgradeProxy(proxyAddress, factory, {
        kind: 'uups',
        call: {
            fn: migrateFn,
            args: migrateArgs
        }
    });
    return factory.attach(proxyAddress) as T;
}

