#!/usr/bin/env bash
# Drives the tier-3 NoSync vs Sync benchmark matrix.
#
# Matrix: {sync, nosync} x {heavy, light} = 4 cells.
# Per cell:
#   1. Tear down any existing testnode state.
#   2. Boot testnode (init + detach) with the cell's sync-mode flag.
#   3. Wait for sequencer readiness.
#   4. Run mixed-load generator + metrics scraper concurrently for $DURATION.
#   5. Stop scraper, tear down testnode.
# After the matrix, render the comparison markdown table.
#
# Env overrides:
#   DURATION         steady-state seconds per cell (default 900 = 15 min)
#   WARMUP_BLOCKS    blocks to wait for after boot before starting load (default 5)
#   HEAVY_SENDERS    override sender count for heavy cells (default: mixedLoad.ts default)
#   HEAVY_DELAY_MS   override per-sender delay (ms) for heavy cells
#   LIGHT_SENDERS    override sender count for light cells
#   LIGHT_DELAY_MS   override per-sender delay (ms) for light cells
#
# Run from nitro-testnode/ root:
#   ./scripts/run-tier3-bench.sh
#   HEAVY_SENDERS=12 HEAVY_DELAY_MS=30 ./scripts/run-tier3-bench.sh

set -eu

mydir="$(cd "$(dirname "$0")" && pwd)"
cd "${mydir}/.."

DURATION="${DURATION:-900}"
WARMUP_BLOCKS="${WARMUP_BLOCKS:-5}"
RPC_URL="${RPC_URL:-http://localhost:8547}"
METRICS_URL="${METRICS_URL:-http://localhost:6070/debug/metrics}"
HEAVY_SENDERS="${HEAVY_SENDERS:-}"
HEAVY_DELAY_MS="${HEAVY_DELAY_MS:-}"
LIGHT_SENDERS="${LIGHT_SENDERS:-}"
LIGHT_DELAY_MS="${LIGHT_DELAY_MS:-}"

results_dir="${PWD}/results/tier3"
mkdir -p "$results_dir"

cells=(
    "false:heavy:nosync_heavy"
    "true:heavy:sync_heavy"
    "false:light:nosync_light"
    "true:light:sync_light"
)

wait_for_block() {
    local target="$1"
    local deadline=$(( $(date +%s) + 180 ))
    while [[ $(date +%s) -lt $deadline ]]; do
        local hex
        hex=$(curl -fsS --max-time 2 -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
            "$RPC_URL" 2>/dev/null | jq -r '.result // empty' || true)
        if [[ -n "$hex" && "$hex" != "null" ]]; then
            local n=$((hex))
            if [[ $n -ge $target ]]; then
                echo "sequencer ready at block $n"
                return 0
            fi
        fi
        sleep 2
    done
    echo "ERROR: sequencer did not reach block $target within 180s" >&2
    return 1
}

wait_for_metrics() {
    local deadline=$(( $(date +%s) + 60 ))
    while [[ $(date +%s) -lt $deadline ]]; do
        if curl -fsS --max-time 2 "$METRICS_URL" >/dev/null 2>&1; then
            echo "metrics endpoint ready at $METRICS_URL"
            return 0
        fi
        sleep 1
    done
    echo "ERROR: metrics endpoint $METRICS_URL not reachable within 60s" >&2
    return 1
}

run_cell() {
    local sync_mode="$1"
    local load="$2"
    local run_id="$3"

    echo "============================================================"
    echo "cell: ${run_id} (sync-mode=${sync_mode}, load=${load})"
    echo "============================================================"

    echo "[$run_id] tearing down any existing testnode state..."
    docker compose down -v --remove-orphans >/dev/null 2>&1 || true

    echo "[$run_id] booting testnode..."
    ./test-node.bash --init --no-l2-traffic --pebble-sync-mode "$sync_mode" --detach

    wait_for_block "$WARMUP_BLOCKS"
    wait_for_metrics

    echo "[$run_id] starting metrics scraper..."
    ./scripts/scrape-metrics.sh "$run_id" "$METRICS_URL" 1 &
    local scraper_pid=$!

    local gen_args=(--load="$load" --duration="$DURATION")
    if [[ "$load" == "heavy" ]]; then
        [[ -n "$HEAVY_SENDERS" ]] && gen_args+=(--senders="$HEAVY_SENDERS")
        [[ -n "$HEAVY_DELAY_MS" ]] && gen_args+=(--delay-ms="$HEAVY_DELAY_MS")
    else
        [[ -n "$LIGHT_SENDERS" ]] && gen_args+=(--senders="$LIGHT_SENDERS")
        [[ -n "$LIGHT_DELAY_MS" ]] && gen_args+=(--delay-ms="$LIGHT_DELAY_MS")
    fi

    echo "[$run_id] starting mixed-load generator (${gen_args[*]})..."
    docker compose run --rm scripts gen-mixed-load "${gen_args[@]}" || {
        echo "[$run_id] WARNING: generator exited non-zero" >&2
    }

    echo "[$run_id] stopping scraper..."
    kill -TERM "$scraper_pid" 2>/dev/null || true
    wait "$scraper_pid" 2>/dev/null || true

    echo "[$run_id] tearing down testnode..."
    docker compose down -v --remove-orphans >/dev/null 2>&1 || true

    echo "[$run_id] done. CSV: ${results_dir}/${run_id}.csv"
}

for cell in "${cells[@]}"; do
    IFS=':' read -r sync_mode load run_id <<< "$cell"
    run_cell "$sync_mode" "$load" "$run_id"
done

echo "============================================================"
echo "matrix complete. summarizing..."
echo "============================================================"
python3 "${mydir}/tier3-summarize.py" "$results_dir" | tee "${results_dir}/summary.md"
echo
echo "summary written to ${results_dir}/summary.md"
