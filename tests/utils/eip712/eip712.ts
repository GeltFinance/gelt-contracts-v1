import { providers } from 'ethers';
import { EIP712Type } from './eip712-type';
import { ECDSASignature } from './ecdsa-signature';

export class EIP712Domain extends EIP712Type {
    constructor(name: string, version: number, chainId: number, verifyingContract: string) {
        super([
            [{ name: 'name', type: 'string' }, name],
            [{ name: 'version', type: 'string' }, version.toString()],
            [{ name: 'chainId', type: 'uint256' }, chainId.toString()],
            [{ name: 'verifyingContract', type: 'address' }, verifyingContract],
        ])
    }
}

export class EIP712 {
    private readonly domain: EIP712Domain;
    private primaryType: EIP712Type;

    constructor(domain: EIP712Domain, primaryType: EIP712Type) {
        this.domain = domain;
        this.primaryType = primaryType;
    }

    public async sign(provider: providers.JsonRpcProvider, address: string): Promise<ECDSASignature> {
        //console.log(this.toTypedData());

        const sig = await provider.send(
            'eth_signTypedData_v4',
            [address, JSON.stringify(this.toTypedData())]
        );

        return ECDSASignature.parse(sig);
    }

    public toTypedData(): any {
        return {
            types: {
                [this.domain.constructor.name]: this.domain.getType(),
                [this.primaryType.constructor.name]: this.primaryType.getType()
            },
            domain: this.domain.getValues(),
            primaryType: this.primaryType.constructor.name,
            message: this.primaryType.getValues()
        }
    }

}
