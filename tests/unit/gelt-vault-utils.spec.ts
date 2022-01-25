import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber, BigNumberish } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
    FixedPointMathHarness,
    FixedPointMathHarness__factory,
    PercentageMathHarness,
    PercentageMathHarness__factory
} from '../../types';
import { hardhatDisableFork } from '../utils/network';
import { UINT256_MAX } from '../utils/fixtures';

describe('[Unit] Gelt Vault: Utils', () => {
    let signer: SignerWithAddress; // Default signer unless otherwise specified.

    before(async () => {
        [signer] = await ethers.getSigners();

        // Disable network forking for unit tests.
        await hardhatDisableFork();
    });

    describe('FixedPointMath', () => {
        let fixedPointMath: FixedPointMathHarness;
        let a: BigNumberish;
        let b: BigNumberish;

        beforeEach(async () => {
            fixedPointMath = await (new FixedPointMathHarness__factory(signer)).deploy();
            a = await fixedPointMath.toUFixed256x18(100);
            b = await fixedPointMath.toUFixed256x18(50);
        });

        describe('#add', () => {
            it('should add two fixed point numbers', async () => {
                expect(await fixedPointMath.add(a, b)).to.equal(await fixedPointMath.toUFixed256x18(150));
            });

            it('should revert on overflow', async () => {
                await expect(fixedPointMath.add(UINT256_MAX, UINT256_MAX)).to.be.revertedWith('overflowed');
            });
        });

        describe('#sub', () => {
            it('should subtract two fixed point numbers', async () => {
                expect(await fixedPointMath.sub(a, b)).to.equal(await fixedPointMath.toUFixed256x18(50));
            });

            it('should revert on underflow', async () => {
                await expect(fixedPointMath.sub(a, UINT256_MAX)).to.be.revertedWith('underflowed');
            });
        });

        describe('#mul(UFixed256x18, UFixed256x18)', () => {
            it('should multiply two fixed point numbers', async () => {
                expect(await fixedPointMath.mul(a, b)).to.equal(await fixedPointMath.toUFixed256x18(5000));
            });

            it('should revert on overflow', async () => {
                await expect(fixedPointMath.mul(a, UINT256_MAX)).to.be.revertedWith('overflowed');
            });
        });

        describe('#mul(UFixed256x18, uint256)', () => {
            it('should multiply a fixed point number by an unsigned integer', async () => {
                expect(await fixedPointMath.mulScalar(a, 50)).to.equal(await fixedPointMath.toUFixed256x18(5000));
            });

            it('should revert on overflow', async () => {
                await expect(fixedPointMath.mulScalar(a, UINT256_MAX)).to.be.revertedWith('overflowed');
            });
        });

        describe('#div(UFixed256x18, UFixed256x18)', () => {
            it('should divide two fixed point numbers', async () => {
                expect(await fixedPointMath.div(a, b)).to.equal(await fixedPointMath.toUFixed256x18(2));
            });

            it('should revert on overflow', async () => {
                await expect(fixedPointMath.div(UINT256_MAX, b)).to.be.revertedWith('overflowed');
            });
        });

        describe('#div(UFixed256x18, uint256)', () => {
            it('should divide a fixed point number by an unsigned integer', async () => {
                expect(await fixedPointMath.divScalar(a, 50)).to.equal(await fixedPointMath.toUFixed256x18(2));
            });
        });

        describe('#floor', () => {
            it('should floor a fixed point number', async () => {
                expect(await fixedPointMath.floor(a)).to.equal(100);
            });
        });

        describe('#toUFixed256x18(uint256)', async () => {
            it('should return a scaled fixed point number', async () => {
                expect(await fixedPointMath.toUFixed256x18(100))
                  .to.equal(BigNumber.from(100).mul(BigNumber.from(10).pow(18)));
            });

            it('should revert on overflow', async () => {
                await expect(fixedPointMath.toUFixed256x18(UINT256_MAX)).to.be.revertedWith('overflowed');
            });
        });

        describe('#toUFixed256x18(uint256, uint256)', async () => {
            it('should return a fixed point number', async () => {
                expect(await fixedPointMath.getUFixed256x18(100, 50)).to.equal(await fixedPointMath.toUFixed256x18(2));
            });

            it('should revert on overflow', async () => {
                await expect(fixedPointMath.getUFixed256x18(UINT256_MAX, 50)).to.be.revertedWith('overflowed');
            });
        });
    });

    describe('PercentageMath', () => {
        let percentageMath: PercentageMathHarness;

        beforeEach(async () => {
            percentageMath = await (new PercentageMathHarness__factory(signer)).deploy();
        });

        describe('#basisPoints', () => {
            it('should calculate the correct basis points for the given amount', async () => {
                const amount = BigNumber.from(100 * 10e6);
                expect(await percentageMath.basisPoints(amount, 100)).to.equal(10e6);
                expect(await percentageMath.basisPoints(amount, 2000)).to.equal(20 * 10e6);
                expect(await percentageMath.basisPoints(amount, 5)).to.equal(5 * 10e4);
                expect(await percentageMath.basisPoints(amount, 1)).to.equal(10e4);
                expect(await percentageMath.basisPoints(amount, 9999)).to.equal(9999 * 10e4);
                expect(await percentageMath.basisPoints(amount, 10000)).to.equal(100 * 10e6);
            });

            it('should revert when amount = 0', async () => {
                await expect(percentageMath.basisPoints(0, 10))
                  .to.be.revertedWith('amount must not be zero');
            });

            it('should revert when bps is out of bounds', async () => {
                await expect(percentageMath.basisPoints(100 * 10e6, 0))
                  .to.be.revertedWith('bps must not be zero');
                await expect(percentageMath.basisPoints(100 * 10e6, 10001))
                  .to.be.revertedWith('bps must not be more than 10000');
            });
        });
    });
});
