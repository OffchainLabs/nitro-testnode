import { runStress } from "./stress";
import { BigNumber, ContractFactory, ethers, Wallet } from "ethers";
import * as consts from "./consts";
import { namedAccount, namedAddress } from "./accounts";
import * as L1GatewayRouter from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/ethereum/gateway/L1GatewayRouter.sol/L1GatewayRouter.json";
import * as L1AtomicTokenBridgeCreator from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/ethereum/L1AtomicTokenBridgeCreator.sol/L1AtomicTokenBridgeCreator.json";
import * as ERC20 from "@openzeppelin/contracts/build/contracts/ERC20.json";
import * as fs from "fs";
import { ARB_OWNER } from "./consts";
const path = require("path");

async function sendTransaction(argv: any, threadId: number) {
    const account = namedAccount(argv.from, threadId).connect(argv.provider)
    const startNonce = await account.getTransactionCount("pending")
    for (let index = 0; index < argv.times; index++) {
        const response = await 
            account.sendTransaction({
                to: namedAddress(argv.to, threadId),
                value: ethers.utils.parseEther(argv.ethamount),
                data: argv.data,
                nonce: startNonce + index,
            })
        console.log(response)
        if (argv.wait) {
          const receipt = await response.wait()
          console.log(receipt)
        }
        if (argv.delay > 0) {
            await new Promise(f => setTimeout(f, argv.delay));
        }
    }
}

async function bridgeFunds(argv: any, parentChainUrl: string, chainUrl: string, inboxAddr: string) {
  argv.provider = new ethers.providers.WebSocketProvider(parentChainUrl);

  argv.to = "address_" + inboxAddr;
  argv.data =
    "0x0f4d14e9000000000000000000000000000000000000000000000000000082f79cd90000";

  await runStress(argv, sendTransaction);

  argv.provider.destroy();
  if (argv.wait) {
    const l2provider = new ethers.providers.WebSocketProvider(chainUrl);
    const account = namedAccount(argv.from, argv.threadId).connect(l2provider)
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    while (true) {
      const balance = await account.getBalance()
      if (balance.gte(ethers.utils.parseEther(argv.ethamount))) {
        return
      }
      await sleep(100)
    }
  }
}

async function bridgeNativeToken(argv: any, parentChainUrl: string, chainUrl: string, inboxAddr: string, token: string) {
  argv.provider = new ethers.providers.WebSocketProvider(parentChainUrl);

  argv.to = "address_" + inboxAddr;

  // snapshot balance before deposit
  const childProvider = new ethers.providers.WebSocketProvider(chainUrl);
  const bridger = namedAccount(argv.from, argv.threadId).connect(childProvider)
  const bridgerBalanceBefore = await bridger.getBalance()

  // get token contract
  const bridgerParentChain = namedAccount(argv.from, argv.threadId).connect(argv.provider)
  const nativeTokenContract = new ethers.Contract(token, ERC20.abi, bridgerParentChain)

  // scale deposit amount
  const decimals = await nativeTokenContract.decimals()
  const depositAmount = BigNumber.from(argv.amount).mul(BigNumber.from('10').pow(decimals))

  /// approve inbox to use fee token
  await nativeTokenContract.approve(inboxAddr, depositAmount)

  /// deposit fee token
  const iface = new ethers.utils.Interface(["function depositERC20(uint256 amount)"])
  argv.data = iface.encodeFunctionData("depositERC20", [depositAmount]);

  await runStress(argv, sendTransaction);

  argv.provider.destroy();
  if (argv.wait) {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // calculate amount being minted on child chain
    let expectedMintedAmount = depositAmount
    if(decimals < 18) {
      // inflate up to 18 decimals
      expectedMintedAmount = depositAmount.mul(BigNumber.from('10').pow(18 - decimals))
    } else if(decimals > 18) {
      // deflate down to 18 decimals, rounding up
      const quotient = BigNumber.from('10').pow(decimals - 18)
      expectedMintedAmount = depositAmount.div(quotient)
      if(expectedMintedAmount.mul(quotient).lt(depositAmount)) {
        expectedMintedAmount = expectedMintedAmount.add(1)
      }
    }

    while (true) {
      const bridgerBalanceAfter = await bridger.getBalance()
      if (bridgerBalanceAfter.sub(bridgerBalanceBefore).eq(expectedMintedAmount)) {
        return
      }
      await sleep(100)
    }
  }
}

async function deployERC20Contract(deployerWallet: Wallet, decimals: number): Promise<string> {
    //// Bytecode below is generated from this simple ERC20 token contract which uses custom number of decimals

    // pragma solidity 0.8.16;
    //
    // import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
    //
    // contract TestToken is ERC20 {
    //     uint8 private immutable _decimals;
    //
    //     constructor(uint8 decimals_, address mintTo) ERC20("testnode", "TN") {
    //         _decimals = decimals_;
    //         _mint(mintTo, 1_000_000_000 * 10 ** decimals_);
    //     }
    //
    //     function decimals() public view virtual override returns (uint8) {
    //         return _decimals;
    //     }
    // }

    const erc20TokenBytecode = "0x60a06040523480156200001157600080fd5b5060405162000d4938038062000d49833981016040819052620000349162000195565b60405180604001604052806008815260200167746573746e6f646560c01b815250604051806040016040528060028152602001612a2760f11b815250816003908162000081919062000288565b50600462000090828262000288565b50505060ff8216608052620000c281620000ac84600a62000469565b620000bc90633b9aca0062000481565b620000ca565b5050620004b9565b6001600160a01b038216620001255760405162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f206164647265737300604482015260640160405180910390fd5b8060026000828254620001399190620004a3565b90915550506001600160a01b038216600081815260208181526040808320805486019055518481527fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a35050565b505050565b60008060408385031215620001a957600080fd5b825160ff81168114620001bb57600080fd5b60208401519092506001600160a01b0381168114620001d957600080fd5b809150509250929050565b634e487b7160e01b600052604160045260246000fd5b600181811c908216806200020f57607f821691505b6020821081036200023057634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156200019057600081815260208120601f850160051c810160208610156200025f5750805b601f850160051c820191505b8181101562000280578281556001016200026b565b505050505050565b81516001600160401b03811115620002a457620002a4620001e4565b620002bc81620002b58454620001fa565b8462000236565b602080601f831160018114620002f45760008415620002db5750858301515b600019600386901b1c1916600185901b17855562000280565b600085815260208120601f198616915b82811015620003255788860151825594840194600190910190840162000304565b5085821015620003445787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b634e487b7160e01b600052601160045260246000fd5b600181815b80851115620003ab5781600019048211156200038f576200038f62000354565b808516156200039d57918102915b93841c93908002906200036f565b509250929050565b600082620003c45750600162000463565b81620003d35750600062000463565b8160018114620003ec5760028114620003f75762000417565b600191505062000463565b60ff8411156200040b576200040b62000354565b50506001821b62000463565b5060208310610133831016604e8410600b84101617156200043c575081810a62000463565b6200044883836200036a565b80600019048211156200045f576200045f62000354565b0290505b92915050565b60006200047a60ff841683620003b3565b9392505050565b60008160001904831182151516156200049e576200049e62000354565b500290565b8082018082111562000463576200046362000354565b608051610874620004d5600039600061011b01526108746000f3fe608060405234801561001057600080fd5b50600436106100a95760003560e01c80633950935111610071578063395093511461014557806370a082311461015857806395d89b4114610181578063a457c2d714610189578063a9059cbb1461019c578063dd62ed3e146101af57600080fd5b806306fdde03146100ae578063095ea7b3146100cc57806318160ddd146100ef57806323b872dd14610101578063313ce56714610114575b600080fd5b6100b66101c2565b6040516100c391906106be565b60405180910390f35b6100df6100da366004610728565b610254565b60405190151581526020016100c3565b6002545b6040519081526020016100c3565b6100df61010f366004610752565b61026e565b60405160ff7f00000000000000000000000000000000000000000000000000000000000000001681526020016100c3565b6100df610153366004610728565b610292565b6100f361016636600461078e565b6001600160a01b031660009081526020819052604090205490565b6100b66102b4565b6100df610197366004610728565b6102c3565b6100df6101aa366004610728565b610343565b6100f36101bd3660046107b0565b610351565b6060600380546101d1906107e3565b80601f01602080910402602001604051908101604052809291908181526020018280546101fd906107e3565b801561024a5780601f1061021f5761010080835404028352916020019161024a565b820191906000526020600020905b81548152906001019060200180831161022d57829003601f168201915b5050505050905090565b60003361026281858561037c565b60019150505b92915050565b60003361027c8582856104a0565b61028785858561051a565b506001949350505050565b6000336102628185856102a58383610351565b6102af919061081d565b61037c565b6060600480546101d1906107e3565b600033816102d18286610351565b9050838110156103365760405162461bcd60e51b815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f77604482015264207a65726f60d81b60648201526084015b60405180910390fd5b610287828686840361037c565b60003361026281858561051a565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b6001600160a01b0383166103de5760405162461bcd60e51b8152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152637265737360e01b606482015260840161032d565b6001600160a01b03821661043f5760405162461bcd60e51b815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015261737360f01b606482015260840161032d565b6001600160a01b0383811660008181526001602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b60006104ac8484610351565b9050600019811461051457818110156105075760405162461bcd60e51b815260206004820152601d60248201527f45524332303a20696e73756666696369656e7420616c6c6f77616e6365000000604482015260640161032d565b610514848484840361037c565b50505050565b6001600160a01b03831661057e5760405162461bcd60e51b815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f206164604482015264647265737360d81b606482015260840161032d565b6001600160a01b0382166105e05760405162461bcd60e51b815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201526265737360e81b606482015260840161032d565b6001600160a01b038316600090815260208190526040902054818110156106585760405162461bcd60e51b815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e7420657863656564732062604482015265616c616e636560d01b606482015260840161032d565b6001600160a01b03848116600081815260208181526040808320878703905593871680835291849020805487019055925185815290927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a3610514565b600060208083528351808285015260005b818110156106eb578581018301518582016040015282016106cf565b506000604082860101526040601f19601f8301168501019250505092915050565b80356001600160a01b038116811461072357600080fd5b919050565b6000806040838503121561073b57600080fd5b6107448361070c565b946020939093013593505050565b60008060006060848603121561076757600080fd5b6107708461070c565b925061077e6020850161070c565b9150604084013590509250925092565b6000602082840312156107a057600080fd5b6107a98261070c565b9392505050565b600080604083850312156107c357600080fd5b6107cc8361070c565b91506107da6020840161070c565b90509250929050565b600181811c908216806107f757607f821691505b60208210810361081757634e487b7160e01b600052602260045260246000fd5b50919050565b8082018082111561026857634e487b7160e01b600052601160045260246000fdfea2646970667358221220257f3d763bae7b8c0189ed676531d85a1046e0bea68722f67c2616d46f01c02964736f6c63430008100033";
    const abi = ["constructor(uint8 decimals_, address mintTo)"];
    const tokenFactory = new ContractFactory(abi, erc20TokenBytecode, deployerWallet);
    const token = await tokenFactory.deploy(decimals, deployerWallet.address);
    await token.deployTransaction.wait();

    return token.address;
}

export const bridgeFundsCommand = {
  command: "bridge-funds",
  describe: "sends funds from l1 to l2",
  builder: {
    ethamount: {
      string: true,
      describe: "amount to transfer (in eth)",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait till l2 has balance of ethamount",
      default: false,
    },
  },
  handler: async (argv: any) => {
    const deploydata = JSON.parse(
      fs
        .readFileSync(path.join(consts.configpath, "deployment.json"))
        .toString()
    );
    const inboxAddr = ethers.utils.hexlify(deploydata.inbox);
  
    await bridgeFunds(argv, argv.l1url, argv.l2url, inboxAddr)
  },
};

export const bridgeToL3Command = {
  command: "bridge-to-l3",
  describe: "sends funds from l2 to l3",
  builder: {
    ethamount: {
      string: true,
      describe: "amount to transfer (in eth)",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait till l3 has balance of ethamount",
      default: false,
    },
  },
  handler: async (argv: any) => {
    const deploydata = JSON.parse(
      fs
        .readFileSync(path.join(consts.configpath, "l3deployment.json"))
        .toString()
    );
    const inboxAddr = ethers.utils.hexlify(deploydata.inbox);

    await bridgeFunds(argv, argv.l2url, argv.l3url, inboxAddr)
  },
};

export const bridgeNativeTokenToL3Command = {
  command: "bridge-native-token-to-l3",
  describe: "bridge native token from l2 to l3",
  builder: {
    amount: {
      string: true,
      describe: "amount to transfer",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait till l3 has balance of amount",
      default: false,
    },
  },
  handler: async (argv: any) => {
    const deploydata = JSON.parse(
      fs
        .readFileSync(path.join(consts.configpath, "l3deployment.json"))
        .toString()
    );
    const inboxAddr = ethers.utils.hexlify(deploydata.inbox);
    const nativeTokenAddr = ethers.utils.hexlify(deploydata["native-token"]);

    argv.ethamount = "0"
    await bridgeNativeToken(argv, argv.l2url, argv.l3url, inboxAddr, nativeTokenAddr)
  },
};

export const transferL3ChainOwnershipCommand = {
  command: "transfer-l3-chain-ownership",
  describe: "transfer L3 chain ownership to upgrade executor",
  builder: {
    creator: {
      string: true,
      describe: "address of the token bridge creator",
    },
    wait: {
      boolean: true,
      describe: "wait till ownership is transferred",
      default: false,
    },
  },
  handler: async (argv: any) => {
    // get inbox address from config file
    const deploydata = JSON.parse(
      fs
        .readFileSync(path.join(consts.configpath, "l3deployment.json"))
        .toString()
    );
    const inboxAddr = ethers.utils.hexlify(deploydata.inbox);

    // get L3 upgrade executor address from token bridge creator
    const l2provider = new ethers.providers.WebSocketProvider(argv.l2url);
    const tokenBridgeCreator = new ethers.Contract(argv.creator, L1AtomicTokenBridgeCreator.abi, l2provider);
    const [,,,,,,,l3UpgradeExecutorAddress,] = await tokenBridgeCreator.inboxToL2Deployment(inboxAddr);

    // set TX params
    argv.provider = new ethers.providers.WebSocketProvider(argv.l3url);
    argv.to = "address_" + ARB_OWNER;
    argv.from = "l3owner";
    argv.ethamount = "0";

    // add L3 UpgradeExecutor to chain owners
    const arbOwnerIface = new ethers.utils.Interface([
      "function addChainOwner(address newOwner) external",
      "function removeChainOwner(address ownerToRemove) external"
    ])
    argv.data = arbOwnerIface.encodeFunctionData("addChainOwner", [l3UpgradeExecutorAddress]);
    await runStress(argv, sendTransaction);

    // remove L3 owner from chain owners
    argv.data = arbOwnerIface.encodeFunctionData("removeChainOwner", [namedAccount("l3owner").address]);
    await runStress(argv, sendTransaction);

    argv.provider.destroy();
  }
};

export const createERC20Command = {
  command: "create-erc20",
  describe: "creates simple ERC20 on L2",
  builder: {
    deployer: {
      string: true,
      describe: "account (see general help)"
    },
    bridgeable: {
      boolean: true,
      describe: "if true, deploy on L1 and bridge to L2",
    },
    decimals: {
      string: true,
      describe: "number of decimals for token",
      default: "18",
    },
  },
  handler: async (argv: any) => {
    console.log("create-erc20");

    if (argv.bridgeable) {
      // deploy token on l1 and bridge to l2
      const l1l2tokenbridge = JSON.parse(
        fs
          .readFileSync(path.join(consts.tokenbridgedatapath, "l1l2_network.json"))
          .toString()
      );

      const l1provider = new ethers.providers.WebSocketProvider(argv.l1url);
      const l2provider = new ethers.providers.WebSocketProvider(argv.l2url);

      const deployerWallet = new Wallet(
        ethers.utils.sha256(ethers.utils.toUtf8Bytes(argv.deployer)),
        l1provider
      );

      const tokenAddress = await deployERC20Contract(deployerWallet, argv.decimals);
      const token = new ethers.Contract(tokenAddress, ERC20.abi, deployerWallet);
      console.log("Contract deployed at L1 address:", token.address);

      const l1GatewayRouter = new ethers.Contract(l1l2tokenbridge.l2Network.tokenBridge.l1GatewayRouter, L1GatewayRouter.abi, deployerWallet);
      await (await token.functions.approve(l1l2tokenbridge.l2Network.tokenBridge.l1ERC20Gateway, ethers.constants.MaxUint256)).wait();
      const supply = await token.totalSupply();
      // transfer 90% of supply to l2
      const transferAmount = supply.mul(9).div(10);
      await (await l1GatewayRouter.functions.outboundTransfer(
        token.address, deployerWallet.address, transferAmount, 100000000, 1000000000, "0x000000000000000000000000000000000000000000000000000fffffffffff0000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000", {
          value: ethers.utils.parseEther("1"),
        }
      )).wait();

      const tokenL2Addr = (await l1GatewayRouter.functions.calculateL2TokenAddress(token.address))[0];
      // wait for l2 token to be deployed
      for (let i = 0; i < 60; i++) {
        if (await l2provider.getCode(tokenL2Addr) === "0x") {
          await new Promise(f => setTimeout(f, 1000));
        } else {
          break;
        }
      }
      if (await l2provider.getCode(tokenL2Addr) === "0x") {
        throw new Error("Failed to bridge token to L2");
      }

      console.log("Contract deployed at L2 address:", tokenL2Addr);

      l1provider.destroy();
      l2provider.destroy();
      return;
    }

    // no l1-l2 token bridge, deploy token on l2 directly
    argv.provider = new ethers.providers.WebSocketProvider(argv.l2url);
    const deployerWallet = new Wallet(
      ethers.utils.sha256(ethers.utils.toUtf8Bytes(argv.deployer)),
      argv.provider
    );
    const tokenAddress = await deployERC20Contract(deployerWallet, argv.decimals);
    console.log("Contract deployed at address:", tokenAddress);

    argv.provider.destroy();
  },
};

export const transferERC20Command = {
  command: "transfer-erc20",
  describe: "transfers ERC20 token",
  builder: {
    token: {
      string: true,
      describe: "token address",
    },
    amount: {
      string: true,
      describe: "amount to transfer",
    },
    from: {
      string: true,
      describe: "account (see general help)",
    },
    to: {
      string: true,
      describe: "address (see general help)",
    },
  },
  handler: async (argv: any) => {
    console.log("transfer-erc20");

    argv.provider = new ethers.providers.WebSocketProvider(argv.l2url);
    const account = namedAccount(argv.from).connect(argv.provider);
    const tokenContract = new ethers.Contract(argv.token, ERC20.abi, account);
    const tokenDecimals = await tokenContract.decimals();
    const amountToTransfer = BigNumber.from(argv.amount).mul(BigNumber.from('10').pow(tokenDecimals));
    await(await tokenContract.transfer(namedAccount(argv.to).address, amountToTransfer)).wait();
    argv.provider.destroy();
  },
};

export const sendL1Command = {
  command: "send-l1",
  describe: "sends funds between l1 accounts",
  builder: {
    ethamount: {
      string: true,
      describe: "amount to transfer (in eth)",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    to: {
      string: true,
      describe: "address (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait for transaction to complete",
      default: false,
    },
    data: { string: true, describe: "data" },
  },
  handler: async (argv: any) => {
    argv.provider = new ethers.providers.WebSocketProvider(argv.l1url);

    await runStress(argv, sendTransaction);

    argv.provider.destroy();
  },
};

export const sendL2Command = {
  command: "send-l2",
  describe: "sends funds between l2 accounts",
  builder: {
    ethamount: {
      string: true,
      describe: "amount to transfer (in eth)",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    to: {
      string: true,
      describe: "address (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait for transaction to complete",
      default: false,
    },
    data: { string: true, describe: "data" },
  },
  handler: async (argv: any) => {
    argv.provider = new ethers.providers.WebSocketProvider(argv.l2url);

    await runStress(argv, sendTransaction);

    argv.provider.destroy();
  },
};

export const sendL3Command = {
  command: "send-l3",
  describe: "sends funds between l3 accounts",
  builder: {
    ethamount: {
      string: true,
      describe: "amount to transfer (in eth)",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    to: {
      string: true,
      describe: "address (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait for transaction to complete",
      default: false,
    },
    data: { string: true, describe: "data" },
  },
  handler: async (argv: any) => {
    argv.provider = new ethers.providers.WebSocketProvider(argv.l3url);

    await runStress(argv, sendTransaction);

    argv.provider.destroy();
  },
};

export const sendRPCCommand = {
    command: "send-rpc",
    describe: "sends rpc command",
    builder: {
        method: { string: true, describe: "rpc method to call", default: "eth_syncing" },
        url: { string: true, describe: "url to send rpc call", default: "http://sequencer:8547"},
        params: { array : true, describe: "array of parameter name/values" },
    },
    handler: async (argv: any) => {
        const rpcProvider = new ethers.providers.JsonRpcProvider(argv.url)

        await rpcProvider.send(argv.method, argv.params)
    }
}

export const waitForSyncCommand = {
  command: "wait-for-sync",
  describe: "wait for rpc to sync",
  builder: {
    url: { string: true, describe: "url to send rpc call", default: "http://sequencer:8547"},
  },
  handler: async (argv: any) => {
    const rpcProvider = new ethers.providers.JsonRpcProvider(argv.url)
    let syncStatus;
    do {
        syncStatus = await rpcProvider.send("eth_syncing", [])
        if (syncStatus !== false) {
            // Wait for a short interval before checking again
            await new Promise(resolve => setTimeout(resolve, 5000))
        }
    } while (syncStatus !== false)
  },
};
