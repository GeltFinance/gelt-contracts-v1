// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/// @notice Rewards stakers of a given LP token (a.k.a StakingToken) with RewardsToken, on a pro-rata basis
///         additionally, distributes the Platform token airdropped by the platform.
/// @dev Interface based on https://github.com/mstable/mStable-contracts/blob/69fc5b2d3e4461b4a7b1071e976c316e8b9f370f/contracts/rewards/staking/StakingRewardsWithPlatformToken.sol
interface IVaultedInterestBearingMasset is IERC20Upgradeable {
    /// @dev Withdraws given stake amount from the pool.
    /// @param _amount Units of the staked token to withdraw.
    function withdraw(uint256 _amount) external;

    /// @dev Withdraws stake from pool and claims any rewards.
    function exit() external;

    /// @dev Claims outstanding rewards (both platform and native) for the sender.
    function claimReward() external;

    /// @dev Gets the RewardsToken.
    function getRewardToken() external view returns (IERC20Upgradeable);

    /// @dev Gets the PlatformToken.
    function getPlatformToken() external view returns (IERC20Upgradeable);
}
