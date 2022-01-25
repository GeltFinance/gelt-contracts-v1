[![Gelt logo](https://gelt.finance/img/logos/gelt.svg)](https://gelt.finance)

[![CI](https://github.com/GeltFinance/gelt-contracts-v1/actions/workflows/ci.yml/badge.svg)](https://github.com/GeltFinance/gelt-contracts-v1/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-green.svg)](https://www.gnu.org/licenses/agpl-3.0)
![Version](https://img.shields.io/badge/Version-v1-blue)

# Gelt Contracts

This repository contains all the smart contracts and tests relevant to the DeFi backend of Gelt's high-yield savings product.

The `main` branch contains the tested, audited and deployed contracts on the Polygon Mainnet.

| Contract      | Address |
|---------------|---------|
| Gelt Vault V1 | _TBA_   |

## Repository structure

| Folder          | Purpose                                                                                                                                                                                                                                           |
|-----------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `contracts/`    | Solidity contracts and interfaces for the Gelt Vault.                                                                                                                                                                                             |
|  `lib/`         | Supporting libraries (e.g. fixed-point math).                                                                                                                                                                                                     |
|  `interface/`   | Interfaces for the Vault and the protocols it interacts with.                                                                                                                                                                                     |
|  `harness/`     | Contracts used by the test suites.                                                                                                                                                                                                                |
| `docs/`         | Diagrams and documentation for the Gelt Vault and ancillary services.                                                                                                                                                                             |
| `tests/`        | BDD-style test suites.                                                                                                                                                                                                                            |
|  `unit/`        | Unit tests running against a local network.                                                                                                                                                                                                       |
|  `scenario/`    | Scenario tests simulating Vault interactions running against a local network.                                                                                                                                                                     |
|  `integration/` | Integration tests running against a forked network.                                                                                                                                                                                               |
|  `functional/`  | Functional tests defined using Gherkin syntax running against a forked network.                                                                                                                                                                   |
| `patches/`      | Patch for `@openzeppelin/upgrades-core:1.11.0` adding preliminary support for [user-defined value types](https://blog.soliditylang.org/2021/09/27/user-defined-value-types/#:~:text=Solidity%20v0.,type%20safety%20and%20improves%20readability). |

## Development

### Prerequisites

- Node.js v16.13.0 LTS or later

### Installing dependencies

```shell
npm install
```

### Running tests

The contracts are tested using unit, scenario, integration and functional test suites.

All unit and scenario tests are executed against contracts deployed on a blank local network, while integration and functional
tests are run against a local fork of the Polygon Mainnet allowing the tests and the Gelt Vault to interact with deployed protocols, such as [mStable](https://mstable.org/).

#### Configuration

As integration and functional tests rely on a forked state of the Polygon Mainnet, in order to run these tests,
a valid Alchemy access token must be specified using the `ALCHEMY_ACCESS_TOKEN` environment variable in the [`.env`](.env) file.

#### Running all tests suites

```shell
npm test
```

#### Running individual test suites

To run unit tests:

```shell 
npm run test:unit
```

To run scenario tests:

```shell 
npm run test:scenario
```

To run integration tests (requires Alchemy access token present in [`.env`](.env)):

```shell 
npm run test:integration
```

To run functional tests (requires Alchemy access token present in [`.env`](.env)):

```shell
npm run test:functional
```

### Generating documentation

Solidity contracts are annotated with NatSpec comments which provide rich documentation for functions, return variables and more. 

These can be turned into a documentation by running

```shell
npm run docgen 
```

The resulting documentation will be available in the [`docs/contracts/`](docs/contracts) folder. 
