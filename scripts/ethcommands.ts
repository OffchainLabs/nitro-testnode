import { runStress } from "./stress";
import { ContractFactory, ethers, Wallet } from "ethers";
import * as consts from "./consts";
import { namedAccount, namedAddress } from "./accounts";
import * as MintableTestArbCustomToken from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/test/TestArbCustomToken.sol/MintableTestArbCustomToken.json"
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
      describe: "account (see general help)",
      default: "user_l2user",
    },
    mintTo: {
      string: true,
      describe: "account (see general help)",
      default: "user_l2user",
    },
  },
  handler: async (argv: any) => {
    console.log("create-erc20");

    argv.provider = new ethers.providers.WebSocketProvider(argv.l2url);
    const deployerWallet = new Wallet(
      ethers.utils.sha256(ethers.utils.toUtf8Bytes(argv.deployer)),
      argv.provider
    );

    let gatewayAddr = ethers.constants.AddressZero;
    let routerAddr = ethers.constants.AddressZero;

    if (fs.existsSync(path.join(consts.configpath, "l2_token_bridge_network.json"))) {
      // set gateway if l2 token bridge exists
      const l2TokenBridge = JSON.parse(
        fs
          .readFileSync(path.join(consts.configpath, "l2_token_bridge_network.json"))
          .toString()
      );
      console.log(l2TokenBridge)
      // this is very insecure and only meant to be used for testing
      // anyone can register a l1 token to the custom gateway to mint this l2 token
      gatewayAddr = l2TokenBridge.l2Network.tokenBridge.l2CustomGateway;
      routerAddr = l2TokenBridge.l2Network.tokenBridge.l2GatewayRouter;
    }

    const contractFactory = new ContractFactory(
      MintableTestArbCustomToken.abi,
      MintableTestArbCustomToken.bytecode,
      deployerWallet
    );
    const contract = await contractFactory.deploy(gatewayAddr, routerAddr);
    await contract.deployTransaction.wait();

    console.log("Contract deployed at address:", contract.address);
    await (await contract.userMint(namedAccount(argv.mintTo).address, ethers.utils.parseEther("1000000000"))).wait();

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
