# Nitro Testnode

Nitro-testnode brings up a full environment for local nitro testing (with Stylus support) including a dev-mode geth L1, and multiple instances with different roles.

### Requirements

* bash shell
* docker and docker-compose

All must be installed in PATH.

## Using latest nitro release (recommended)

Check out the release branch of the repository.

> Notice: release branch may be force-pushed at any time.

```bash
git clone -b release --recurse-submodules https://github.com/OffchainLabs/nitro-testnode.git
cd nitro-testnode
```

Initialize the node

```bash
./test-node.bash --init
```
To see more options, use `--help`.

## Using current nitro code (local compilation)

Check out the nitro repository. Use the test-node submodule of nitro repository.

> Notice: testnode may not always be up-to-date with config options of current nitro node, and is not considered stable when operated in that way.

```bash
git clone --recurse-submodules https://github.com/OffchainLabs/nitro.git
cd nitro/nitro-testnode
```

Initialize the node in dev-mode (this will build the docker images from source)
```bash
./test-node.bash --init --dev
```
To see more options, use `--help`.

## Further information

### Branch Selection Guide (for devs working *on* nitro-testnode)

This repository maintains two main branches with distinct purposes.

#### `release` branch

Target branch for changes that should be immediately available to external users.

**Examples of changes for `release`:**
* Bug fixes for existing functionality
* Documentation improvements
* Updates to support newly released Nitro features
* Configuration updates for published Nitro releases

> 💡 Changes here will later be merged into `master`

#### `master` branch

Target branch for changes supporting unreleased Nitro features.

**Examples of changes for `master`:**
* Support for new configuration options being developed in Nitro
* Integration tests for upcoming Nitro features
* Breaking changes that depend on unreleased Nitro versions

> 💡 Changes here will be merged into `release` when the corresponding Nitro features are released

#### Branch Flow

##### For immediate public consumption
1. Push to `release`
2. Later merge into `master`

##### For unreleased Nitro features
1. Push to `master`
2. Merge into `release` when the feature is released


### Working with docker containers

**sequencer** is the main docker to be used to access the nitro testchain. It's http and websocket interfaces are exposed at localhost ports 8547 and 8548 ports, respectively.

Stopping, restarting nodes can be done with docker-compose.

### Helper scripts

Some helper scripts are provided for simple testing of basic actions.

To fund the address 0x1111222233334444555566667777888899990000 on l2, use:

```bash
./test-node.bash script send-l2 --to address_0x1111222233334444555566667777888899990000
```

For help and further scripts, see:

```bash
./test-node.bash script --help
```

## Named accounts

```bash
./test-node.bash script print-address --account sequencer
```
```
sequencer:                  0xe2148eE53c0755215Df69b2616E552154EdC584f
validator:                  0x6A568afe0f82d34759347bb36F14A6bB171d2CBe
l2owner:                    0x5E1497dD1f08C87b2d8FE23e9AAB6c1De833D927
l3owner:                    0x863c904166E801527125D8672442D736194A3362
l3sequencer:                0x3E6134aAD4C4d422FF2A4391Dc315c4DDf98D1a5
user_l1user:                0x058E6C774025ade66153C65672219191c72c7095
user_token_bridge_deployer: 0x3EaCb30f025630857aDffac9B2366F953eFE4F98
user_fee_token_deployer:    0x2AC5278D230f88B481bBE4A94751d7188ef48Ca2
```

While not a named account, 0x3f1eae7d46d88f08fc2f8ed27fcb2ab183eb2d0e is funded on all test chains.

## Metrics

To run the metrics stack (Prometheus + Grafana) read the instructions in the [metrics/README.md](metrics/README.md) file.

## Contact

Discord - [Arbitrum](https://discord.com/invite/5KE54JwyTs)

Twitter: [Arbitrum](https://twitter.com/arbitrum)


