Feature: Gelt Vault

  Scenario Outline: A user deposits funds to the vault
    Given the user has ${amount} USDC
    And the user approves the Vault to access ${amount} USDC
    When the operator mints supplying ${amount} USDC with the user's signed authorisation
    Then the user should receive ${token} gUSDC
    When the operator deposits ${amount} USDC to the strategy
    Then the total value of the strategy is approximately ${strategyValue} USDC

    Examples:
      | amount | token   | strategyValue
      | 1000   | 100000  | 999.4
      | 10000  | 1000000 | 9994


  Scenario Outline: A user redeems from the Vault
    Given the user minted by depositing ${mintAmount} USDC to the Vault
    And ${interest} mUSD total interest has been accumulated by the strategy
    When the operator withdraws ${redeemAmount} USDC from the strategy
    And the operator redeems ${redeemAmount} USDC worth of gUSDC with the user's signed authorisation
    Then the user should receive ${redeemAmount} USDC

    Examples:
      | mintAmount | interest | redeemAmount
      | 1000       | 20000    | 1001
      | 10000      | 20000    | 10002


  Scenario Outline: User voluntarily exits the Vault
    Given the user minted by depositing ${mintAmount} USDC to the Vault
    When the user voluntarily exists the Vault
    Then the user should receive approximately ${redeemAmount} USDC

    Examples:
      | mintAmount | redeemAmount
      | 1000       | 999
      | 10000      | 9988  
