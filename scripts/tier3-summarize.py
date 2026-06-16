#!/usr/bin/env python3
"""Reads the 4 tier-3 CSVs produced by scrape-metrics.sh and emits a markdown
table comparing NoSync vs Sync at the {heavy, light} workload densities.

Filename convention (set by run-tier3-bench.sh):
  {nosync,sync}_{heavy,light}.csv

Aggregation rules:
  - Skip the first WARMUP_SEC seconds of each run (sequencer cold cache, etc.).
  - For percentiles: take the median of the per-sample values across the
    steady-state window. Histograms are sample-based and already smoothed,
    so per-sample medians are stable representatives.
  - For counts: report (last - first) over the steady-state window — this is
    the activity that happened in that window, comparable across cells.
  - Times are reported in milliseconds (raw values are nanoseconds).
"""

import csv
import statistics
import sys
from pathlib import Path

WARMUP_SEC = 60
NS_PER_MS = 1_000_000.0

METRICS = [
    ("arb/block/writetodb.count",        "count",  "arb/block/writetodb count"),
    ("arb/block/writetodb.p50_ns",       "p_ms",   "arb/block/writetodb p50"),
    ("arb/block/writetodb.p95_ns",       "p_ms",   "arb/block/writetodb p95"),
    ("arb/sequencer/block/creation.count",  "count", "arb/sequencer/block/creation count"),
    ("arb/sequencer/block/creation.p50_ns", "p_ms", "arb/sequencer/block/creation p50"),
    ("arb/sequencer/block/creation.p95_ns", "p_ms", "arb/sequencer/block/creation p95"),
    ("chain/inserts.count",              "count",  "chain/inserts count"),
]

CELLS = [
    ("nosync_heavy", "NoSync heavy"),
    ("sync_heavy",   "Sync heavy"),
    ("nosync_light", "NoSync light"),
    ("sync_light",   "Sync light"),
]


def load_cell(path: Path) -> dict[str, list[float]]:
    """Reads a CSV and returns column -> list of floats (warmup skipped)."""
    cols: dict[str, list[float]] = {}
    with path.open() as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    if not rows:
        return cols
    t0 = float(rows[0]["ts_unix"])
    for row in rows:
        if float(row["ts_unix"]) - t0 < WARMUP_SEC:
            continue
        for k, v in row.items():
            if k == "ts_unix" or v == "":
                continue
            try:
                cols.setdefault(k, []).append(float(v))
            except ValueError:
                pass
    return cols


def aggregate(values: list[float], kind: str) -> float | None:
    if not values:
        return None
    if kind == "count":
        return values[-1] - values[0]
    if kind == "p_ms":
        return statistics.median(values) / NS_PER_MS
    raise ValueError(kind)


def fmt(v: float | None, kind: str) -> str:
    if v is None:
        return "n/a"
    if kind == "count":
        return f"{int(v)}"
    if kind == "p_ms":
        return f"{v:.3f} ms"
    return str(v)


def wins(nosync: float | None, sync: float | None, kind: str) -> str:
    if kind == "count":
        return "—"
    if not nosync or not sync:
        return "n/a"
    ratio = sync / nosync if nosync > 0 else 0
    if ratio < 1.1 and ratio > 0.9:
        return "tie"
    return f"{ratio:.1f}×"


def print_combined_table(cells: dict[str, dict[str, list[float]]]) -> None:
    print("## Combined matrix")
    print()
    print("| metric | NoSync heavy | Sync heavy | wins by | NoSync light | Sync light | wins by |")
    print("|---|---|---|---|---|---|---|")
    for col, kind, label in METRICS:
        vals = {cell_id: aggregate(cells[cell_id].get(col, []), kind) for cell_id, _ in CELLS}
        print(
            f"| {label} | {fmt(vals['nosync_heavy'], kind)} | {fmt(vals['sync_heavy'], kind)} | "
            f"{wins(vals['nosync_heavy'], vals['sync_heavy'], kind)} | "
            f"{fmt(vals['nosync_light'], kind)} | {fmt(vals['sync_light'], kind)} | "
            f"{wins(vals['nosync_light'], vals['sync_light'], kind)} |"
        )


def print_split_table(
    cells: dict[str, dict[str, list[float]]],
    nosync_id: str,
    sync_id: str,
    title: str,
) -> None:
    print(f"## {title}")
    print()
    print("| metric | NoSync | Sync | wins by |")
    print("|---|---|---|---|")
    for col, kind, label in METRICS:
        nosync = aggregate(cells[nosync_id].get(col, []), kind)
        sync = aggregate(cells[sync_id].get(col, []), kind)
        print(
            f"| {label} | {fmt(nosync, kind)} | {fmt(sync, kind)} | {wins(nosync, sync, kind)} |"
        )


def main(csv_dir: Path) -> int:
    cells: dict[str, dict[str, list[float]]] = {}
    for cell_id, _ in CELLS:
        path = csv_dir / f"{cell_id}.csv"
        if not path.exists():
            print(f"warning: missing {path}", file=sys.stderr)
            cells[cell_id] = {}
            continue
        cells[cell_id] = load_cell(path)

    print_combined_table(cells)
    print()
    print_split_table(cells, "nosync_heavy", "sync_heavy", "Heavy workload (NoSync vs Sync)")
    print()
    print_split_table(cells, "nosync_light", "sync_light", "Light workload (NoSync vs Sync)")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <results-dir>", file=sys.stderr)
        sys.exit(1)
    sys.exit(main(Path(sys.argv[1])))
