import { EIP712Type } from '../eip712-type';

export class RedeemWithAuthorization extends EIP712Type {
    constructor(redeemer: string, withdrawTo: string, redeemTokens: string, validAfter: number, validBefore: number, nonce: string) {
        super([
            [{ name: 'redeemer', type: 'address' }, redeemer],
            [{ name: 'withdrawTo', type: 'address' }, withdrawTo],
            [{ name: 'redeemTokens', type: 'uint256' }, redeemTokens],
            [{ name: 'validAfter', type: 'uint256' }, validAfter],
            [{ name: 'validBefore', type: 'uint256' }, validBefore],
            [{ name: 'nonce', type: 'bytes32' }, nonce]
        ])
    }
}
