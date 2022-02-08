// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

/// @dev Interface based on https://github.com/mstable/mStable-contracts/blob/69fc5b2d3e4461b4a7b1071e976c316e8b9f370f/contracts/savings/peripheral/SaveWrapper.sol
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
