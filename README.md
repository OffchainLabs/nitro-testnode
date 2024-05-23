# Nitro Testnode

Nitro-testnode brings up a full environment for local nitro testing (with or without Stylus support) including a dev-mode geth L1, and multiple instances with different roles.

### Requirements

* bash shell
* docker and docker-compose

All must be installed in PATH.

## Using latest nitro release (recommended)

### Without Stylus support

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

### With Stylus support

Check out the stylus branch of the repository.
> Notice: stylus branch may be force-pushed at any time.

```bash
git clone -b stylus --recurse-submodules https://github.com/OffchainLabs/nitro-testnode.git
cd nitro-testnode
```

Initialize the node

```bash
./test-node.bash --init
```
To see more options, use `--help`.

## Using current nitro code (local compilation)

Check out the nitro or stylus repository. Use the test-node submodule of nitro repository.

> Notice: testnode may not always be up-to-date with config options of current nitro node, and is not considered stable when operated in that way.

### Without Stylus support
```bash
git clone --recurse-submodules https://github.com/OffchainLabs/nitro.git
cd nitro/nitro-testnode
```

Initialize the node in dev-mode (this will build the docker images from source)
```bash
./test-node.bash --init --dev
```
To see more options, use `--help`.

### With Stylus support
```bash
git clone --recurse-submodules https://github.com/OffchainLabs/stylus.git
cd stylus/nitro-testnode
```

Initialize the node in dev-mode (this will build the docker images from source)
```bash
./test-node.bash --init --dev
```
To see more options, use `--help`.

## Further information

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

Here is a list of address that are used in the testnode setup, avoid using them before the deployment finishes or you might end up with some nonce race.

```bash
./test-node.bash script print-address --account <name>
./test-node.bash script print-private-key --account <name>
```

```
sequencer:                  0xe2148eE53c0755215Df69b2616E552154EdC584f
validator:                  0x6A568afe0f82d34759347bb36F14A6bB171d2CBe
l2owner:                    0x5E1497dD1f08C87b2d8FE23e9AAB6c1De833D927
l3owner:                    0x863c904166E801527125D8672442D736194A3362
l3sequencer:                0x3E6134aAD4C4d422FF2A4391Dc315c4DDf98D1a5
user_l1traffic:             0xa2db25762CFdF7bAF602F3Bcf2ec534937725f00
user_l1traffic_b:           0xacC305CaCB4605Aa1975001e24D25F7A5d11dC61
user_l2traffic:             0x7641C76365faC5090d315410358073D4ba199c57
user_l2traffic_b:           0x0d25ca3B2c4b8e8c9fe4104Fbd6D37B9563FdaE4
user_token_bridge_deployer: 0x3EaCb30f025630857aDffac9B2366F953eFE4F98
user_fee_token_deployer:    0x2AC5278D230f88B481bBE4A94751d7188ef48Ca2
```

While not a named account, 0x3f1eae7d46d88f08fc2f8ed27fcb2ab183eb2d0e is funded on all test chains and is used to fund other accounts.

The following account is funded on all L1, L2, and L3 and can be used for testing without risk of nonce race from testnode setup:
```
user_user:                  0xC3Aa24dA923c30BD0738111c458ec68A8FdC2dfD
```

## Deployment status

- L2 and L3 are deployed when their respective RPC are avaliable (port 8545 and 3347)
- L2 token bridge is deployed if `docker-compose run --entrypoint sh tokenbridge -c "cat l1l2_network.json"` returns a valid json.
- L3 token bridge is deployed if `docker-compose run --entrypoint sh tokenbridge -c "cat l2l3_network.json"` returns a valid json.

## Contact

Discord - [Arbitrum](https://discord.com/invite/5KE54JwyTs)

Twitter: [Arbitrum](https://twitter.com/arbitrum)


