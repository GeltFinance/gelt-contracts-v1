// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

/// @title A library providing utilities to work with percentages.
library PercentageMath {
    uint64 internal constant SCALE = 1e14;

    /// @dev 10k bps = 100%
    uint64 internal constant MAX_BPS = 10_000 * SCALE;

    /// @dev Calculates the percentage (given in scaled basis points) of the given number.
    /// @param amount The amount to calculate the percentage of.
    /// @param scaledBps Percentage in scaled basis points.
    /// @return Percentage of amount.
    function percentage(uint256 amount, uint64 scaledBps) internal pure returns (uint256) {
        require(amount > 0, "amount must not be 0");
        require(scaledBps > 0, "bps must not be 0");
        require(scaledBps <= MAX_BPS, "bps out of bounds");

        return (amount * scaledBps) / MAX_BPS;
    }
}
