import {
  createClient,
  RedisClientType,
  RedisModules,
  RedisScripts,
} from "@node-redis/client";

async function getAndPrint(
  redis: RedisClientType<RedisModules, RedisScripts>,
  key: string
) {
  const val = await redis.get(key);
  console.log("redis[%s]:%s", key, val);
}

async function readRedis(redisUrl: string, key: string) {
  const redis = createClient({ url: redisUrl });
  try {
    await redis.connect();
    await getAndPrint(redis, key);
  } finally {
    await redis.quit().catch((e: any) => console.warn("redis.quit() failed:", e.message));
  }
}

export const redisReadCommand = {
  command: "redis-read",
  describe: "read key",
  builder: {
    key: {
      string: true,
      describe: "key to read",
      default: "coordinator.priorities",
    },
  },
  handler: async (argv: any) => {
    await readRedis(argv.redisUrl, argv.key);
  },
};

async function writeRedisPriorities(redisUrl: string, priorities: number) {
  if (!Number.isInteger(priorities) || priorities < 0) {
    throw new Error(`Invalid redundancy value: ${priorities} (expected non-negative integer)`);
  }
  const redis = createClient({ url: redisUrl });

  const prio_sequencers = "bcd";
  let priostring = "";
  if (priorities === 0) {
    priostring = "http://sequencer:8547";
  }
  if (priorities > prio_sequencers.length) {
    console.warn(`Warning: redundancy ${priorities} exceeds maximum ${prio_sequencers.length}, clamping to ${prio_sequencers.length}`);
    priorities = prio_sequencers.length;
  }
  for (let index = 0; index < priorities; index++) {
    const this_prio =
      "http://sequencer_" + prio_sequencers.charAt(index) + ":8547";
    if (index !== 0) {
      priostring = priostring + ",";
    }
    priostring = priostring + this_prio;
  }
  try {
    await redis.connect();
    await redis.set("coordinator.priorities", priostring);
    await getAndPrint(redis, "coordinator.priorities");
  } finally {
    await redis.quit().catch((e: any) => console.warn("redis.quit() failed:", e.message));
  }
}

export const redisInitCommand = {
  command: "redis-init",
  describe: "init redis priorities",
  builder: {
    redundancy: {
      number: true,
      describe: "number of servers [0-3]",
      default: 0,
    },
  },
  handler: async (argv: any) => {
    await writeRedisPriorities(argv.redisUrl, argv.redundancy);
  },
};
