// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "../MstableGeltVault.sol";

contract MstableGeltVaultV2 is MstableGeltVault {
    uint256 public newData;

    function migrateV2(uint256 newData_) public migrator(2) {
        newData = newData_;
    }

    function newFunction() external view returns (uint256) {
        return newData * 2;
    }
}
