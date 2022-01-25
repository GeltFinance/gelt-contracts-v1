// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

interface ISaveWrapper {
    /// @dev Mints mAssets and then deposits to Save/Savings Vault.
    function saveViaMint(
        address _mAsset,
        address _save,
        address _vault,
        address _bAsset,
        uint256 _amount,
        uint256 _minOut,
        bool _stake
    ) external;
}
