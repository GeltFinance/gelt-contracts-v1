import { expect } from 'chai';
import { MockVault } from './mocks/mock-vault';

describe('[Unit] Mock Vault', () => {
    let vault: MockVault;

    beforeEach(() => {
        vault = new MockVault();
    })

    describe('#mint', () => {
        it('should mint tokens 1:1 when totalSupply == 0', () => {
            expect(vault.mint(100)).to.equal(100);
        });

        it('should mint the correct amount when totalSupply > 0', () => {
            vault.mint(100);
            expect(vault.mint(300)).to.equal(300);
        });

        it('should mint the correct amount after strategy generates yield', () => {
            vault.mint(100);
            vault.executeStrategy(100);
            vault.addStrategyYield(10);
            expect(vault.totalAssets()).to.equal(110);
            expect(vault.mint(100)).to.be.approximately(90.90, 0.01);
        });
    });

    describe('#withdraw', () => {
        it('should withdraw the correct amount after initial mint', () => {
            const vault = new MockVault();
            vault.mint(100);
            expect(vault.redeem(100)).to.equal(100);
        });

        it('should withdraw the correct amount multiple mints', () => {
            const vault = new MockVault();
            vault.mint(100);
            vault.mint(100);
            expect(vault.redeem(100)).to.equal(100);
            expect(vault.redeem(100)).to.equal(100);
        });

        it('should fail to withdraw when there are no tokens minted', () => {
            const vault = new MockVault();
            expect(() => { vault.redeem(100); }).to.throw('token supply');
        });

        it('should fail to withdraw when trying to withdraw more tokens than minted', () => {
            const vault = new MockVault();
            vault.mint(50);
            expect(() => { vault.redeem(100); }).to.throw('token supply');
        });
    });
});
