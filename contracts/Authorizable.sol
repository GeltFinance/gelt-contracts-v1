// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./lib/EIP712Domain.sol";
import "./lib/EIP712.sol";

/// @title Abstract contract to allow for executing operations using signed authorizations.
/// @dev Implements meta-transactions as specified in https://eips.ethereum.org/EIPS/eip-3009.
abstract contract Authorizable is Initializable, EIP712Domain {
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH = keccak256("CancelAuthorization(address authorizer,bytes32 nonce)");

    /// @dev Authorizer address => nonce => bool (true if nonce is used)
    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event AuthorizationCanceled(
        address indexed authorizer,
        bytes32 indexed nonce
    );

    function __Authorizable_init(string memory name, string memory version) internal onlyInitializing {
        __Authorizable_init_unchained(name, version);
    }

    function __Authorizable_init_unchained(string memory name, string memory version) internal onlyInitializing {
        DOMAIN_SEPARATOR = EIP712.makeDomainSeparator(name, version);
    }

    /// @notice Returns the state of an authorization.
    /// @param authorizer Authorizer's address.
    /// @param nonce Unique nonce of the authorization.
    /// @return True if the nonce is used, false otherwise.
    function authorizationState(address authorizer, bytes32 nonce)
        external
        view
        returns (bool)
    {
        return _authorizationStates[authorizer][nonce];
    }

    /// @notice Attempts to cancel an authorization.
    /// @param authorizer Authorizer's address.
    /// @param nonce Unique nonce of the authorization.
    /// @param v Meta-transaction signature's `v` component.
    /// @param r Meta-transaction signature's `r` component.
    /// @param s Meta-transaction signature's `s` component.
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _requireUnusedAuthorization(authorizer, nonce);

        bytes memory data = abi.encode(
            CANCEL_AUTHORIZATION_TYPEHASH,
            authorizer,
            nonce
        );
        require(
            EIP712.recover(DOMAIN_SEPARATOR, v, r, s, data) == authorizer,
            "Authorizable: invalid signature"
        );

        _authorizationStates[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }

    /// @dev Checks that the authorization is valid.
    function _requireValidAuthorization(
        address authorizer,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    )
        internal
        view
    {
        // Require timestamps to be valid.
        require(
            block.timestamp > validAfter,
            "Authorizable: authorization is not yet valid"
        );
        require(
            block.timestamp < validBefore,
            "Authorizable: authorization is expired"
        );

        _requireUnusedAuthorization(authorizer, nonce);
    }

    /// @dev Checks that the signature is valid.
    function _requireValidSignature(
        address authorizer,
        bytes memory data,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        internal
        view
    {
        require(
            EIP712.recover(DOMAIN_SEPARATOR, v, r, s, data) == authorizer,
            "Authorizable: invalid signature"
        );
    }

    /// @dev Marks an authorization as used.
    function _markAuthorizationAsUsed(address authorizer, bytes32 nonce)
        internal
    {
        _authorizationStates[authorizer][nonce] = true;
        emit AuthorizationUsed(authorizer, nonce);
    }

    /// @dev Checks if an authorization has already been unused.
    function _requireUnusedAuthorization(address authorizer, bytes32 nonce)
        private
        view
    {
        require(
            !_authorizationStates[authorizer][nonce],
            "Authorizable: authorization is used or canceled"
        );
    }

    uint256[49] private __gap;
}
