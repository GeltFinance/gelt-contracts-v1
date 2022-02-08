// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interface/IGeltVault.sol";
import "./interface/strategy/mstable/ISaveWrapper.sol";
import "./interface/strategy/mstable/IMasset.sol";
import "./interface/strategy/mstable/IInterestBearingMasset.sol";
import "./interface/strategy/mstable/IVaultedInterestBearingMasset.sol";
import "./lib/FixedPointMath.sol";
import "./lib/PercentageMath.sol";
import "./TemporarilyPausable.sol";
import "./Migratable.sol";
import "./Authorizable.sol";

/// @title Gelt Vault implementation with mStable as the underlying strategy.
contract MstableGeltVault is
    Initializable,
    ContextUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable,
    ERC20Upgradeable,
    TemporarilyPausable,
    Migratable,
    Authorizable,
    IGeltVault
{
    using FixedPointMath for UFixed256x18;
    using PercentageMath for uint256;
    using SafeCast for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    bytes32 public constant MINT_WITH_AUTHORIZATION_TYPEHASH = keccak256("MintWithAuthorization(address minter,uint256 mintAmount,uint256 validAfter,uint256 validBefore,bytes32 nonce)");
    bytes32 public constant REDEEM_WITH_AUTHORIZATION_TYPEHASH = keccak256("RedeemWithAuthorization(address redeemer,address withdrawTo,uint256 redeemTokens,uint256 validAfter,uint256 validBefore,bytes32 nonce)");

    /// @notice Owner of the vault, it can update the vault and assign roles to accounts.
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    /// @notice Administrator of the vault, can configure the vault and trigger emergency operations.
    bytes32 public constant ADMINISTRATOR_ROLE = keccak256("ADMINISTRATOR_ROLE");
    /// @notice Operator of the vault, it can interact with the strategy and submit meta-transactions.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Address of the governance token collector.
    address public collector;

    /// @notice Underlying basket asset (e.g. USDC).
    IERC20MetadataUpgradeable public bAsset;
    /// @notice mStable meta asset (mUSD).
    IMasset public mAsset;
    /// @notice mStable interest bearing meta asset (imUSD).
    IInterestBearingMasset public imAsset;
    /// @notice mStable vaulted interest bearing meta asset (v-imUSD).
    IVaultedInterestBearingMasset public vimAsset;
    /// @notice mStable save wrapper.
    ISaveWrapper public saveWrapper;

    /// @notice Initial exchange rate between the underlying and the vault's token.
    UFixed256x18 public initialExchangeRate;
    /// @notice Precision multiplier between basket asset and mStable's meta asset.
    uint256 public precisionMultiplier;
    /// @notice Tolerances for strategy operations (e.g. slippage).
    StrategyTolerances public strategyTolerances;

    /// @notice Initializes the Gelt Vault.
    function initialize(
        IERC20MetadataUpgradeable bAsset_,
        IMasset mAsset_,
        IInterestBearingMasset imAsset_,
        IVaultedInterestBearingMasset vimAsset_,
        ISaveWrapper saveWrapper_,
        string memory name,
        string memory symbol
    )
        public
        initializer
    {
        require(address(bAsset_) != address(0), "bAsset addr must not be 0");
        require(address(mAsset_) != address(0), "mAsset addr must not be 0");
        require(address(imAsset_) != address(0), "imAsset addr must not be 0");
        require(address(vimAsset_) != address(0), "vimAsset addr must not be 0");
        require(address(saveWrapper_) != address(0), "saveWrapper addr must not be 0");

        __Context_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        __ERC20_init(name, symbol);
        __TemporarilyPausable_init(2 weeks);
        __Migratable_init();
        __Authorizable_init(name, "1");

        _grantRole(OWNER_ROLE, _msgSender());
        _setRoleAdmin(ADMINISTRATOR_ROLE, OWNER_ROLE);
        _setRoleAdmin(OPERATOR_ROLE, OWNER_ROLE);

        bAsset = bAsset_;
        vimAsset = vimAsset_;
        saveWrapper = saveWrapper_;
        imAsset = imAsset_;
        mAsset = mAsset_;

        require(decimals() >= bAsset.decimals(), "invalid decimals on bAsset");

        initialExchangeRate = FixedPointMath.toUFixed256x18(1, 100); // 1:100 initial mint.
        precisionMultiplier = 10**decimals() / 10**bAsset.decimals(); // 10^18 / 10^6 = 10^12
        strategyTolerances = StrategyTolerances({
            slippage: 4 * PercentageMath.SCALE, // 0.04%
            redemptionFee: 10 * PercentageMath.SCALE // 0.10%
        });

        collector = address(0);
    }

    // =========================================================================
    // UUPSUpgradeable
    // =========================================================================

    /// @dev This function should revert when `msg.sender` is not authorized to upgrade the contract.
    function _authorizeUpgrade(address) internal override onlyRole(OWNER_ROLE) {}

    // =========================================================================
    // ERC20Upgradeable
    // =========================================================================

    /// @inheritdoc ERC20Upgradeable
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    // =========================================================================
    // GeltVault
    // =========================================================================

    /// @inheritdoc IGeltVaultV1
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
        override
        onlyRole(OPERATOR_ROLE)
        whenNotTemporarilyPaused
        returns (uint256 mintTokens)
    {
        require(minter != address(0), "minter addr must not be 0");
        require(mintAmount > 0, "mintAmount must be > 0");

        // Verify authorization.
        _requireValidAuthorization(minter, validAfter, validBefore, nonce);

        // Verify signature.
        bytes memory data = abi.encode(
            MINT_WITH_AUTHORIZATION_TYPEHASH,
            minter,
            mintAmount,
            validAfter,
            validBefore,
            nonce
        );
        _requireValidSignature(minter, data, v, r, s);
        _markAuthorizationAsUsed(minter, nonce);

        // User gets mintTokens gUSDC such that the present USDC value of mintTokens
        // reflects the relative share of the vault.
        mintTokens = _calcMintTokens(mintAmount);

        // Transfer the underlying to the vault.
        bAsset.safeTransferFrom(minter, address(this), mintAmount);

        // Update the total supply and the balance of the minter.
        _mint(minter, mintTokens);

        emit MintedWithAuthorization(minter, mintAmount, mintTokens, _msgSender());
    }

    /// @inheritdoc IGeltVaultV1
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
        override
        onlyRole(OPERATOR_ROLE)
        whenNotTemporarilyPaused
        returns (uint256 redeemAmount)
    {
        require(redeemer != address(0), "redeemer addr must not be 0");
        require(withdrawTo != address(0), "withdrawTo addr must not be 0");
        require(redeemTokens > 0, "redeemTokens must be > 0");

        // Verify authorization.
        _requireValidAuthorization(redeemer, validAfter, validBefore, nonce);

        // Verify signature.
        bytes memory data = abi.encode(
            REDEEM_WITH_AUTHORIZATION_TYPEHASH,
            redeemer,
            withdrawTo,
            redeemTokens,
            validAfter,
            validBefore,
            nonce
        );
        _requireValidSignature(redeemer, data, v, r, s);
        _markAuthorizationAsUsed(redeemer, nonce);

        redeemAmount = _calcRedeemAmount(redeemTokens);

        // Update the total supply and the balance of the redeemer.
        _burn(redeemer, redeemTokens);

        bAsset.safeTransfer(withdrawTo, redeemAmount);

        emit RedeemedWithAuthorization(redeemer, redeemTokens, redeemAmount, withdrawTo, _msgSender());
    }

    /// @notice Calculates the exchange rate from the underlying to the vault's token.
    /// @return exchangeRate_ The calculated exchange rate scaled by 10^18.
    function exchangeRate() public view returns (UFixed256x18 exchangeRate_) {
        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            exchangeRate_ = initialExchangeRate;
        } else {
            // Total assets = free funds held by the vault + funds lent out to the strategy
            uint256 totalAssets = _underlyingBalance() + _getStrategyValue();
            uint256 totalAssetsScaled = totalAssets * precisionMultiplier;

            // Exchange rate = total assets / total vault token supply
            exchangeRate_ = FixedPointMath.toUFixed256x18(totalAssetsScaled, _totalSupply);
        }
    }

    /// @inheritdoc IGeltVaultV1
    function voluntaryExit(address withdrawTo, uint256 minOutputQuantity)
        external
        override
        whenNotTemporarilyPaused
        nonReentrant
    {
        require(withdrawTo != address(0), "withdrawTo addr must not be 0");

        uint256 redeemTokens = balanceOf(_msgSender());

        uint256 redeemAmount = _calcRedeemAmount(redeemTokens);

        // In case of a voluntary exit, the user pays for the redemption fees.
        redeemAmount -= redeemAmount.percentage(_getStrategyRedemptionFee());

        require(redeemAmount >= minOutputQuantity, "requested minimum output quantity is not satisfied");

        // Check if the vault has enough free funds to satisfy the exit request.
        uint256 underlyingBalance = _underlyingBalance();
        if (underlyingBalance < redeemAmount) {
            // Not enough free funds, execute strategy.
            uint256 diff = redeemAmount - underlyingBalance;
            _executeStrategyRedeem(diff, false);
        }

        // Assert that the vault has enough free funds.
        assert(_underlyingBalance() >= redeemAmount);

        // Update the total supply and the balance of the redeemer.
        _burn(_msgSender(), redeemTokens);

        bAsset.safeTransfer(withdrawTo, redeemAmount);

        emit VoluntarilyExited(_msgSender(), redeemTokens, redeemAmount, withdrawTo);
    }

    /// @inheritdoc IGeltVaultV1
    function executeStrategyNetDeposit(uint256 amount)
        external
        override
        whenNotTemporarilyPaused
        onlyRole(OPERATOR_ROLE)
    {
        _executeStrategyMint(amount);

        emit DepositedToStrategy(amount, _msgSender());
    }

    /// @inheritdoc IGeltVaultV1
    function executeStrategyNetWithdraw(uint256 amount)
        external
        override
        whenNotTemporarilyPaused
        onlyRole(OPERATOR_ROLE)
    {
        _executeStrategyRedeem(amount, true);

        emit WithdrewFromStrategy(amount, _msgSender());
    }


    /// @inheritdoc IGeltVaultV1
    function claimGovernanceTokens() external override whenNotTemporarilyPaused onlyRole(OPERATOR_ROLE) {
        vimAsset.claimReward();
    }

    /// @inheritdoc IGeltVaultV1
    function collectGovernanceTokens() external override whenNotTemporarilyPaused onlyRole(OPERATOR_ROLE) {
        require(collector != address(0), "collector addr must not be 0");

        IERC20Upgradeable rewardToken = vimAsset.getRewardToken(); // MTA
        IERC20Upgradeable platformToken = vimAsset.getPlatformToken(); // WMATIC
        uint256 rewardTokenBalance = rewardToken.balanceOf(address(this));
        uint256 platformTokenBalance = platformToken.balanceOf(address(this));

        if (rewardTokenBalance > 0) {
            rewardToken.safeTransfer(collector, rewardTokenBalance);
        }

        if (platformTokenBalance > 0) {
            platformToken.safeTransfer(collector, platformTokenBalance);
        }

        emit GovernanceTokensCollected(
            rewardToken,
            platformToken,
            rewardTokenBalance,
            platformTokenBalance,
            _msgSender()
        );
    }

    /// @inheritdoc IGeltVaultV1
    function setCollector(address collector_)
        external
        override
        whenNotTemporarilyPaused
        onlyRole(ADMINISTRATOR_ROLE)
    {
        require(collector_ != address(0), "collector addr must not be 0");

        emit CollectorChanged(collector, collector_, _msgSender());

        collector = collector_;
    }

    /// @inheritdoc IGeltVaultV1
    function setStrategyTolerances(StrategyTolerances calldata strategyTolerances_)
        external
        override
        whenNotTemporarilyPaused
        onlyRole(ADMINISTRATOR_ROLE)
    {
        require(strategyTolerances_.slippage <= PercentageMath.MAX_BPS, "slippage out of bounds");
        require(strategyTolerances_.redemptionFee <= PercentageMath.MAX_BPS, "redemptionFee out of bounds");

        emit StrategyTolerancesChanged(strategyTolerances, strategyTolerances_, _msgSender());

        strategyTolerances = strategyTolerances_;
    }

    /// @inheritdoc IGeltVaultV1
    function emergencyExitStrategy(uint256 minOutputQuantity) external override onlyRole(ADMINISTRATOR_ROLE) {
        require(minOutputQuantity != 0, "minOutputQuantity must not be 0");

        if (vimAsset.balanceOf(address(this)) > 0) {
            // Unstake and collect rewards.
            vimAsset.exit();
        }

        uint256 creditBalance = imAsset.balanceOf(address(this));
        if (creditBalance > 0) {
            // Redeem credits to mAssets.
            imAsset.redeemCredits(creditBalance);
        }

        uint256 mAssetBalance = mAsset.balanceOf(address(this));
        uint256 outputAmount = 0;
        if (mAssetBalance > 0) {
            // Redeem mAssets to bAssets.
            outputAmount = mAsset.redeem(
                address(bAsset), // address _output
                mAssetBalance, // uint256 _mAssetQuantity
                minOutputQuantity, // uint256 _minOutputQuantity
                address(this) // address _recipient
            );
        }

        emit EmergencyExited(creditBalance, outputAmount, _msgSender());
    }

    /// @inheritdoc IGeltVaultV1
    function emergencyPause() external override whenNotTemporarilyPaused onlyRole(ADMINISTRATOR_ROLE) {
        _temporarilyPause();
    }

    /// @inheritdoc IGeltVaultV1
    function emergencyUnpause() external override whenTemporarilyPaused onlyRole(ADMINISTRATOR_ROLE) {
        _unpause();
    }

    /// @inheritdoc IGeltVaultV1
    function sweep(IERC20Upgradeable token, uint256 amount)
        external
        override
        whenNotTemporarilyPaused
        onlyRole(ADMINISTRATOR_ROLE)
    {
        require(amount > 0, "amount must not be 0");
        require(
            token != bAsset &&
                token != mAsset &&
                token != imAsset &&
                token != vimAsset &&
                token != vimAsset.getRewardToken() &&
                token != vimAsset.getPlatformToken(),
           "token must not be protected"
        );

        uint256 balance = token.balanceOf(address(this));
        require(balance >= amount, "amount must not exceed balance");

        token.safeTransfer(_msgSender(), amount);

        emit TokenSwept(token, amount, _msgSender());
    }

    /// @inheritdoc IGeltVaultV1
    function transferOwnership(address newOwner) external onlyRole(OWNER_ROLE) {
        require(newOwner != address(0), "owner addr must not be 0");

        // Revoke role from previous owner and grant role to new owner.
        _revokeRole(OWNER_ROLE, _msgSender());
        _grantRole(OWNER_ROLE, newOwner);

        emit OwnershipTransferred(_msgSender(), newOwner);
    }

    /// @dev Deposits to the strategy.
    /// @param amount Amount of underlying to supply to the strategy.
    /// @return inputAmount Amount of underlying that was supplied.
    function _executeStrategyMint(uint256 amount) internal returns (uint256 inputAmount) {
        require(amount > 0, "amount must not be 0");

        // Check if the mint output quantity is within the allowed bounds.
        uint256 maxSlippage = amount.percentage(strategyTolerances.slippage);
        uint256 minOutputQuantity = (amount - maxSlippage) * precisionMultiplier;

        uint256 mintOutput = mAsset.getMintOutput(address(bAsset), amount);
        require(mintOutput >= minOutputQuantity, "slippage outside of tolerance");

        bAsset.safeIncreaseAllowance(address(saveWrapper), amount);

        // USDC (amount) -> mUSD (amount - ∆mint)
        // mUSD (amount - ∆mint) -> imUSD (X)
        // imUSD (X) -> v-imUSD (X)
        saveWrapper.saveViaMint(
            address(mAsset), // address _mAsset
            address(imAsset), // address _save
            address(vimAsset), // address _vault
            address(bAsset), // address _bAsset
            amount, // uint256 _amount
            minOutputQuantity, // uint256 _minOut
            true // bool _stake
        );

        inputAmount = amount;
    }

    /// @dev Redeems from the strategy.
    /// @param amount Amount of underlying to redeem from the strategy.
    /// @param checkRedemptionFee True to enable redemption fee tolerance checks, false otherwise.
    /// @return outputAmount Amount of underlying that was redeemed.
    function _executeStrategyRedeem(uint256 amount, bool checkRedemptionFee) internal returns (uint256 outputAmount) {
        require(amount > 0, "amount must not be 0");

        uint64 redemptionFee = _getStrategyRedemptionFee();

        if (checkRedemptionFee) {
            // Check if the mStable redemption fee is within the tolerance bounds.
            require(
                redemptionFee <= strategyTolerances.redemptionFee,
                "redemptionFee out of tolerance"
            );
        }

        // Calculate how much mAssets would need to be redeemed to satisfy the strategy execution request.
        uint256 withdrawAmount = _calcStrategyRedeemAmount(amount);

        // Scale bAsset amount to mAsset precision.
        uint256 maxRedeemOutput = amount * precisionMultiplier;
        // Calculate maximum tolerated redeem amount (includes slippage and redeem fee).
        maxRedeemOutput += maxRedeemOutput.percentage(redemptionFee); // Redemption fee tolerance already checked.
        maxRedeemOutput += maxRedeemOutput.percentage(strategyTolerances.slippage);
        require(maxRedeemOutput >= withdrawAmount, "redeem delta out of tolerance");

        // Get value in imAssets.
        uint256 credits = imAsset.underlyingToCredits(withdrawAmount);

        // Check that we have enough v-imAsset.
        require(vimAsset.balanceOf(address(this)) >= credits, "insufficient credits to redeem");

        // Unstake v-imAsset.
        vimAsset.withdraw(credits);

        // Redeem imAsset to underlying mAsset.
        imAsset.redeemCredits(credits);

        // Redeem mAsset to backing asset (bAsset).
        outputAmount = mAsset.redeem(
            address(bAsset), // address _output
            withdrawAmount, // uint256 _mAssetQuantity
            amount, // uint256 _minOutputQuantity
            address(this) // address _recipient
        );

        assert(outputAmount >= amount);
    }

    /// @dev Returns the vault's free-floating balance of the underlying basket asset.
    /// @return Balance of the vault.
    function _underlyingBalance() internal view returns (uint256) {
        return bAsset.balanceOf(address(this));
    }

    /// @dev Calculates the amount of tokens to issue in exchange for some underlying.
    /// @param mintAmount Underlying amount to supply.
    /// @return mintTokens Amount of tokens to mint.
    function _calcMintTokens(uint256 mintAmount) internal view returns (uint256 mintTokens) {
        uint256 scaledMintAmount = mintAmount * precisionMultiplier;

        mintTokens = FixedPointMath.toUFixed256x18(scaledMintAmount).div(exchangeRate()).floor();
    }

    /// @dev Calculates the amount of underlying to redeem in exchange for the vault's tokens.
    /// @param redeemTokens Token amount to supply.
    /// @return redeemAmount Amount of underlying to redeem, in exchange for the given tokens.
    function _calcRedeemAmount(uint256 redeemTokens) internal view returns (uint256 redeemAmount) {
        uint256 redeemAmountScaled = exchangeRate().mul(redeemTokens).floor();

        redeemAmount = redeemAmountScaled / precisionMultiplier;
    }

    /// @dev Returns the total value stored in the strategy in the underlying basket asset.
    /// @return strategyValue Value of the strategy.
    function _getStrategyValue() internal view virtual returns (uint256 strategyValue) {
        // Get the balance of both staked and unstaked credits.
        uint256 credits = vimAsset.balanceOf(address(this)) + imAsset.balanceOf(address(this));

        uint256 mAssetBalance = mAsset.balanceOf(address(this));

        if (credits > 0) {
            // Get the value of the credits in mAssets.
            mAssetBalance += imAsset.creditsToUnderlying(credits);
        }

        if (mAssetBalance > 0) {
            // Get bAsset (e.g. USDC) value of mAsset (mUSD) when redeemed.
            strategyValue = mAsset.getRedeemOutput(address(bAsset), mAssetBalance);
        } else {
            strategyValue = 0;
        }
    }

    /// @dev Returns the current redemption fee of the underlying strategy.
    /// @return redemptionFee Redemption fee in scaled basis points (bps * 1e14).
    function _getStrategyRedemptionFee() internal view returns (uint64 redemptionFee) {
        redemptionFee = mAsset.data().redemptionFee.toUint64();
    }

    /// @dev Calculates the amount of meta asset to redeem to receive the given amount of underlying basket asset.
    /// @param bAssetQuantity Target amount of underlying.
    /// @return mAssetAmount Amount of meta asset to redeem.
    function _calcStrategyRedeemAmount(uint256 bAssetQuantity) internal view returns (uint256 mAssetAmount) {
        uint256[] memory bAssetQuantities = new uint256[](1);
        address[] memory bAssets = new address[](1);
        bAssetQuantities[0] = bAssetQuantity;
        bAssets[0] = address(bAsset);

        mAssetAmount = mAsset.getRedeemExactBassetsOutput(bAssets, bAssetQuantities) + 1; // Compensate for rounding errors.
    }
}
