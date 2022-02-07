// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "../lib/PercentageMath.sol";

contract PercentageMathHarness {
    using PercentageMath for uint256;

    function percentage(uint256 amount, uint64 scaledBps) external pure returns (uint256) {
        return amount.percentage(scaledBps);
    }
}
