// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/// @dev Uses the ever increasing "exchangeRate" to increase the value of the "credits" (ERC20)
///      relative to the amount of additional underlying collateral that has been deposited into
///      this contract ("interest").
interface IInterestBearingMasset is IERC20Upgradeable {
    /// @dev Rate between 'savings credits' and underlying.
    function exchangeRate() external view returns (uint256);

    /// @dev The underlying balance of a given user.
    function balanceOfUnderlying(address _user) external view returns (uint256 _underlying);

    /// @dev Converts a given underlying amount into credits.
    function underlyingToCredits(uint256 _underlying) external view returns (uint256 credits);

    /// @dev Converts a given credit amount into underlying.
    function creditsToUnderlying(uint256 _credits) external view returns (uint256 amount);

    /// @dev Redeem specific number of the senders "credits" in exchange for underlying.
    function redeemCredits(uint256 _credits) external returns (uint256 massetReturned);

    /// @dev Redeem credits into a specific amount of underlying.
    function redeemUnderlying(uint256 _underlying) external returns (uint256 creditsBurned);

    /// @dev Deposit interest (add to savings) and update exchange rate of contract.
    function depositInterest(uint256 _amount) external;
}
