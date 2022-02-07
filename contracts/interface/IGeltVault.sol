// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/// @notice Strategy tolerance configuration.
struct StrategyTolerances {
    /// @notice Slippage tolerance in scaled basis points.
    uint64 slippage;
    /// @notice Strategy redemption fee tolerance in scaled basis points.
    uint64 redemptionFee;
}

/// @title The interface to the V1 Gelt Vault.
interface IGeltVaultV1 {
    // =========================================================================
    // Events
    // =========================================================================

    /// @notice Emitted after a mint with signed authorization.
    /// @param minter Minter's address (authorizer).
    /// @param mintAmount Amount of underlying supplied.
    /// @param mintTokens Amount of vault tokens minted.
    /// @param sender Sender of the transaction (Gelt operator).
    event MintedWithAuthorization(
        address indexed minter,
        uint256 mintAmount,
        uint256 mintTokens,
        address sender
    );

    /// @notice Emitted after a redeem with signed authorization.
    /// @param redeemer Redeemer's address (authorizer).
    /// @param redeemTokens Amount of vault tokens redeemed.
    /// @param redeemAmount Amount of underlying received for the tokens.
    /// @param withdrawTo Address the underlying was withdrawn to.
    /// @param sender Sender of the transaction (Gelt operator).
    event RedeemedWithAuthorization(
        address indexed redeemer,
        uint256 redeemTokens,
        uint256 redeemAmount,
        address withdrawTo,
        address sender
    );

    /// @notice Emitted after a voluntary exit from the vault.
    /// @param sender Sender of the transaction (Gelt user).
    /// @param redeemTokens Amount of vault tokens redeemed.
    /// @param redeemAmount Amount of underlying received for the tokens.
    /// @param withdrawTo Address the underlying was withdrawn to.
    event VoluntarilyExited(
        address indexed sender,
        uint256 redeemTokens,
        uint256 redeemAmount,
        address withdrawTo
    );

    /// @notice Emitted after depositing to the strategy.
    /// @param amount Amount of underlying deposited.
    /// @param sender Sender of the transaction (Gelt operator).
    event DepositedToStrategy(uint256 amount, address sender);

    /// @notice Emitted after withdrawing from the strategy.
    /// @param amount Amount of underlying withdrawn.
    /// @param sender Sender of the transaction (Gelt operator).
    event WithdrewFromStrategy(uint256 amount, address sender);

    /// @notice Emitted after the governance tokens were collected from the vault.
    /// @param rewardToken Address of the reward token.
    /// @param platformToken Address of the platform token.
    /// @param rewardTokenBalance Amount of reward tokens collected.
    /// @param platformTokenBalance Amount of platform tokens collected.
    /// @param sender Sender of the transaction (Gelt operator).
    event GovernanceTokensCollected(
        IERC20Upgradeable indexed rewardToken,
        IERC20Upgradeable indexed platformToken,
        uint256 rewardTokenBalance,
        uint256 platformTokenBalance,
        address sender
    );

    /// @notice Emitted after a change to the collector address.
    /// @param oldCollector Previous address.
    /// @param newCollector New address.
    /// @param sender Sender of the transaction (Gelt administrator).
    event CollectorChanged(address oldCollector, address newCollector, address sender);

    /// @notice Emitted after a change to the strategy tolerances.
    /// @param oldTolerances Previous strategy tolerances.
    /// @param newTolerances New strategy tolerances.
    /// @param sender Sender of the transaction (Gelt administrator).
    event StrategyTolerancesChanged(StrategyTolerances oldTolerances, StrategyTolerances newTolerances, address sender);

    /// @notice Emitted after an emergency exit from the strategy.
    /// @param redeemCredits Amount of credits redeemed.
    /// @param redeemAmount Amount of underlying redeemed.
    /// @param sender Sender of the transaction (Gelt administrator).
    event EmergencyExited(uint256 redeemCredits, uint256 redeemAmount, address sender);

    /// @notice Emitted after a token was swept from the vault.
    /// @param token Address of the ERC20 token.
    /// @param amount Amount of tokens swept.
    /// @param sender Sender of the transaction (Gelt administrator).
    event TokenSwept(IERC20Upgradeable indexed token, uint256 amount, address sender);

    /// @notice Emitted after the contract's ownership is transferred.
    /// @param previousOwner Address of the previous owner.
    /// @param newOwner Address of the new owner.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // =========================================================================
    // Functions
    // =========================================================================

    /// @notice Executes a mint with a signed authorization.
    /// @param minter Minter's address (authorizer).
    /// @param mintAmount Amount of underlying to supply.
    /// @param validAfter The time after which the meta-transaction is valid (UNIX timestamp).
    /// @param validBefore The time before which the meta-transaction is valid (UNIX timestamp).
    /// @param nonce Unique nonce.
    /// @param v Meta-transaction signature's `v` component.
    /// @param r Meta-transaction signature's `r` component.
    /// @param s Meta-transaction signature's `s` component.
    /// @return mintTokens Amount of tokens minted.
    /// @custom:gelt-access-control Operator
    function mintWithAuthorization(
        address minter,
        uint256 mintAmount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external
        returns (uint256 mintTokens);

    /// @notice Executes a redeem with a signed authorization.
    /// @param redeemer Redeemer's address (authorizer).
    /// @param withdrawTo Address to withdraw the underlying to.
    /// @param redeemTokens Amount of tokens to redeem.
    /// @param validAfter The time after which the meta-transaction is valid (UNIX timestamp).
    /// @param validBefore The time before which the meta-transaction is valid (UNIX timestamp).
    /// @param nonce Unique nonce.
    /// @param v Meta-transaction signature's `v` component.
    /// @param r Meta-transaction signature's `r` component.
    /// @param s Meta-transaction signature's `s` component.
    /// @return redeemAmount Amount of underlying redeemed.
    /// @custom:gelt-access-control Operator
    function redeemWithAuthorization(
        address redeemer,
        address withdrawTo,
        uint256 redeemTokens,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external
        returns (uint256 redeemAmount);

    /// @notice Allows an end-user to voluntarily exit the vault.
    /// @param withdrawTo Address to withdraw the underlying to.
    /// @param minOutputQuantity Minimum amount of underlying to be withdrawn.
    ///                          This protects against slippage.
    function voluntaryExit(address withdrawTo, uint256 minOutputQuantity) external;

    /// @notice Deposits to the strategy.
    /// @param amount Amount of underlying to supply to the strategy.
    /// @custom:gelt-access-control Operator
    function executeStrategyNetDeposit(uint256 amount) external;

    /// @notice Redeems from the strategy.
    /// @param amount Amount of underlying to redeem from the strategy.
    /// @custom:gelt-access-control Operator
    function executeStrategyNetWithdraw(uint256 amount) external;

    /// @notice Claims governance tokens from the strategy.
    /// @custom:gelt-access-control Operator
    function claimGovernanceTokens() external;

    /// @notice Collects claimed governance tokens to the collector address.
    /// @custom:gelt-access-control Operator
    function collectGovernanceTokens() external;

    /// @notice Sets the governance token collector address.
    /// @param collector_ New collector address.
    /// @custom:gelt-access-control Administrator
    function setCollector(address collector_) external;

    /// @notice Sets the strategy tolerances, e.g. slippage or redemption fee tolerances.
    /// @param strategyTolerances_ New strategy tolerances.
    /// @custom:gelt-access-control Administrator
    function setStrategyTolerances(StrategyTolerances calldata strategyTolerances_) external;

    /// @notice Exits all funds and collects rewards from the strategy.
    /// @dev This should only be used in emergency scenarios.
    /// @param minOutputQuantity Minimum amount of underlying to be withdrawn.
    /// @custom:gelt-access-control Administrator
    function emergencyExitStrategy(uint256 minOutputQuantity) external;

    /// @notice Pauses the vault preventing mints, redeems, strategy execution and voluntary exits.
    /// @dev This should only be used in emergency scenarios.
    /// @custom:gelt-access-control Administrator
    function emergencyPause() external;

    /// @notice Unpauses the vault enabling mints, redeems, strategy execution and voluntary exits.
    /// @dev This should only be used in emergency scenarios.
    /// @custom:gelt-access-control Administrator
    function emergencyUnpause() external;

    /// @notice Withdraws a token that isn't protected by the vault.
    ///         This allows for recovering tokens that were sent to the vault by accident.
    /// @param token Address of the ERC20 token to withdraw.
    /// @param amount Amount to withdraw.
    /// @custom:gelt-access-control Administrator
    function sweep(IERC20Upgradeable token, uint256 amount) external;

    /// @notice Transfers the ownership of the contract.
    /// @param newOwner Address of the new contract owner.
    /// @custom:gelt-access-control Owner
    function transferOwnership(address newOwner) external;
}

/// @title The interface to the Gelt Vault.
interface IGeltVault is IGeltVaultV1 {}
