// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "../lib/FixedPointMath.sol";

contract FixedPointMathHarness {
    using FixedPointMath for UFixed256x18;

    function add(UFixed256x18 a, UFixed256x18 b) external pure returns (UFixed256x18) {
        return a.add(b);
    }

    function sub(UFixed256x18 a, UFixed256x18 b) external pure returns (UFixed256x18) {
        return a.sub(b);
    }

    function mulScalar(UFixed256x18 a, uint256 b) external pure returns (UFixed256x18) {
        return a.mul(b);
    }

    function mul(UFixed256x18 a, UFixed256x18 b) external pure returns (UFixed256x18) {
        return a.mul(b);
    }

    function divScalar(UFixed256x18 a, uint256 b) external pure returns (UFixed256x18) {
        return a.div(b);
    }

    function div(UFixed256x18 a, UFixed256x18 b) external pure returns (UFixed256x18) {
        return a.div(b);
    }

    function floor(UFixed256x18 a) external pure returns (uint256) {
        return a.floor();
    }

    function toUFixed256x18(uint256 a) external pure returns (UFixed256x18) {
        return FixedPointMath.toUFixed256x18(a);
    }

    function getUFixed256x18(uint256 numerator, uint256 denominator) external pure returns (UFixed256x18) {
        return FixedPointMath.toUFixed256x18(numerator, denominator);
    }
}
