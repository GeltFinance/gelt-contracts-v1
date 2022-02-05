// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/// @title Abstract contract to allow for temporarily pausing a contract preventing
///        execution of the designated functions.
abstract contract TemporarilyPausable is Initializable, ContextUpgradeable {
    /// @dev Emitted when the pause is triggered by `account`.
    event TemporarilyPaused(address account);

    /// @dev Emitted when the pause is lifted by `account`.
    event Unpaused(address account);

    uint256 private _pauseDuration;
    uint256 private _pausedAt;
    bool private _paused;

    /// @dev Initializes the contract in unpaused state.
    function __TemporarilyPausable_init(uint256 pauseDuration_) internal onlyInitializing {
        __Context_init_unchained();
        __TemporarilyPausable_init_unchained(pauseDuration_);
    }

    function __TemporarilyPausable_init_unchained(uint256 pauseDuration_) internal onlyInitializing {
        _setPauseDuration(pauseDuration_);
        _paused = false;
    }

    /// @dev Returns the pause duration after which the a paused contract will automatically unpause.
    function pauseDuration() public view virtual returns (uint256) {
        return _pauseDuration;
    }

    /// @dev Returns true if the contract is temporarily paused, and false otherwise.
    function paused() public view virtual returns (bool) {
        return _paused;
    }

    /// @dev Modifier to make a function callable only when the contract is temporarily paused.
    modifier whenTemporarilyPaused() {
        _checkPaused();
        _;
    }

    /// @dev Modifier to make a function callable only when the contract is not temporarily paused.
    ///      Automatically unpauses the contract if the pause duration expired.
    modifier whenNotTemporarilyPaused() {
        _checkNotPaused();
        _;
    }

    /// @dev Temporarily pauses the contract.
    function _temporarilyPause() internal {
        _pausedAt = block.timestamp;
        _paused = true;
        emit TemporarilyPaused(_msgSender());
    }

    /// @dev Unpauses the contract.
    function _unpause() internal {
        _paused = false;
        emit Unpaused(_msgSender());
    }

    /// @dev Sets the pause duration. Reverts if the given duration is less than a week.
    /// @param pauseDuration_ Duration in seconds.
    function _setPauseDuration(uint256 pauseDuration_) internal {
        // Make sure pause duration is long enough so that miners can't manipulate the behaviour.
        require(pauseDuration_ >= 1 days, "pauseDuration must be >= 1 day");

        _pauseDuration = pauseDuration_;
    }

    function _checkPaused() private view {
        require(paused(), "TemporarilyPausable: not temporarily paused");
    }

    function _checkNotPaused() private {
        // Unpause if the pause duration expired.
        if (paused() && block.timestamp > (_pausedAt + _pauseDuration)) {
            _unpause();
        }

        require(!paused(), "TemporarilyPausable: temporarily paused");
    }

    uint256[47] private __gap;
}
