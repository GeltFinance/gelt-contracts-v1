// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract MstableGeltVaultV2Incompatible is UUPSUpgradeable {
    function _authorizeUpgrade(address) internal override {}

    function newFunction(uint256 number) external pure returns (uint256) {
        return number * 2;
    }
}
