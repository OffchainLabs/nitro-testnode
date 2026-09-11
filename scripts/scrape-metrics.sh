#!/usr/bin/env bash
# Polls the sequencer's expvar metrics endpoint at a fixed interval and emits a
# CSV row per sample. Designed to be killed with SIGTERM by the driver script;
# on exit it leaves the CSV closed cleanly.
#
# Usage: scrape-metrics.sh <run-id> [endpoint] [interval-sec]
#   run-id        - identifier used in the output filename (e.g. "nosync_heavy")
#   endpoint      - default http://localhost:6070/debug/metrics
#   interval-sec  - default 1

set -eu

run_id="${1:?usage: $0 <run-id> [endpoint] [interval-sec]}"
endpoint="${2:-http://localhost:6070/debug/metrics}"
interval="${3:-1}"

mydir="$(cd "$(dirname "$0")" && pwd)"
results_dir="${mydir}/../results/tier3"
mkdir -p "$results_dir"
out="${results_dir}/${run_id}.csv"

# Histograms we care about. Counters and percentiles are extracted from each.
metrics=(
    "arb/block/writetodb"
    "arb/sequencer/block/creation"
)
# Counters/gauges (just .count or scalar value).
counters=(
    "chain/inserts"
)

# Header.
{
    printf "ts_unix"
    for m in "${metrics[@]}"; do
        printf ",%s.count,%s.p50_ns,%s.p95_ns,%s.p99_ns,%s.mean_ns" "$m" "$m" "$m" "$m" "$m"
    done
    for c in "${counters[@]}"; do
        printf ",%s.count" "$c"
    done
    printf "\n"
} > "$out"

# Build the jq filter once. Missing keys yield empty fields (no error).
jq_filter='[(now | floor)'
for m in "${metrics[@]}"; do
    jq_filter+=", (.[\"${m}.count\"] // \"\"), (.[\"${m}.50-percentile\"] // \"\"), (.[\"${m}.95-percentile\"] // \"\"), (.[\"${m}.99-percentile\"] // \"\"), (.[\"${m}.mean\"] // \"\")"
done
for c in "${counters[@]}"; do
    jq_filter+=", (.[\"${c}.count\"] // .[\"${c}\"] // \"\")"
done
jq_filter+='] | @csv'

trap 'echo "scrape-metrics: stopping, wrote $(( $(wc -l < "'"$out"'") - 1 )) samples to '"$out"'"; exit 0' TERM INT

while true; do
    if row=$(curl -fsS --max-time 5 "$endpoint" | jq -r "$jq_filter" 2>/dev/null); then
        # jq @csv quotes everything as strings; strip quotes for numeric parsing.
        echo "$row" | tr -d '"' >> "$out"
    fi
    sleep "$interval"
done
