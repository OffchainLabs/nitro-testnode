import * as fs from 'fs';
import * as consts from './consts'
import { ethers } from "ethers";
import { namedAccount, namedAddress } from './accounts'

const path = require("path");

function writePrysmConfig(argv: any) {
    const prysm = `
CONFIG_NAME: interop
PRESET_BASE: interop

# Genesis
GENESIS_FORK_VERSION: 0x20000089

# Altair
ALTAIR_FORK_EPOCH: 0
ALTAIR_FORK_VERSION: 0x20000090

# Merge
BELLATRIX_FORK_EPOCH: 0
BELLATRIX_FORK_VERSION: 0x20000091
TERMINAL_TOTAL_DIFFICULTY: 50

# Capella
CAPELLA_FORK_EPOCH: 0
CAPELLA_FORK_VERSION: 0x20000092
MAX_WITHDRAWALS_PER_PAYLOAD: 16

# DENEB
DENEB_FORK_EPOCH: 0
DENEB_FORK_VERSION: 0x20000093

# ELECTRA
ELECTRA_FORK_VERSION: 0x20000094

# FULU
FULU_FORK_VERSION: 0x20000095

# Time parameters
SECONDS_PER_SLOT: 2
SLOTS_PER_EPOCH: 6

# Deposit contract
DEPOSIT_CONTRACT_ADDRESS: 0x4242424242424242424242424242424242424242
    `
    fs.writeFileSync(path.join(consts.configpath, "prysm.yaml"), prysm)
}

function writeGethGenesisConfig(argv: any) {
    const gethConfig = `
    {
        "config": {
            "ChainName": "l1_chain",
                "chainId": 1337,
                "homesteadBlock": 0,
                "daoForkSupport": true,
                "eip150Block": 0,
                "eip150Hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
                "eip155Block": 0,
                "eip158Block": 0,
                "byzantiumBlock": 0,
                "constantinopleBlock": 0,
                "petersburgBlock": 0,
                "istanbulBlock": 0,
                "muirGlacierBlock": 0,
                "berlinBlock": 0,
                "londonBlock": 0,
                "terminalBlockHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
                "arrowGlacierBlock": 0,
                "grayGlacierBlock": 0,
                "shanghaiTime": 0,
                "cancunTime": 1706778826,
                "terminalTotalDifficulty": 0,
                "terminalTotalDifficultyPassed": true,
                "blobSchedule": {
                    "cancun": {
                        "target": 3,
                        "max": 6,
                        "baseFeeUpdateFraction": 3338477
                    }
                }
        },
        "difficulty": "0",
        "extradata": "0x00000000000000000000000000000000000000000000000000000000000000003f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E0B0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        "nonce": "0x42",
        "timestamp": "0x0",
        "gasLimit": "0x1C9C380",
        "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "alloc": {
        "0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E": {
          "balance": "1000000000000000000000000000000000"
        },
        "0x4242424242424242424242424242424242424242": {
            "balance": "0",
                "code": "0x60806040526004361061003f5760003560e01c806301ffc9a71461004457806322895118146100b6578063621fd130146101e3578063c5f2892f14610273575b600080fd5b34801561005057600080fd5b5061009c6004803603602081101561006757600080fd5b8101908080357bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916906020019092919050505061029e565b604051808215151515815260200191505060405180910390f35b6101e1600480360360808110156100cc57600080fd5b81019080803590602001906401000000008111156100e957600080fd5b8201836020820111156100fb57600080fd5b8035906020019184600183028401116401000000008311171561011d57600080fd5b90919293919293908035906020019064010000000081111561013e57600080fd5b82018360208201111561015057600080fd5b8035906020019184600183028401116401000000008311171561017257600080fd5b90919293919293908035906020019064010000000081111561019357600080fd5b8201836020820111156101a557600080fd5b803590602001918460018302840111640100000000831117156101c757600080fd5b909192939192939080359060200190929190505050610370565b005b3480156101ef57600080fd5b506101f8610fd0565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561023857808201518184015260208101905061021d565b50505050905090810190601f1680156102655780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561027f57600080fd5b50610288610fe2565b6040518082815260200191505060405180910390f35b60007f01ffc9a7000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916148061036957507f85640907000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916145b9050919050565b603087879050146103cc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260268152602001806116ec6026913960400191505060405180910390fd5b60208585905014610428576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260368152602001806116836036913960400191505060405180910390fd5b60608383905014610484576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252602981526020018061175f6029913960400191505060405180910390fd5b670de0b6b3a76400003410156104e5576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260268152602001806117396026913960400191505060405180910390fd5b6000633b9aca0034816104f457fe5b061461054b576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260338152602001806116b96033913960400191505060405180910390fd5b6000633b9aca00348161055a57fe5b04905067ffffffffffffffff80168111156105c0576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260278152602001806117126027913960400191505060405180910390fd5b60606105cb82611314565b90507f649bbc62d0e31342afea4e5cd82d4049e7e1ee912fc0889aa790803be39038c589898989858a8a610600602054611314565b60405180806020018060200180602001806020018060200186810386528e8e82818152602001925080828437600081840152601f19601f82011690508083019250505086810385528c8c82818152602001925080828437600081840152601f19601f82011690508083019250505086810384528a818151815260200191508051906020019080838360005b838110156106a657808201518184015260208101905061068b565b50505050905090810190601f1680156106d35780820380516001836020036101000a031916815260200191505b508681038352898982818152602001925080828437600081840152601f19601f820116905080830192505050868103825287818151815260200191508051906020019080838360005b8381101561073757808201518184015260208101905061071c565b50505050905090810190601f1680156107645780820380516001836020036101000a031916815260200191505b509d505050505050505050505050505060405180910390a1600060028a8a600060801b6040516020018084848082843780830192505050826fffffffffffffffffffffffffffffffff19166fffffffffffffffffffffffffffffffff1916815260100193505050506040516020818303038152906040526040518082805190602001908083835b6020831061080e57805182526020820191506020810190506020830392506107eb565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa158015610850573d6000803e3d6000fd5b5050506040513d602081101561086557600080fd5b8101908080519060200190929190505050905060006002808888600090604092610891939291906115da565b6040516020018083838082843780830192505050925050506040516020818303038152906040526040518082805190602001908083835b602083106108eb57805182526020820191506020810190506020830392506108c8565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa15801561092d573d6000803e3d6000fd5b5050506040513d602081101561094257600080fd5b8101908080519060200190929190505050600289896040908092610968939291906115da565b6000801b604051602001808484808284378083019250505082815260200193505050506040516020818303038152906040526040518082805190602001908083835b602083106109cd57805182526020820191506020810190506020830392506109aa565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa158015610a0f573d6000803e3d6000fd5b5050506040513d6020811015610a2457600080fd5b810190808051906020019092919050505060405160200180838152602001828152602001925050506040516020818303038152906040526040518082805190602001908083835b60208310610a8e5780518252602082019150602081019050602083039250610a6b565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa158015610ad0573d6000803e3d6000fd5b5050506040513d6020811015610ae557600080fd5b810190808051906020019092919050505090506000600280848c8c604051602001808481526020018383808284378083019250505093505050506040516020818303038152906040526040518082805190602001908083835b60208310610b615780518252602082019150602081019050602083039250610b3e565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa158015610ba3573d6000803e3d6000fd5b5050506040513d6020811015610bb857600080fd5b8101908080519060200190929190505050600286600060401b866040516020018084805190602001908083835b60208310610c085780518252602082019150602081019050602083039250610be5565b6001836020036101000a0380198251168184511680821785525050505050509050018367ffffffffffffffff191667ffffffffffffffff1916815260180182815260200193505050506040516020818303038152906040526040518082805190602001908083835b60208310610c935780518252602082019150602081019050602083039250610c70565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa158015610cd5573d6000803e3d6000fd5b5050506040513d6020811015610cea57600080fd5b810190808051906020019092919050505060405160200180838152602001828152602001925050506040516020818303038152906040526040518082805190602001908083835b60208310610d545780518252602082019150602081019050602083039250610d31565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa158015610d96573d6000803e3d6000fd5b5050506040513d6020811015610dab57600080fd5b81019080805190602001909291905050509050858114610e16576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252605481526020018061162f6054913960600191505060405180910390fd5b6001602060020a0360205410610e77576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252602181526020018061160e6021913960400191505060405180910390fd5b60016020600082825401925050819055506000602054905060008090505b6020811015610fb75760018083161415610ec8578260008260208110610eb757fe5b018190555050505050505050610fc7565b600260008260208110610ed757fe5b01548460405160200180838152602001828152602001925050506040516020818303038152906040526040518082805190602001908083835b60208310610f335780518252602082019150602081019050602083039250610f10565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa158015610f75573d6000803e3d6000fd5b5050506040513d6020811015610f8a57600080fd5b8101908080519060200190929190505050925060028281610fa757fe5b0491508080600101915050610e95565b506000610fc057fe5b5050505050505b50505050505050565b6060610fdd602054611314565b905090565b6000806000602054905060008090505b60208110156111d057600180831614156110e05760026000826020811061101557fe5b01548460405160200180838152602001828152602001925050506040516020818303038152906040526040518082805190602001908083835b60208310611071578051825260208201915060208101905060208303925061104e565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa1580156110b3573d6000803e3d6000fd5b5050506040513d60208110156110c857600080fd5b810190808051906020019092919050505092506111b6565b600283602183602081106110f057fe5b015460405160200180838152602001828152602001925050506040516020818303038152906040526040518082805190602001908083835b6020831061114b5780518252602082019150602081019050602083039250611128565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa15801561118d573d6000803e3d6000fd5b5050506040513d60208110156111a257600080fd5b810190808051906020019092919050505092505b600282816111c057fe5b0491508080600101915050610ff2565b506002826111df602054611314565b600060401b6040516020018084815260200183805190602001908083835b6020831061122057805182526020820191506020810190506020830392506111fd565b6001836020036101000a0380198251168184511680821785525050505050509050018267ffffffffffffffff191667ffffffffffffffff1916815260180193505050506040516020818303038152906040526040518082805190602001908083835b602083106112a55780518252602082019150602081019050602083039250611282565b6001836020036101000a038019825116818451168082178552505050505050905001915050602060405180830381855afa1580156112e7573d6000803e3d6000fd5b5050506040513d60208110156112fc57600080fd5b81019080805190602001909291905050509250505090565b6060600867ffffffffffffffff8111801561132e57600080fd5b506040519080825280601f01601f1916602001820160405280156113615781602001600182028036833780820191505090505b50905060008260c01b90508060076008811061137957fe5b1a60f81b8260008151811061138a57fe5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350806006600881106113c657fe5b1a60f81b826001815181106113d757fe5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a9053508060056008811061141357fe5b1a60f81b8260028151811061142457fe5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a9053508060046008811061146057fe5b1a60f81b8260038151811061147157fe5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350806003600881106114ad57fe5b1a60f81b826004815181106114be57fe5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350806002600881106114fa57fe5b1a60f81b8260058151811061150b57fe5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a9053508060016008811061154757fe5b1a60f81b8260068151811061155857fe5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a9053508060006008811061159457fe5b1a60f81b826007815181106115a557fe5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a90535050919050565b600080858511156115ea57600080fd5b838611156115f757600080fd5b600185028301915084860390509450949250505056fe4465706f736974436f6e74726163743a206d65726b6c6520747265652066756c6c4465706f736974436f6e74726163743a207265636f6e7374727563746564204465706f7369744461746120646f6573206e6f74206d6174636820737570706c696564206465706f7369745f646174615f726f6f744465706f736974436f6e74726163743a20696e76616c6964207769746864726177616c5f63726564656e7469616c73206c656e6774684465706f736974436f6e74726163743a206465706f7369742076616c7565206e6f74206d756c7469706c65206f6620677765694465706f736974436f6e74726163743a20696e76616c6964207075626b6579206c656e6774684465706f736974436f6e74726163743a206465706f7369742076616c756520746f6f20686967684465706f736974436f6e74726163743a206465706f7369742076616c756520746f6f206c6f774465706f736974436f6e74726163743a20696e76616c6964207369676e6174757265206c656e677468a2646970667358221220230afd4b6e3551329e50f1239e08fa3ab7907b77403c4f237d9adf679e8e43cf64736f6c634300060b0033"
        },
        "0x123463a4B065722E99115D6c222f267d9cABb524": {
            "balance": "20000000000000000000000"
        },
        "0x5678E9E827B3be0E3d4b910126a64a697a148267": {
            "balance": "20000000000000000000000"
        },
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": {
            "balance": "10000000000000000000000"
        },
        "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": {
            "balance": "10000000000000000000000"
        },
        "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": {
            "balance": "10000000000000000000000"
        },
        "0x90f79bf6eb2c4f870365e785982e1f101e93b906": {
            "balance": "10000000000000000000000"
        },
        "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65": {
            "balance": "10000000000000000000000"
        },
        "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc": {
            "balance": "10000000000000000000000"
        },
        "0x976ea74026e726554db657fa54763abd0c3a0aa9": {
            "balance": "10000000000000000000000"
        },
        "0x14dc79964da2c08b23698b3d3cc7ca32193d9955": {
            "balance": "10000000000000000000000"
        },
        "0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f": {
            "balance": "10000000000000000000000"
        },
        "0xa0ee7a142d267c1f36714e4a8f75612f20a79720": {
            "balance": "10000000000000000000000"
        },
        "0xbcd4042de499d14e55001ccbb24a551f3b954096": {
            "balance": "10000000000000000000000"
        },
        "0x71be63f3384f5fb98995898a86b02fb2426c5788": {
            "balance": "10000000000000000000000"
        },
        "0xfabb0ac9d68b0b445fb7357272ff202c5651694a": {
            "balance": "10000000000000000000000"
        },
        "0x1cbd3b2770909d4e10f157cabc84c7264073c9ec": {
            "balance": "10000000000000000000000"
        },
        "0xdf3e18d64bc6a983f673ab319ccae4f1a57c7097": {
            "balance": "10000000000000000000000"
        },
        "0xcd3b766ccdd6ae721141f452c550ca635964ce71": {
            "balance": "10000000000000000000000"
        },
        "0x2546bcd3c84621e976d8185a91a922ae77ecec30": {
            "balance": "10000000000000000000000"
        },
        "0xbda5747bfd65f08deb54cb465eb87d40e51b197e": {
            "balance": "10000000000000000000000"
        },
        "0xdd2fd4581271e230360230f9337d5c0430bf44c0": {
            "balance": "10000000000000000000000"
        },
        "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199": {
            "balance": "10000000000000000000000"
        }
    }
    }
    `
    fs.writeFileSync(path.join(consts.configpath, "geth_genesis.json"), gethConfig)
    const jwt = `0x98ea6e4f216f2fb4b69fff9b3a44842c38686ca685f3f55dc48c5d3fb1107be4`
    fs.writeFileSync(path.join(consts.configpath, "jwt.hex"), jwt)
    const val_jwt = `0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
    fs.writeFileSync(path.join(consts.configpath, "val_jwt.hex"), val_jwt)
}

type ChainInfo = {
    [key: string]: any;
};

// Define a function to return ChainInfo
function getChainInfo(): ChainInfo {
    const filePath = path.join(consts.configpath, "l2_chain_info.json");
    const fileContents = fs.readFileSync(filePath).toString();
    const chainInfo: ChainInfo = JSON.parse(fileContents);
    return chainInfo;
}

function writeConfigs(argv: any) {
    const valJwtSecret = path.join(consts.configpath, "val_jwt.hex")
    const chainInfoFile = path.join(consts.configpath, "l2_chain_info.json")
    let baseConfig = {
        "ensure-rollup-deployment": false,
        "parent-chain": {
            "connection": {
                "url": argv.l1url,
            },
        },
        "chain": {
            "id": 412346,
            "info-files": [chainInfoFile],
        },
        "node": {
            "bold": {
                "rpc-block-number": "latest",
                "strategy": "makeNodes",
                "assertion-posting-interval": "10s"
            },
            "staker": {
                "dangerous": {
                    "without-block-validator": false
                },
                "parent-chain-wallet": {
                    "account": namedAddress("validator"),
                    "password": consts.l1passphrase,
                    "pathname": consts.l1keystore,
                },
                "disable-challenge": false,
                "enable": false,
                "staker-interval": "10s",
                "make-assertion-interval": "10s",
                "strategy": "MakeNodes",
            },
            "sequencer": false,
            "dangerous": {
                "no-sequencer-coordinator": false,
                "disable-blob-reader": true,
            },
            "delayed-sequencer": {
                "enable": false
            },
            "seq-coordinator": {
                "enable": false,
                "redis-url": argv.redisUrl,
                "lockout-duration": "30s",
                "lockout-spare": "1s",
                "my-url": "",
                "retry-interval": "0.5s",
                "seq-num-duration": "24h0m0s",
                "update-interval": "3s",
            },
            "batch-poster": {
                "enable": false,
                "redis-url": argv.redisUrl,
                "max-delay": "30s",
                "l1-block-bound": "ignore",
                "parent-chain-wallet": {
                    "account": namedAddress("sequencer"),
                    "password": consts.l1passphrase,
                    "pathname": consts.l1keystore,
                },
                "data-poster": {
                    "redis-signer": {
                        "signing-key": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                    },
                    "wait-for-l1-finality": false
                }
            },
            "block-validator": {
                "validation-server": {
                    "url": argv.validationNodeUrl,
                    "jwtsecret": valJwtSecret,
                }
            },
            "data-availability": {
                "enable": argv.anytrust,
                "rpc-aggregator": dasBackendsJsonConfig(argv),
                "rest-aggregator": {
                    "enable": true,
                    "urls": ["http://das-mirror:9877"],
                },
                // TODO Fix das config to not need this redundant config
                "parent-chain-node-url": argv.l1url,
                "sequencer-inbox-address": "not_set"
            }
        },
        "execution": {
            "sequencer": {
                "enable": false
            },
            "forwarding-target": "null",
        },
        "persistent": {
            "chain": "local"
        },
        "ws": {
            "addr": "0.0.0.0"
        },
        "http": {
            "addr": "0.0.0.0",
            "vhosts": "*",
            "corsdomain": "*"
        },
    }

    baseConfig.node["data-availability"]["sequencer-inbox-address"] = ethers.utils.hexlify(getChainInfo()[0]["rollup"]["sequencer-inbox"]);

    const baseConfJSON = JSON.stringify(baseConfig)

    if (argv.simple) {
        let simpleConfig = JSON.parse(baseConfJSON)
        simpleConfig.node.staker.enable = true
        simpleConfig.node.staker["use-smart-contract-wallet"] = false // TODO: set to true when fixed
        simpleConfig.node.staker.dangerous["without-block-validator"] = true
        simpleConfig.node.sequencer = true
        simpleConfig.node.dangerous["no-sequencer-coordinator"] = true
        simpleConfig.node["delayed-sequencer"].enable = true
        simpleConfig.node["batch-poster"].enable = true
        simpleConfig.node["batch-poster"]["redis-url"] = ""
        simpleConfig.execution["sequencer"].enable = true
        if (argv.anytrust) {
            simpleConfig.node["data-availability"]["rpc-aggregator"].enable = true
        }
        fs.writeFileSync(path.join(consts.configpath, "sequencer_config.json"), JSON.stringify(simpleConfig))
    } else {
        let validatorConfig = JSON.parse(baseConfJSON)
        validatorConfig.node.staker.enable = true
        validatorConfig.node.staker["use-smart-contract-wallet"] = false // TODO: set to true when fixed
        let validconfJSON = JSON.stringify(validatorConfig)
        fs.writeFileSync(path.join(consts.configpath, "validator_config.json"), validconfJSON)

        let unsafeStakerConfig = JSON.parse(validconfJSON)
        unsafeStakerConfig.node.staker.dangerous["without-block-validator"] = true
        fs.writeFileSync(path.join(consts.configpath, "unsafe_staker_config.json"), JSON.stringify(unsafeStakerConfig))

        let sequencerConfig = JSON.parse(baseConfJSON)
        sequencerConfig.node.sequencer = true
        sequencerConfig.node["seq-coordinator"].enable = true
        sequencerConfig.execution["sequencer"].enable = true
        sequencerConfig.node["delayed-sequencer"].enable = true
        if (argv.timeboost) {
          sequencerConfig.execution.sequencer.dangerous = {};
          sequencerConfig.execution.sequencer.dangerous.timeboost = {
             "enable": false, // Create it false initially, turn it on with sed in test-node.bash after contract setup.
             "redis-url": argv.redisUrl
          };
        }
        fs.writeFileSync(path.join(consts.configpath, "sequencer_config.json"), JSON.stringify(sequencerConfig))

        let posterConfig = JSON.parse(baseConfJSON)
        posterConfig.node["seq-coordinator"].enable = true
        posterConfig.node["batch-poster"].enable = true
        if (argv.anytrust) {
            posterConfig.node["data-availability"]["rpc-aggregator"].enable = true
        }
        fs.writeFileSync(path.join(consts.configpath, "poster_config.json"), JSON.stringify(posterConfig))
    }

    let l3Config = JSON.parse(baseConfJSON)
    l3Config["parent-chain"].connection.url = argv.l2url
    // use the same account for l2 and l3 staker
    // l3Config.node.staker["parent-chain-wallet"].account = namedAddress("l3owner")
    l3Config.node["batch-poster"]["parent-chain-wallet"].account = namedAddress("l3sequencer")
    l3Config.chain.id = 333333
    const l3ChainInfoFile = path.join(consts.configpath, "l3_chain_info.json")
    l3Config.chain["info-files"] = [l3ChainInfoFile]
    l3Config.node.staker.enable = true
    l3Config.node.staker["use-smart-contract-wallet"] = false // TODO: set to true when fixed
    l3Config.node.sequencer = true
    l3Config.execution["sequencer"].enable = true
    l3Config.node["dangerous"]["no-sequencer-coordinator"] = true
    l3Config.node["delayed-sequencer"].enable = true
    l3Config.node["delayed-sequencer"]["finalize-distance"] = 0
    l3Config.node["delayed-sequencer"]["use-merge-finality"] = false
    l3Config.node["batch-poster"].enable = true
    l3Config.node["batch-poster"]["redis-url"] = ""
    fs.writeFileSync(path.join(consts.configpath, "l3node_config.json"), JSON.stringify(l3Config))

    let validationNodeConfig = JSON.parse(JSON.stringify({
        "persistent": {
            "chain": "local"
        },
        "ws": {
            "addr": "",
        },
        "http": {
            "addr": "",
        },
        "validation": {
            "api-auth": true,
            "api-public": false,
        },
        "auth": {
            "jwtsecret": valJwtSecret,
            "addr": "0.0.0.0",
        },
    }))
    fs.writeFileSync(path.join(consts.configpath, "validation_node_config.json"), JSON.stringify(validationNodeConfig))
}

function writeL2ChainConfig(argv: any) {
    const l2ChainConfig = {
        "chainId": 412346,
        "homesteadBlock": 0,
        "daoForkSupport": true,
        "eip150Block": 0,
        "eip150Hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "eip155Block": 0,
        "eip158Block": 0,
        "byzantiumBlock": 0,
        "constantinopleBlock": 0,
        "petersburgBlock": 0,
        "istanbulBlock": 0,
        "muirGlacierBlock": 0,
        "berlinBlock": 0,
        "londonBlock": 0,
        "clique": {
            "period": 0,
            "epoch": 0
        },
        "arbitrum": {
            "EnableArbOS": true,
            "AllowDebugPrecompiles": true,
            "DataAvailabilityCommittee": argv.anytrust,
            "InitialArbOSVersion": 32, // TODO For Timeboost, this still needs to be set to 31
            "InitialChainOwner": argv.l2owner,
            "GenesisBlockNum": 0
        }
    }
    const l2ChainConfigJSON = JSON.stringify(l2ChainConfig)
    fs.writeFileSync(path.join(consts.configpath, "l2_chain_config.json"), l2ChainConfigJSON)
}

function writeL3ChainConfig(argv: any) {
    const l3ChainConfig = {
        "chainId": 333333,
        "homesteadBlock": 0,
        "daoForkSupport": true,
        "eip150Block": 0,
        "eip150Hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "eip155Block": 0,
        "eip158Block": 0,
        "byzantiumBlock": 0,
        "constantinopleBlock": 0,
        "petersburgBlock": 0,
        "istanbulBlock": 0,
        "muirGlacierBlock": 0,
        "berlinBlock": 0,
        "londonBlock": 0,
        "clique": {
            "period": 0,
            "epoch": 0
        },
        "arbitrum": {
            "EnableArbOS": true,
            "AllowDebugPrecompiles": true,
            "DataAvailabilityCommittee": false,
            "InitialArbOSVersion": 32,
            "InitialChainOwner": argv.l2owner,
            "GenesisBlockNum": 0
        }
    }
    const l3ChainConfigJSON = JSON.stringify(l3ChainConfig)
    fs.writeFileSync(path.join(consts.configpath, "l3_chain_config.json"), l3ChainConfigJSON)
}

function writeL2DASCommitteeConfig(argv: any) {
    const sequencerInboxAddr = ethers.utils.hexlify(getChainInfo()[0]["rollup"]["sequencer-inbox"]);
    const l2DASCommitteeConfig = {
        "data-availability": {
            "key": {
                "key-dir": "/das/keys"
            },
            "local-file-storage": {
                "data-dir": "/das/data",
                "enable": true,
                "enable-expiry": true
            },
            "sequencer-inbox-address": sequencerInboxAddr,
            "parent-chain-node-url": argv.l1url
        },
        "enable-rest": true,
        "enable-rpc": true,
        "log-level": "INFO",
        "rest-addr": "0.0.0.0",
        "rest-port": "9877",
        "rpc-addr": "0.0.0.0",
        "rpc-port": "9876"
    }
    const l2DASCommitteeConfigJSON = JSON.stringify(l2DASCommitteeConfig)

    fs.writeFileSync(path.join(consts.configpath, "l2_das_committee.json"), l2DASCommitteeConfigJSON)
}

function writeL2DASMirrorConfig(argv: any, sequencerInboxAddr: string) {
    const l2DASMirrorConfig = {
        "data-availability": {
            "local-file-storage": {
                "data-dir": "/das/data",
                "enable": true,
                "enable-expiry": false
            },
            "sequencer-inbox-address": sequencerInboxAddr,
            "parent-chain-node-url": argv.l1url,
            "rest-aggregator": {
                "enable": true,
                "sync-to-storage": {
                    "eager": false,
                    "ignore-write-errors": false,
                    "state-dir": "/das/metadata",
                    "sync-expired-data": true
                },
                "urls": ["http://das-committee-a:9877", "http://das-committee-b:9877"],
            }
        },
        "enable-rest": true,
        "enable-rpc": false,
        "log-level": "INFO",
        "rest-addr": "0.0.0.0",
        "rest-port": "9877"
    }
    const l2DASMirrorConfigJSON = JSON.stringify(l2DASMirrorConfig)

    fs.writeFileSync(path.join(consts.configpath, "l2_das_mirror.json"), l2DASMirrorConfigJSON)
}

function writeL2DASKeysetConfig(argv: any) {
    const l2DASKeysetConfig = {
        "keyset": dasBackendsJsonConfig(argv)
    }
    const l2DASKeysetConfigJSON = JSON.stringify(l2DASKeysetConfig)

    fs.writeFileSync(path.join(consts.configpath, "l2_das_keyset.json"), l2DASKeysetConfigJSON)
}

function dasBackendsJsonConfig(argv: any) {
    const backends = {
        "enable": false,
        "assumed-honest": 1,
        "backends": [
            {
                "url": "http://das-committee-a:9876",
                "pubkey": argv.dasBlsA
            },
            {
                "url": "http://das-committee-b:9876",
                "pubkey": argv.dasBlsB
            }
        ]
    }
    return backends
}

export const writeTimeboostConfigsCommand = {
  command: "write-timeboost-configs",
  describe: "writes configs for the timeboost autonomous auctioneer and bid validator",
  builder: {
    "auction-contract": {
      string: true,
      describe: "auction contract address",
      demandOption: true
    },
  },
  handler: (argv: any) => {
    writeAutonomousAuctioneerConfig(argv)
    writeBidValidatorConfig(argv)
  }
}

function writeAutonomousAuctioneerConfig(argv: any) {
  const autonomousAuctioneerConfig = {
    "auctioneer-server": {
      "auction-contract-address": argv.auctionContract,
      "db-directory": "/data",
      "redis-url": "redis://redis:6379",
      "use-redis-coordinator": true,
      "redis-coordinator-url": "redis://redis:6379",
      "wallet":  {
        "account": namedAddress("auctioneer"),
        "password": consts.l1passphrase,
        "pathname": consts.l1keystore
      },
    },
    "bid-validator": {
      "enable": false
    }
  }
  const autonomousAuctioneerConfigJSON = JSON.stringify(autonomousAuctioneerConfig)
  fs.writeFileSync(path.join(consts.configpath, "autonomous_auctioneer_config.json"), autonomousAuctioneerConfigJSON)
}

function writeBidValidatorConfig(argv: any) {
  const bidValidatorConfig = {
    "auctioneer-server": {
      "enable": false
    },
    "bid-validator": {
      "auction-contract-address": argv.auctionContract,
      "redis-url": "redis://redis:6379",
      "sequencer-endpoint": "http://sequencer:8547"
    }
  }
  const bidValidatorConfigJSON = JSON.stringify(bidValidatorConfig)
  fs.writeFileSync(path.join(consts.configpath, "bid_validator_config.json"), bidValidatorConfigJSON)
}

export const writeConfigCommand = {
    command: "write-config",
    describe: "writes config files",
    builder: {
        simple: {
            boolean: true,
            describe: "simple config (sequencer is also poster, validator)",
            default: false,
        },
        anytrust: {
            boolean: true,
            describe: "run nodes in anytrust mode",
            default: false
        },
        dasBlsA: {
            string: true,
            describe: "DAS committee member A BLS pub key",
            default: ""
        },
        dasBlsB: {
            string: true,
            describe: "DAS committee member B BLS pub key",
            default: ""
        },
        timeboost: {
            boolean: true,
            describe: "run sequencer in timeboost mode",
            default: false
        },
    },
    handler: (argv: any) => {
        writeConfigs(argv)
    }
}

export const writePrysmCommand = {
    command: "write-prysm-config",
    describe: "writes prysm config files",
    handler: (argv: any) => {
        writePrysmConfig(argv)
    }
}

export const writeGethGenesisCommand = {
    command: "write-geth-genesis-config",
    describe: "writes a go-ethereum genesis configuration",
    handler: (argv: any) => {
        writeGethGenesisConfig(argv)
    }
}

export const writeL2ChainConfigCommand = {
    command: "write-l2-chain-config",
    describe: "writes l2 chain config file",
    builder: {
        anytrust: {
            boolean: true,
            describe: "enable anytrust in chainconfig",
            default: false
        },
    },
    handler: (argv: any) => {
        writeL2ChainConfig(argv)
    }
}

export const writeL3ChainConfigCommand = {
    command: "write-l3-chain-config",
    describe: "writes l3 chain config file",
    handler: (argv: any) => {
        writeL3ChainConfig(argv)
    }
}

export const writeL2DASCommitteeConfigCommand = {
    command: "write-l2-das-committee-config",
    describe: "writes daserver committee member config file",
    handler: (argv: any) => {
        writeL2DASCommitteeConfig(argv)
    }
}

export const writeL2DASMirrorConfigCommand = {
    command: "write-l2-das-mirror-config",
    describe: "writes daserver mirror config file",
    handler: (argv: any) => {
        const sequencerInboxAddr = ethers.utils.hexlify(getChainInfo()[0]["rollup"]["sequencer-inbox"]);
        writeL2DASMirrorConfig(argv, sequencerInboxAddr)
    }
}

export const writeL2DASKeysetConfigCommand = {
    command: "write-l2-das-keyset-config",
    describe: "writes DAS keyset config",
    builder: {
        dasBlsA: {
            string: true,
            describe: "DAS committee member A BLS pub key",
            default: ""
        },
        dasBlsB: {
            string: true,
            describe: "DAS committee member B BLS pub key",
            default: ""
        },
    },
    handler: (argv: any) => {
        writeL2DASKeysetConfig(argv)
    }
}

