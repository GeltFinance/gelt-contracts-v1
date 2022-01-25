// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title Abstract contract to allow for designating migrator functions that can be used to
///        define migration logic triggered during contract upgrades.
abstract contract Migratable is Initializable {
    mapping(uint256 => bool) private _migrations;

    function __Migratable_init() internal onlyInitializing {
        __Migratable_init_unchained();
    }

    function __Migratable_init_unchained() internal onlyInitializing {
    }

    modifier migrator(uint256 version) {
        _migrateVersion(version);
        _;
    }

    function _migrateVersion(uint256 version) private {
        require(!_migrations[version], "Migratable: contract already migrated");
        _migrations[version] = true;
    }

    uint256[50] private __gap;
}
