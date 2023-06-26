# Nitro Testnode

## General

Nitro-testnode brings up a full environment for local nitro testing including a dev-mode geth L1, and multiple instances with different roles.

### Requirements

* bash shell
* docker and docker-compose

All must be installed in PATH.

## Usage

### Using latest nitro release

Check out the release branch of the repository.
> Notice: release branch may be force-pushed at any time.

```bash
git clone -b release https://github.com/OffchainLabs/nitro-testnode.git
cd nitro-testnode
```

Initialize the node

```bash
./test-node.bash --init
```
To see more options, use `--help`.

### Using current nitro code

Check out the nitro repository. Use the test-node submodule of nitro repository.
> Notice: testnode may not always be up-to-date with config options of current nitro node, and is not considered stable when operated in that way.

```bash
git clone --recurse-submodules https://github.com/OffchainLabs/nitro.git
cd nitro/nitro-testnode
```

Initialize the node in dev-mode

```bash
./test-node.bash --init --dev
```
To see more options, use `--help`.

### Working with docker containers

**sequencer** is the main docker to be used to access the nitro testchain. It's http and websocket interfaces are exposed at localhost ports 8547 and 8548 ports, respectively.

Stopping, restarting nodes can be done with docker-compose.

### Helper scripts

Some helper scripts are provided for simple testing of basic actions. For help, see:

```bash
./test-node.bash script --help
```

## Contact

Discord - [Arbitrum](https://discord.com/invite/5KE54JwyTs)

Twitter: [Arbitrum](https://twitter.com/arbitrum)


