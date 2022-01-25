import { EIP712Type } from '../eip712-type';

export class MintWithAuthorization extends EIP712Type {
    constructor(minter: string, mintAmount: string, validAfter: number, validBefore: number, nonce: string) {
        super([
            [{ name: 'minter', type: 'address' }, minter],
            [{ name: 'mintAmount', type: 'uint256' }, mintAmount],
            [{ name: 'validAfter', type: 'uint256' }, validAfter],
            [{ name: 'validBefore', type: 'uint256' }, validBefore],
            [{ name: 'nonce', type: 'bytes32' }, nonce]
        ])
    }
}
