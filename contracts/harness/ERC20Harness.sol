// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";

contract ERC20Harness is ERC20PresetFixedSupply {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner,
        uint8 decimals_
    ) ERC20PresetFixedSupply(name, symbol, initialSupply, owner) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @dev Added for compatibility with `IVaultedInterestBearingMasset`.
    function getRewardToken() public pure returns (address) {
        return address(0);
    }

    /// @dev Added for compatibility with `IVaultedInterestBearingMasset`.
    function getPlatformToken() public pure returns (address) {
        return address(0);
    }
}
