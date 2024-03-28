import { runStress } from "./stress";
import { ContractFactory, ethers, Wallet } from "ethers";
import * as consts from "./consts";
import { namedAccount, namedAddress } from "./accounts";
import * as L1GatewayRouter from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/ethereum/gateway/L1GatewayRouter.sol/L1GatewayRouter.json";
import * as ERC20PresetFixedSupplyArtifact from "@openzeppelin/contracts/build/contracts/ERC20PresetFixedSupply.json";
import * as ERC20 from "@openzeppelin/contracts/build/contracts/ERC20.json";
import * as fs from "fs";
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

  /// approve inbox to use fee token
  const bridgerParentChain = namedAccount(argv.from, argv.threadId).connect(argv.provider)
  const nativeTokenContract = new ethers.Contract(token, ERC20.abi, bridgerParentChain)
  await nativeTokenContract.approve(inboxAddr, ethers.utils.parseEther(argv.amount))

  /// deposit fee token
  const iface = new ethers.utils.Interface(["function depositERC20(uint256 amount)"])
  argv.data = iface.encodeFunctionData("depositERC20", [ethers.utils.parseEther(argv.amount)]);

  await runStress(argv, sendTransaction);

  argv.provider.destroy();
  if (argv.wait) {
    const childProvider = new ethers.providers.WebSocketProvider(chainUrl);
    const bridger = namedAccount(argv.from, argv.threadId).connect(childProvider)
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    while (true) {
      const balance = await bridger.getBalance()
      if (balance.gte(ethers.utils.parseEther(argv.amount))) {
        return
      }
      await sleep(100)
    }
  }
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

export const createERC20Command = {
  command: "create-erc20",
  describe: "creates simple ERC20 on L2",
  builder: {
    deployer: {
      string: true,
      describe: "account (see general help)"
    },
    mintTo: {
      string: true,
      describe: "account (see general help)",
    },
    bridgeable: {
      boolean: true,
      describe: "if true, deploy on L1 and bridge to L2",
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

      const tokenFactory = new ContractFactory(
        ERC20PresetFixedSupplyArtifact.abi,
        ERC20PresetFixedSupplyArtifact.bytecode,
        deployerWallet
      );
      const token = await tokenFactory.deploy("AppTestToken", "APP", ethers.utils.parseEther("1000000000"), deployerWallet.address);
      await token.deployTransaction.wait();
      console.log("Contract deployed at L1 address:", token.address);
      await (await token.functions.transfer(namedAccount(argv.mintTo).address, ethers.utils.parseEther("100000000"))).wait();

      const l1GatewayRouter = new ethers.Contract(l1l2tokenbridge.l2Network.tokenBridge.l1GatewayRouter, L1GatewayRouter.abi, deployerWallet);
      await (await token.functions.approve(l1l2tokenbridge.l2Network.tokenBridge.l1ERC20Gateway, ethers.constants.MaxUint256)).wait();
      await (await l1GatewayRouter.functions.outboundTransfer(
        token.address, namedAccount(argv.mintTo).address, ethers.utils.parseEther("100000000"), 100000000, 1000000000, "0x000000000000000000000000000000000000000000000000000fffffffffff0000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000", {
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

    const contractFactory = new ContractFactory(
      ERC20PresetFixedSupplyArtifact.abi,
      ERC20PresetFixedSupplyArtifact.bytecode,
      deployerWallet
    );
    const contract = await contractFactory.deploy("AppTestToken", "APP", ethers.utils.parseEther("1000000000"), namedAccount(argv.mintTo).address);
    await contract.deployTransaction.wait();

    console.log("Contract deployed at address:", contract.address);

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
    const decimals = await tokenContract.decimals();
    await(await tokenContract.transfer(namedAccount(argv.to).address, ethers.utils.parseUnits(argv.amount, decimals))).wait();
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
