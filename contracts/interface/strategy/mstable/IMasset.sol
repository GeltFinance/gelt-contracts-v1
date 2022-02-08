// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

struct MassetData {
    uint256 redemptionFee;
}

/// @notice An incentivised constant sum market maker with hard limits at max region. The AMM produces a
///         stablecoin (mAsset) and redirects lending market interest and swap fees to the savings
///         contract, producing a second yield bearing asset.
/// @dev Interface based on https://github.com/mstable/mStable-contracts/blob/69fc5b2d3e4461b4a7b1071e976c316e8b9f370f/contracts/interfaces/IMasset.sol
interface IMasset is IERC20Upgradeable {
    /// @dev Configuration.
    function data() external view returns (MassetData calldata);

    /// @dev Gets the projected output of a given mint.
    function getMintOutput(
        address _input,
        uint256 _inputQuantity
    ) external view returns (uint256 mintOutput);

    /// @dev Redeems a specified quantity of mAsset in return for a bAsset specified by bAsset address.
    function redeem(
        address _output,
        uint256 _mAssetQuantity,
        uint256 _minOutputQuantity,
        address _recipient
    ) external returns (uint256 outputQuantity);

    /// @dev Gets the estimated bAsset output from a given redeem.
    function getRedeemOutput(
        address _output,
        uint256 _mAssetQuantity
    ) external view returns (uint256 bAssetOutput);

    /// @dev Gets the estimated mAsset output from a given redeem.
    function getRedeemExactBassetsOutput(
        address[] calldata _outputs,
        uint256[] calldata _outputQuantities
    ) external view returns (uint256 mAssetQuantity);
}
