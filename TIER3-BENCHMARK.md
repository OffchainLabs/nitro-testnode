# Tier-3 NoSync vs Sync Pebble Benchmark

End-to-end benchmark to compare Pebble `--persistent.pebble.sync-mode=true` vs
`false` (the current default) inside the full nitro-testnode docker-compose
stack — real RPC ingress, real batch posting, real container disk semantics.

This is **tier 3** of a 4-tier investigation. Tiers 1 (Pebble micro-bench) and
2 (system_tests block-validator with packed blocks) already showed NoSync wins
by ~9-15× on `arb/block/writetodb` p50/p95 and ~1.8-5.7× on
`arb/sequencer/block/creation` under realistic packed-block workloads. Tier 3
exists to confirm those signals survive in the realistic stack, where
batch-poster I/O, RPC backpressure, and container disk semantics could change
the picture.

## Components

| File | Role |
| --- | --- |
| `docker-compose.yaml` | Sequencer wired to `${NITRO_PEBBLE_SYNC_MODE}` env var; metrics enabled on port 6070 |
| `test-node.bash` | New `--pebble-sync-mode {true\|false}` flag; exports `NITRO_PEBBLE_SYNC_MODE` |
| `scripts/mixedLoad.ts` | `gen-mixed-load` command — mixed L2 traffic generator (transfers / ERC20 / contract creations) |
| `scripts/scrape-metrics.sh` | Polls `/debug/metrics` once per second; emits one CSV row per sample |
| `scripts/tier3-summarize.py` | Reads the 4 cell CSVs, drops 60s warmup, emits a markdown comparison table |
| `scripts/run-tier3-bench.sh` | Driver — runs the 4-cell matrix `{sync, nosync} × {heavy, light}` |

## Prerequisites

- Docker + docker compose v2
- `jq`, `python3` ≥ 3.10, `curl` (host side)
- Host ports free: `8547` (sequencer RPC), `6070` (metrics)
- ~75 min of wall time for the default matrix (`DURATION=900` × 4 cells + ~1
  min teardown each)

## Quick start

From `nitro-testnode/` root:

```bash
# full matrix with defaults
./scripts/run-tier3-bench.sh

# results land in:
#   results/tier3/{nosync,sync}_{heavy,light}.csv
#   results/tier3/summary.md
```

The driver handles testnode lifecycle for you — **don't pre-launch the
testnode**. Each cell starts with `docker compose down -v`, boots a fresh
chain, runs steady-state for `$DURATION`, then tears down.

## Sanity check (run this first)

Before committing to ~75 min of matrix runs, verify the generator hits the
intended density:

```bash
# boot a fresh testnode
./test-node.bash --init --no-l2-traffic --pebble-sync-mode false --detach

# wait ~30s for sequencer warmup, then run a 2-min generator
docker compose run --rm scripts gen-mixed-load --load=heavy --duration=120

# in another shell, watch tx counts per block:
while true; do
  cast block latest --rpc-url http://localhost:8547 \
    | grep -E "number|transactions" ; echo "---" ; sleep 1
done

# tear down when done
docker compose down -v
```

Expected: heavy cell sustained at ~25-35 tx/block; light cell at ~5-10 tx/block.

If density is consistently off:
- **Too low**: increase senders or lower delay (see Configuration below)
- **Too high**: opposite

The generator's final line shows the achieved aggregate rate:
`done: sent=N errors=0 rate=XXX.X tx/s mix=...`. Multiply rate by 0.25 to get
tx/block at the 250ms block cadence.

## Configuration

### Sequencer flag

`--pebble-sync-mode {true|false}` (default `false`). Sets
`--persistent.pebble.sync-mode` on the sequencer container.

### `gen-mixed-load` CLI args

| flag | default | description |
| --- | --- | --- |
| `--load` | `heavy` | profile: `heavy` (~30 tx/block) or `light` (~7 tx/block) |
| `--duration` | `900` | steady-state seconds |
| `--senders` | (profile) | override parallel sender accounts |
| `--delay-ms` | (profile) | override per-sender inter-tx delay (ms) |

Profile defaults are in `scripts/mixedLoad.ts` `LOAD_PROFILES`:

```typescript
heavy: { senders: 8, perSenderDelayMs: 60, fundEth: "100" }
light: { senders: 2, perSenderDelayMs: 60, fundEth: "100" }
```

Tx mix (also in `mixedLoad.ts`, `TX_MIX`):
- 60% ETH transfer (`gasLimit: 21000`)
- 30% ERC20 transfer (`gasLimit: 100000`)
- 10% small contract creation (`gasLimit: 300000`)

### Driver env vars (`run-tier3-bench.sh`)

| var | default | description |
| --- | --- | --- |
| `DURATION` | `900` | steady-state seconds per cell |
| `WARMUP_BLOCKS` | `5` | min block height before starting load |
| `RPC_URL` | `http://localhost:8547` | sequencer RPC for readiness probe |
| `METRICS_URL` | `http://localhost:6070/debug/metrics` | metrics endpoint to scrape |
| `HEAVY_SENDERS` | unset | override sender count for heavy cells |
| `HEAVY_DELAY_MS` | unset | override per-sender delay for heavy cells |
| `LIGHT_SENDERS` | unset | override sender count for light cells |
| `LIGHT_DELAY_MS` | unset | override per-sender delay for light cells |

Examples:

```bash
# tune for higher heavy density
HEAVY_SENDERS=12 HEAVY_DELAY_MS=40 ./scripts/run-tier3-bench.sh

# faster iteration (5 min per cell instead of 15)
DURATION=300 ./scripts/run-tier3-bench.sh

# all knobs
DURATION=600 HEAVY_SENDERS=10 HEAVY_DELAY_MS=50 \
  LIGHT_SENDERS=3 LIGHT_DELAY_MS=80 \
  ./scripts/run-tier3-bench.sh
```

## After editing the generator

`mixedLoad.ts` is compiled into the `scripts` Docker image at build time.
**After any change to the .ts source, rebuild before re-running:**

```bash
docker compose build scripts
```

The driver script triggers `--init` on each cell, which sets `build_utils=true`
internally — so source changes are picked up automatically when running the
full matrix. Only the manual sanity-check path needs an explicit rebuild.

## Output

### Per-cell CSV (`results/tier3/<run-id>.csv`)

One row per second of wall time, columns:

```
ts_unix,
arb/block/writetodb.count,
arb/block/writetodb.p50_ns,
arb/block/writetodb.p95_ns,
arb/block/writetodb.p99_ns,
arb/block/writetodb.mean_ns,
arb/sequencer/block/creation.count,
arb/sequencer/block/creation.p50_ns,
arb/sequencer/block/creation.p95_ns,
arb/sequencer/block/creation.p99_ns,
arb/sequencer/block/creation.mean_ns,
chain/inserts.count
```

All `_ns` values are nanoseconds (go-ethereum histogram default). `count`
columns are monotonic since sequencer start. Histogram percentiles come from
go-ethereum's `BoundedHistogramSample`, which is a recent-window sample so
percentiles smooth quickly.

### Summary (`results/tier3/summary.md`)

Markdown table with the same shape as the tier-2 result table:

```
| metric | NoSync heavy | Sync heavy | wins by | NoSync light | Sync light | wins by |
| --- | --- | --- | --- | --- | --- | --- |
| arb/block/writetodb count | 12345 | 12340 | — | 3120 | 3115 | — |
| arb/block/writetodb p50 | 0.412 ms | 6.105 ms | 14.8× | 0.401 ms | 5.890 ms | 14.7× |
| arb/block/writetodb p95 | 0.534 ms | 7.612 ms | 14.3× | 0.521 ms | 7.488 ms | 14.4× |
| arb/sequencer/block/creation p50 | 9.812 ms | 17.405 ms | 1.8× | 4.122 ms | 8.901 ms | 2.2× |
| arb/sequencer/block/creation p95 | 11.103 ms | 19.842 ms | 1.8× | 5.011 ms | 10.224 ms | 2.0× |
| chain/inserts count | 12345 | 12340 | — | 3120 | 3115 | — |
```

Aggregation rules (see `tier3-summarize.py`):
- First **60 seconds dropped** as warmup (`WARMUP_SEC`).
- Counts: `last - first` over the steady-state window — comparable activity
  per cell.
- Percentiles: median of per-sample values across the steady-state window.
  Histograms are pre-smoothed so this is stable.
- `wins by`: ratio of Sync over NoSync. Reported as `tie` if within 10%.

## Expected results

### Reference: tier 2 (already complete)

Packed-block `testBlockValidatorComplex` workload (~30 tx/block):

```
arb/block/writetodb p50:                NoSync 0.655ms vs Sync 6.151ms — 9.4×
arb/block/writetodb p95:                NoSync 0.873ms vs Sync 10.030ms — 11.5×
arb/sequencer/block/creation p50:       NoSync 9.316ms vs Sync 17.151ms — 1.8×
arb/sequencer/block/creation p95:       NoSync 10.390ms vs Sync 19.379ms — 1.9×
```

(Simple `testBlockValidatorSimple` workload showed even larger gaps on
writetodb, ~15×, but the depleteGas execution swamped the block-creation
signal.)

### Tier-3 decision rule

**Confirms tier 2 (decision: keep NoSync default):**
- writeToDB p50/p95: NoSync wins by ≥ 5× in heavy
- block-creation p50/p95: NoSync wins by ≥ 1.5× in heavy
- light cells show similar (or larger) NoSync advantage

**Surprises (investigate before deciding):**
- The gap collapses to < 2× — likely batch-poster or RPC backpressure
  dominating; tier-3 has surfaced something the in-process test missed
- Sync wins anywhere — extremely unexpected; check for misconfiguration first
  (e.g. `wal-bytes-per-sync` not at the 512KB default, batch-poster running
  out-of-process)
- Heavy and light disagree directionally — points to a workload-dependent
  effect worth understanding before shipping

## Troubleshooting

**`bad account name: [...]` from `gen-mixed-load`** — `mixedLoad.ts` uses
`user_mixedload_<n>` accounts. If you see another name in the error, the
scripts image is stale; run `docker compose build scripts`.

**Generator outputs `rate=` much lower than expected** — likely a stale image
not running the local-signing path. Confirm `mixedLoad.ts` line ~138 contains
`sender.signTransaction(tx)` followed by `sender.provider.sendTransaction`.
Then `docker compose build scripts`.

**`metrics endpoint not reachable within 60s`** in the driver — check that
docker-compose maps port 6070 (`docker compose ps` should show
`127.0.0.1:6070->6070/tcp` for the sequencer). If missing, your
`docker-compose.yaml` was reverted at some point; re-apply the port mapping.

**Sequencer doesn't reach the warmup block** — usually means the testnode
boot itself failed. Run `docker compose logs sequencer` to inspect. Most
common: stale `nitro-node-dev-testnode` image after a Nitro source change —
`./test-node.bash --build` rebuilds it.

**Histogram values are zero in the CSV** — the metric exists but no samples
have arrived yet. The generator's first ~5 seconds may show empty rows; the
60s warmup discard handles this in the summarizer.

## Customizing

### Add a new tx kind to the mix

1. Add to `TxKind` union and `TX_MIX` in `mixedLoad.ts`.
2. Extend the `switch (kind)` in `buildSignableTx` with the tx fields.
3. Extend the `mix` field in stats and the final log line.
4. `docker compose build scripts`.

### Add a new metric to the scrape

1. Add the metric name to either `metrics` (histograms) or `counters`
   (gauges/counters) in `scrape-metrics.sh`.
2. Add the corresponding `(col, kind, label)` tuple to `METRICS` in
   `tier3-summarize.py`.

### Add another sweep dimension

The matrix is built from the `cells` array in `run-tier3-bench.sh`. To add a
sweep over, e.g., `wal-bytes-per-sync`, extend the array and pass the new
flag through to `test-node.bash` (which would need a corresponding CLI arg
and env-var passthrough — same pattern as `--pebble-sync-mode`).

## Known deviation from the original plan

The plan included a Stylus call as 10% of the mix. nitro-testnode only has a
`StylusDeployer` *factory*, not a callable Stylus program. Activating a real
Stylus contract requires `cargo-stylus` + WASM activation which is significant
scope. Since the benchmark's purpose is Pebble write-path stress (state
writes per block / commit cadence), the Stylus slot was substituted with
another contract creation. If you want a real Stylus call, compile a small
Stylus program once, embed its activated bytecode + address in
`mixedLoad.ts`, and add a `stylus` case to `buildSignableTx`.
