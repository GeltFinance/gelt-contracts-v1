import { ethers } from 'hardhat';
import { BigNumber, BigNumberish } from 'ethers';

export function hardhatEnableFork(jsonRpcUrl: string, blockNumber: number): Promise<unknown> {
    return ethers.provider.send(
        'hardhat_reset',
        [{
            forking: {
                jsonRpcUrl,
                blockNumber,
            },
        }]
    );
}

export function hardhatDisableFork(): Promise<unknown> {
    return ethers.provider.send('hardhat_reset', []);
}

export function hardhatImpersonateAccount(account: string): Promise<unknown> {
    return ethers.provider.send('hardhat_impersonateAccount', [account]);
}

export function hardhatSetBalance(account: string, balance: BigNumberish): Promise<unknown> {
    return ethers.provider.send('hardhat_setBalance', [
        account,
        ethers.utils.hexStripZeros(BigNumber.from(balance).toHexString())
    ]);
}

export async function hardhatMineBlocks(blockCount: number): Promise<void> {
    while (blockCount > 0) {
        blockCount--;
        await ethers.provider.send('evm_mine', []);
    }
}
