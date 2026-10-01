import { BigNumber, Contract, ContractFactory, ethers, Wallet } from "ethers";
import { namedAccount } from "./accounts";

const ERC20_ABI = [
  "constructor(uint8 decimals_, address mintTo)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

// Same testnode ERC20 bytecode as deployERC20Contract in ethcommands.ts.
const ERC20_BYTECODE =
  "0x60a06040523480156200001157600080fd5b5060405162000d4938038062000d49833981016040819052620000349162000195565b60405180604001604052806008815260200167746573746e6f646560c01b815250604051806040016040528060028152602001612a2760f11b815250816003908162000081919062000288565b50600462000090828262000288565b50505060ff8216608052620000c281620000ac84600a62000469565b620000bc90633b9aca0062000481565b620000ca565b5050620004b9565b6001600160a01b038216620001255760405162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f206164647265737300604482015260640160405180910390fd5b8060026000828254620001399190620004a3565b90915550506001600160a01b038216600081815260208181526040808320805486019055518481527fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a35050565b505050565b60008060408385031215620001a957600080fd5b825160ff81168114620001bb57600080fd5b60208401519092506001600160a01b0381168114620001d957600080fd5b809150509250929050565b634e487b7160e01b600052604160045260246000fd5b600181811c908216806200020f57607f821691505b6020821081036200023057634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156200019057600081815260208120601f850160051c810160208610156200025f5750805b601f850160051c820191505b8181101562000280578281556001016200026b565b505050505050565b81516001600160401b03811115620002a457620002a4620001e4565b620002bc81620002b58454620001fa565b8462000236565b602080601f831160018114620002f45760008415620002db5750858301515b600019600386901b1c1916600185901b17855562000280565b600085815260208120601f198616915b82811015620003255788860151825594840194600190910190840162000304565b5085821015620003445787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b634e487b7160e01b600052601160045260246000fd5b600181815b80851115620003ab5781600019048211156200038f576200038f62000354565b808516156200039d57918102915b93841c93908002906200036f565b509250929050565b600082620003c45750600162000463565b81620003d35750600062000463565b8160018114620003ec5760028114620003f75762000417565b600191505062000463565b60ff8411156200040b576200040b62000354565b50506001821b62000463565b5060208310610133831016604e8410600b84101617156200043c575081810a62000463565b6200044883836200036a565b80600019048211156200045f576200045f62000354565b0290505b92915050565b60006200047a60ff841683620003b3565b9392505050565b60008160001904831182151516156200049e576200049e62000354565b500290565b8082018082111562000463576200046362000354565b608051610874620004d5600039600061011b01526108746000f3fe608060405234801561001057600080fd5b50600436106100a95760003560e01c80633950935111610071578063395093511461014557806370a082311461015857806395d89b4114610181578063a457c2d714610189578063a9059cbb1461019c578063dd62ed3e146101af57600080fd5b806306fdde03146100ae578063095ea7b3146100cc57806318160ddd146100ef57806323b872dd14610101578063313ce56714610114575b600080fd5b6100b66101c2565b6040516100c391906106be565b60405180910390f35b6100df6100da366004610728565b610254565b60405190151581526020016100c3565b6002545b6040519081526020016100c3565b6100df61010f366004610752565b61026e565b60405160ff7f00000000000000000000000000000000000000000000000000000000000000001681526020016100c3565b6100df610153366004610728565b610292565b6100f361016636600461078e565b6001600160a01b031660009081526020819052604090205490565b6100b66102b4565b6100df610197366004610728565b6102c3565b6100df6101aa366004610728565b610343565b6100f36101bd3660046107b0565b610351565b6060600380546101d1906107e3565b80601f01602080910402602001604051908101604052809291908181526020018280546101fd906107e3565b801561024a5780601f1061021f5761010080835404028352916020019161024a565b820191906000526020600020905b81548152906001019060200180831161022d57829003601f168201915b5050505050905090565b60003361026281858561037c565b60019150505b92915050565b60003361027c8582856104a0565b61028785858561051a565b506001949350505050565b6000336102628185856102a58383610351565b6102af919061081d565b61037c565b6060600480546101d1906107e3565b600033816102d18286610351565b9050838110156103365760405162461bcd60e51b815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f77604482015264207a65726f60d81b60648201526084015b60405180910390fd5b610287828686840361037c565b60003361026281858561051a565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b6001600160a01b0383166103de5760405162461bcd60e51b8152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152637265737360e01b606482015260840161032d565b6001600160a01b03821661043f5760405162461bcd60e51b815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015261737360f01b606482015260840161032d565b6001600160a01b0383811660008181526001602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b60006104ac8484610351565b9050600019811461051457818110156105075760405162461bcd60e51b815260206004820152601d60248201527f45524332303a20696e73756666696369656e7420616c6c6f77616e6365000000604482015260640161032d565b610514848484840361037c565b50505050565b6001600160a01b03831661057e5760405162461bcd60e51b815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f206164604482015264647265737360d81b606482015260840161032d565b6001600160a01b0382166105e05760405162461bcd60e51b815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201526265737360e81b606482015260840161032d565b6001600160a01b038316600090815260208190526040902054818110156106585760405162461bcd60e51b815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e7420657863656564732062604482015265616c616e636560d01b606482015260840161032d565b6001600160a01b03848116600081815260208181526040808320878703905593871680835291849020805487019055925185815290927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a3610514565b600060208083528351808285015260005b818110156106eb578581018301518582016040015282016106cf565b506000604082860101526040601f19601f8301168501019250505092915050565b80356001600160a01b038116811461072357600080fd5b919050565b6000806040838503121561073b57600080fd5b6107448361070c565b946020939093013593505050565b60008060006060848603121561076757600080fd5b6107708461070c565b925061077e6020850161070c565b9150604084013590509250925092565b6000602082840312156107a057600080fd5b6107a98261070c565b9392505050565b600080604083850312156107c357600080fd5b6107cc8361070c565b91506107da6020840161070c565b90509250929050565b600181811c908216806107f757607f821691505b60208210810361081757634e487b7160e01b600052602260045260246000fd5b50919050565b8082018082111561026857634e487b7160e01b600052601160045260246000fdfea2646970667358221220257f3d763bae7b8c0189ed676531d85a1046e0bea68722f67c2616d46f01c02964736f6c63430008100033";

// Returns 5 zero bytes as runtime code; minimal valid contract creation init code.
const SMALL_CONTRACT_INIT_CODE = "0x6005600c60003960056000f30000000000";

interface LoadProfile {
  senders: number;
  perSenderDelayMs: number;
  fundEth: string;
}

// Targets at 250ms blocks (4 blocks/sec):
//   heavy: ~120 tx/sec aggregate -> ~30 tx/block
//   light: ~30  tx/sec aggregate -> ~7  tx/block
const LOAD_PROFILES: { [k: string]: LoadProfile } = {
  heavy: { senders: 8, perSenderDelayMs: 60, fundEth: "100" },
  light: { senders: 2, perSenderDelayMs: 60, fundEth: "100" },
};

const TX_MIX = [
  { kind: "transfer", weight: 60 },
  { kind: "erc20", weight: 30 },
  { kind: "create", weight: 10 },
] as const;
type TxKind = typeof TX_MIX[number]["kind"];

function pickKind(): TxKind {
  let r = Math.random() * TX_MIX.reduce((s, e) => s + e.weight, 0);
  for (const e of TX_MIX) {
    r -= e.weight;
    if (r <= 0) return e.kind;
  }
  return TX_MIX[0].kind;
}

function senderName(threadId: number): string {
  return `user_mixedload_${threadId}`;
}

async function deployErc20(funnel: Wallet): Promise<Contract> {
  const factory = new ContractFactory(ERC20_ABI, ERC20_BYTECODE, funnel);
  const decimals = 18;
  const token = await factory.deploy(decimals, funnel.address);
  await token.deployTransaction.wait();
  return new Contract(token.address, ERC20_ABI, funnel);
}

async function fundSenders(
  funnel: Wallet,
  senders: Wallet[],
  fundEth: string,
  erc20: Contract,
): Promise<void> {
  // Sequential funding txs from funnel — nonce ordering matters and sender count is small.
  let nonce = await funnel.getTransactionCount("pending");
  const ethAmount = ethers.utils.parseEther(fundEth);
  const erc20Amount = ethers.utils.parseUnits("1000000", 18); // 1M tokens per sender
  const pending: Promise<ethers.providers.TransactionResponse>[] = [];
  for (const s of senders) {
    pending.push(
      funnel.sendTransaction({ to: s.address, value: ethAmount, nonce: nonce++ }),
    );
    pending.push(
      erc20.transfer(s.address, erc20Amount, { nonce: nonce++ }),
    );
  }
  // Wait for the last one to confirm so balances are observable before steady state.
  const last = await pending[pending.length - 1];
  await last.wait();
}

interface ChainCtx {
  chainId: number;
  gasPrice: BigNumber;
  erc20Address: string;
}

function buildSignableTx(
  ctx: ChainCtx,
  nonce: number,
  kind: TxKind,
): ethers.providers.TransactionRequest {
  const recipient = ethers.Wallet.createRandom().address;
  const base = { chainId: ctx.chainId, gasPrice: ctx.gasPrice, nonce };
  switch (kind) {
    case "transfer":
      return {
        ...base,
        to: recipient,
        value: BigNumber.from(1),
        gasLimit: 21000,
      };
    case "erc20": {
      const iface = new ethers.utils.Interface(ERC20_ABI);
      return {
        ...base,
        to: ctx.erc20Address,
        data: iface.encodeFunctionData("transfer", [recipient, 1]),
        gasLimit: 100000,
      };
    }
    case "create":
      return {
        ...base,
        data: SMALL_CONTRACT_INIT_CODE,
        gasLimit: 300000,
      };
  }
}

async function runSender(
  sender: Wallet,
  ctx: ChainCtx,
  deadline: number,
  perSenderDelayMs: number,
  stats: { sent: number; errors: number; mix: { [k in TxKind]: number } },
): Promise<void> {
  // Sign locally with all fields explicit, then submit raw — bypasses ethers'
  // populateTransaction(), which would otherwise add a getFeeData() RPC per tx.
  let nonce = await sender.getTransactionCount("pending");
  let consecutiveErrors = 0;
  while (Date.now() < deadline) {
    const kind = pickKind();
    try {
      const tx = buildSignableTx(ctx, nonce, kind);
      const signed = await sender.signTransaction(tx);
      await sender.provider.sendTransaction(signed);
      nonce++;
      stats.sent++;
      stats.mix[kind]++;
      consecutiveErrors = 0;
    } catch (e: any) {
      stats.errors++;
      consecutiveErrors++;
      if (stats.errors <= 5) {
        console.error(`sender ${sender.address} tx error (${kind}):`, e?.message ?? e);
      }
      // Recover from nonce drift by re-syncing with the node.
      if (consecutiveErrors >= 3) {
        nonce = await sender.getTransactionCount("pending");
        consecutiveErrors = 0;
      }
    }
    if (perSenderDelayMs > 0) {
      await new Promise((f) => setTimeout(f, perSenderDelayMs));
    }
  }
}

export const mixedLoadCommand = {
  command: "gen-mixed-load",
  describe:
    "generates mixed L2 traffic (transfers / ERC20 transfers / contract creations) for benchmarks",
  builder: {
    load: {
      string: true,
      describe: "load profile: heavy (~30 tx/block) or light (~7 tx/block)",
      default: "heavy",
    },
    duration: {
      number: true,
      describe: "steady-state duration in seconds",
      default: 900,
    },
    senders: {
      number: true,
      describe: "override number of parallel sender accounts",
    },
    delayMs: {
      number: true,
      describe: "override per-sender inter-tx delay in ms",
    },
  },
  handler: async (argv: any) => {
    const baseProfile = LOAD_PROFILES[argv.load];
    if (!baseProfile) {
      console.error(`unknown load profile: ${argv.load}; expected heavy|light`);
      process.exit(1);
    }
    const profile: LoadProfile = {
      ...baseProfile,
      senders: argv.senders ?? baseProfile.senders,
      perSenderDelayMs: argv.delayMs ?? baseProfile.perSenderDelayMs,
    };

    const provider = new ethers.providers.WebSocketProvider(argv.l2url);
    const funnel = namedAccount("funnel").connect(provider);

    console.log(
      `gen-mixed-load: profile=${argv.load} senders=${profile.senders} ` +
        `delay=${profile.perSenderDelayMs}ms duration=${argv.duration}s`,
    );

    const senders: Wallet[] = [];
    for (let i = 0; i < profile.senders; i++) {
      senders.push(namedAccount(senderName(i)).connect(provider));
    }

    console.log("deploying ERC20 token...");
    const erc20 = await deployErc20(funnel);
    console.log(`ERC20 at ${erc20.address}`);

    console.log(`funding ${senders.length} senders...`);
    await fundSenders(funnel, senders, profile.fundEth, erc20);

    // Cache chainId + gasPrice once. Each tx then signs locally and submits
    // raw, avoiding ethers' per-tx getFeeData() RPC overhead (~3 round-trips
    // per tx -> 1).
    const network = await provider.getNetwork();
    const baseGasPrice = await provider.getGasPrice();
    const ctx: ChainCtx = {
      chainId: network.chainId,
      gasPrice: baseGasPrice.mul(2), // 2x buffer for inclusion under load
      erc20Address: erc20.address,
    };
    console.log(
      `chainId=${ctx.chainId} gasPrice=${ctx.gasPrice.toString()} wei`,
    );

    const deadline = Date.now() + argv.duration * 1000;
    const stats = {
      sent: 0,
      errors: 0,
      mix: { transfer: 0, erc20: 0, create: 0 } as { [k in TxKind]: number },
    };

    console.log("entering steady state...");
    const startedAt = Date.now();
    await Promise.all(
      senders.map((s) =>
        runSender(s, ctx, deadline, profile.perSenderDelayMs, stats),
      ),
    );
    const elapsedSec = (Date.now() - startedAt) / 1000;

    console.log(
      `done: sent=${stats.sent} errors=${stats.errors} ` +
        `rate=${(stats.sent / elapsedSec).toFixed(1)} tx/s ` +
        `mix=transfer:${stats.mix.transfer},erc20:${stats.mix.erc20},create:${stats.mix.create}`,
    );

    provider.destroy();
  },
};
