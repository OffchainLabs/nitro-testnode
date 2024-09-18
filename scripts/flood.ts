import { runStress } from './stress';
import { ethers } from 'ethers';
import { namedAccount, namedAddress } from './accounts';

function randomInRange(maxSize: number): number {
  return Math.ceil(Math.random() * maxSize);
}

function generateRandomBytes(size: number): string {
  let result = '';
  const hexChars = '0123456789abcdef';
  for (let i = 0; i < size; i++) {
    const byte = Math.floor(Math.random() * 256);
    result += hexChars[(byte >> 4) & 0xf] + hexChars[byte & 0xf]; // Convert byte to two hex characters
  }
  return result;
}

function generateRandomHexData(size: number): string {
  return '0x' + generateRandomBytes(size);
}

async function sendTransaction(argv: any, threadId: number) {
  console.log("sending tx from", argv.from, "to", argv.to)
  const account = namedAccount(argv.from, threadId).connect(argv.provider)
  const startNonce = await account.getTransactionCount("pending")
  const response = await
    account.sendTransaction({
      to: namedAddress(argv.to, threadId),
      value: ethers.utils.parseEther(argv.ethamount),
      data: argv.data,
      nonce: startNonce,
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

// flood simulation
async function simulateNetworkFlood(argv: any) {
  // fund the users
  console.log(`fund all users`)
  const funding_argv = {
    ...argv,
    ethamount: "100",
    threads: 1,
    wait: true,
    from: `funnel`
  }
  for (let i = 0; i <= argv.user_count; i++) {
    funding_argv.to = `user_${i}`
    await runStress(funding_argv, sendTransaction)
  }

  console.log(`start sending transactions`)
  // if throughput target is set, we will not respect the maxTxDataSize setting
  if (argv.targetThroughput > 0) {
    argv.threads = argv.max_thread
    const avg_tx_size = argv.targetThroughput / argv.max_threads;
    for (let i = 0; i < argv.rounds; i++) {
      argv.from = `user_${randomInRange(argv.user_count)}`;
      argv.to = `user_${randomInRange(argv.user_count)}`; // don't care if sending to self
      const size = randomInRange(avg_tx_size * 2)
      argv.data = generateRandomHexData(size);

      console.log(`prepared transactions`, { transaction_count: i, size: size, argv: argv })
      const startTime = Date.now();
      runStress(argv, sendTransaction);
      const timeSpent = Date.now() - startTime;
      const secondsTick = Math.max(0, 1000 - timeSpent);
      await new Promise(resolve => setTimeout(resolve, secondsTick));
    }
  } else {
    for (let i = 0; i < argv.rounds; i++) {
      argv.from = `user_${randomInRange(argv.user_count)}`;
      argv.to = `user_${randomInRange(argv.user_count)}`; // don't care if sending to self
      argv.threads = randomInRange(argv.max_thread)
      const size = randomInRange(argv.maxTxDataSize)
      argv.data = generateRandomHexData(size);

      console.log(`prepared transactions`, { transaction_count: i, size: size, argv: argv })
      await runStress(argv, sendTransaction);
    }
  }
}


export const floodCommand = {
  command: "flood",
  describe: "Simulates network activity by sending arbitrary transactions among random user_count",
  builder: {
    user_count: {
      number: true,
      describe: "Number of active user_count",
      default: 10,
    },
    rounds: {
      number: true,
      describe: "Number of rounds of transactions to send (total transactions = rounds * threads); if targetThroughput rate is set, rounds should represents the total second of the tests",
      default: 12000,
    },
    // this is something we can read from the rollup creator
    maxTxDataSize: {
      number: true,
      describe: "Maximum transaction data size in bytes",
      default: 58982,
    },
    threads: {
      number: true,
      describe: "Number of threads per transaction",
      default: 100,
    },
    delay: {
      number: true,
      describe: "Delay between transactions in milliseconds",
      default: 0,
    },
    serial: {
      boolean: true,
      describe: "Run transactions serially (in sequence)",
      default: false,
    },
    wait: {
      boolean: true,
      describe: "Wait for transaction confirmations",
      default: false,
    },
    targetThroughput: {
      number: true,
      describe: "Target throughput in total transactions data size sent per second; if this is set, number of threads will be disregarded (Default is 16kb)",
      default: 0,
    },
  },
  handler: async (argv: any) => {
    argv.provider = new ethers.providers.WebSocketProvider(argv.l2url);
    await simulateNetworkFlood(argv);
    argv.provider.destroy();

  },
};

