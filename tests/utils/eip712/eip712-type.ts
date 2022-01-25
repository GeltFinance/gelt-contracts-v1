type AnyObject = { [key: string]: any };

export abstract class EIP712Type {
    protected readonly fields: Map<FieldType, any>;

    constructor(fields: [FieldType, any][]) {
        this.fields = new Map(fields);
    }

    public getValues(): AnyObject {
        return Array.from(this.fields.entries())
            .reduce((acc, curr) => {
                const [key, value] = curr;
                acc[key.name] = value;
                return acc;
            }, {} as AnyObject);
    }

    public getType(): FieldType[] {
        return Array.from(this.fields.keys());
    }
}