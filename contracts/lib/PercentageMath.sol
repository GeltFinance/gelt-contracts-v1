// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

/// @title A library providing utilities to work with percentages.
library PercentageMath {
    uint16 private constant MAX_BPS = 10_000;

    /// @dev Calculates the percentage (given in basis points) of the given number.
    /// @param amount The amount to calculate the percentage of.
    /// @param bps Percentage in basis points.
    /// @return Percentage of amount.
    function basisPoints(uint256 amount, uint16 bps) internal pure returns (uint256) {
        require(amount > 0, "amount must not be zero");
        require(bps > 0, "bps must not be zero");
        require(bps <= MAX_BPS, "bps must not be more than 10000"); // 10k bps = 100%

        return (amount * bps) / MAX_BPS;
    }
}
