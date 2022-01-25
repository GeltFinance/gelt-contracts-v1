export class ECDSASignature {
    public readonly v: string;
    public readonly r: string;
    public readonly s: string;

    public static parse(sig: string) {
        const v = '0x' + sig.slice(130, 132);
        const r = sig.slice(0, 66);
        const s = '0x' + sig.slice(66, 130);

        return new ECDSASignature(v, r, s);
    }

    private constructor(v: string, r: string, s: string) {
        this.v = v;
        this.r = r;
        this.s = s;
    }
}
