import { ethers } from 'hardhat';
import { BigNumberish, ContractTransaction, Signer } from 'ethers';
import moment from 'moment';
import { IGeltVault } from '../../types';
import { EIP712, EIP712Domain, EIP712Type, ECDSASignature } from './eip712';
import { MintWithAuthorization, RedeemWithAuthorization } from './eip712/eip712-types';

type GetTypeFunction<T extends EIP712Type> = (validAfter: number, validBefore: number, nonce: string) => T;

type SendTransactionFunction = (
    validAfter: number,
    validBefore: number,
    nonce: string,
    sig: ECDSASignature
) => Promise<ContractTransaction>;

async function newMetaTransaction<T extends EIP712Type>(
    signer: Signer,
    sender: string,
    domain: EIP712Domain,
    getType: GetTypeFunction<T>,
    sendTransaction: SendTransactionFunction,
): Promise<ContractTransaction> {
    const validAfter = 0;
    const validBefore = moment().add(1, 'day').unix();
    const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32));

    const type = getType(validAfter, validBefore, nonce);

    const eip712 = new EIP712(domain, type);

    const signature = await eip712.sign(ethers.provider, sender); // await signer.getAddress());

    return sendTransaction(validAfter, validBefore, nonce, signature);
}

export function mintWithAuthorization(
    args: { signer: Signer, vault: IGeltVault, domain: EIP712Domain, minter: string, mintAmount: BigNumberish }
) {
    const { signer, vault, domain, minter } = args;
    const mintAmount = args.mintAmount.toString();

    return newMetaTransaction<MintWithAuthorization>(
        signer,
        minter,
        domain,
        (validAfter, validBefore, nonce) =>
            (new MintWithAuthorization(minter, mintAmount, validAfter, validBefore, nonce)),
        (validAfter, validBefore, nonce, sig) =>
            (vault.mintWithAuthorization(minter, mintAmount, validAfter, validBefore, nonce, sig.v, sig.r, sig.s))
    );
}

export function redeemWithAuthorization(
    args: { signer: Signer, vault: IGeltVault, domain: EIP712Domain, redeemer: string, withdrawTo: string, redeemTokens: BigNumberish }
) {
    const { signer, vault, domain, redeemer, withdrawTo } = args;
    const redeemTokens = args.redeemTokens.toString();

    return newMetaTransaction<RedeemWithAuthorization>(
        signer,
        redeemer,
        domain,
        (validAfter, validBefore, nonce) =>
            (new RedeemWithAuthorization(redeemer, withdrawTo, redeemTokens, validAfter, validBefore, nonce)),
        (validAfter, validBefore, nonce, sig) =>
            (vault.connect(signer).redeemWithAuthorization(redeemer, withdrawTo, redeemTokens, validAfter, validBefore, nonce, sig.v, sig.r, sig.s))
    );
}
