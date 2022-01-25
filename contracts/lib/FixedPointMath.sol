// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

/// @dev Represents a 18 decimal, 256 bit wide fixed point number.
type UFixed256x18 is uint256;

/// @title A minimal library to do fixed point operations on UFixed256x18.
library FixedPointMath {
    uint256 internal constant MULTIPLIER = 1e18;

    /// Adds two UFixed256x18 numbers.
    /// @dev Reverts on overflow, relying on checked arithmetic on uint256.
    function add(UFixed256x18 a, UFixed256x18 b) internal pure returns (UFixed256x18) {
        return UFixed256x18.wrap(UFixed256x18.unwrap(a) + UFixed256x18.unwrap(b));
    }

    /// Subtracts two UFixed256x18 numbers.
    /// @dev Reverts on underflow, relying on checked arithmetic on uint256.
    function sub(UFixed256x18 a, UFixed256x18 b) internal pure returns (UFixed256x18) {
        return UFixed256x18.wrap(UFixed256x18.unwrap(a) - UFixed256x18.unwrap(b));
    }

    /// Multiplies UFixed256x18 and uint256.
    /// @dev Reverts on overflow, relying on checked arithmetic on uint256.
    function mul(UFixed256x18 a, uint256 b) internal pure returns (UFixed256x18) {
        return UFixed256x18.wrap(UFixed256x18.unwrap(a) * b);
    }

    /// Multiplies two UFixed256x18 numbers.
    /// @dev Reverts on overflow, relying on checked arithmetic on uint256.
    function mul(UFixed256x18 a, UFixed256x18 b) internal pure returns (UFixed256x18) {
        return UFixed256x18.wrap((UFixed256x18.unwrap(a) * UFixed256x18.unwrap(b)) / MULTIPLIER);
    }

    /// Divides UFixed256x18 and uint256.
    function div(UFixed256x18 a, uint256 b) internal pure returns (UFixed256x18) {
        return UFixed256x18.wrap(UFixed256x18.unwrap(a) / b);
    }

    /// Divides two UFixed256x18 numbers.
    /// @dev Reverts on overflow, relying on checked arithmetic on uint256.
    function div(UFixed256x18 a, UFixed256x18 b) internal pure returns (UFixed256x18) {
        return UFixed256x18.wrap((UFixed256x18.unwrap(a) * MULTIPLIER) / UFixed256x18.unwrap(b));
    }

    /// Takes the floor of a UFixed256x18 number.
    function floor(UFixed256x18 a) internal pure returns (uint256) {
        return UFixed256x18.unwrap(a) / MULTIPLIER;
    }

    /// Turns a uint256 into a UFixed256x18 of the same value.
    /// @dev Reverts if the integer is too large.
    function toUFixed256x18(uint256 a) internal pure returns (UFixed256x18) {
        return UFixed256x18.wrap(a * MULTIPLIER);
    }

    /// Turns a numerator and a denominator into a fixed precision number.
    /// @dev Reverts if either numbers are too large.
    function toUFixed256x18(uint256 numerator, uint256 denominator) internal pure returns (UFixed256x18) {
        return UFixed256x18.wrap((numerator * MULTIPLIER) / denominator);
    }
}
