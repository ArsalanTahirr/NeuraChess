"""Build the NeuraChess master evaluation dataset from selected Lichess row groups."""

import argparse
import hashlib
import json
import logging
import os
import random
import re
import sqlite3
import tempfile
import time
from collections import Counter
from contextlib import closing
from functools import lru_cache
from itertools import zip_longest
from pathlib import Path

import chess
import pyarrow as pa
import pyarrow.parquet as pq
from httpx2 import TransportError
from huggingface_hub import HfApi, HfFileSystem
from huggingface_hub.errors import HfHubHTTPError

LOGGER = logging.getLogger(__name__)
SOURCE = "Lichess/chess-position-evaluations"
DEFAULT_REVISION = "8c5285259fdbf3218bf2582de9775dd1378f520b"
SOURCE_SCHEMA = {
    "fen": pa.string(),
    "depth": pa.uint8(),
    "knodes": pa.int32(),
    "cp": pa.int16(),
    "mate": pa.int8(),
}
COLUMNS = list(SOURCE_SCHEMA)
BATCH_SIZE = 32_768
PHASES = ("opening", "middlegame", "endgame")
BUCKETS = ("strong_black", "moderate_black", "equal", "moderate_white", "strong_white")
STRATA = [(phase, bucket) for phase in PHASES for bucket in BUCKETS]
OUTPUT_SCHEMA = pa.schema(
    [
        pa.field("fen", pa.string(), nullable=False),
        pa.field("cp", pa.int16(), nullable=False),
        pa.field("raw_cp", pa.int16(), nullable=False),
        pa.field("depth", pa.uint8(), nullable=False),
        pa.field("eval_bucket", pa.string(), nullable=False),
        pa.field("game_phase", pa.string(), nullable=False),
    ]
)
SCORE_SPEC = (
    "https://github.com/lichess-org/lila/blob/master/modules/evalCache/src/main/BSONHandlers.scala",
    "https://github.com/lichess-org/database/blob/master/src/main/scala/Evals.scala",
)
UPSERT = """
    INSERT INTO positions VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(position) DO UPDATE SET
        depth=excluded.depth, knodes=excluded.knodes, quality=excluded.quality,
        raw_cp=excluded.raw_cp, stratum=excluded.stratum
    WHERE (excluded.depth, excluded.knodes, excluded.quality) >
          (positions.depth, positions.knodes, positions.quality)
"""


def positive_int(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("expected a positive integer")
    return number


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target-count", type=positive_int, default=1_000_000)
    parser.add_argument("--min-depth", type=positive_int, default=16)
    parser.add_argument("--clip-cp", type=positive_int, default=1500)
    parser.add_argument("--max-scan-rows", type=positive_int, default=8_000_000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--revision", default=DEFAULT_REVISION, help="Hub commit, tag or branch"
    )
    parser.add_argument("--output-dir", type=Path, default=Path("data"))
    return parser.parse_args()


def remote_read(operation, description, *args):
    # The Hub retries HTTP transport failures and transient statuses internally.
    # Retry a whole projected read if Arrow saw an incomplete response.
    for attempt in range(3):
        try:
            return operation(*args)
        except (OSError, TransportError, pa.ArrowInvalid) as error:
            if isinstance(error, HfHubHTTPError):
                status = error.response.status_code
                if status not in (408, 429) and status < 500:
                    raise RuntimeError(
                        f"Hub returned HTTP {status} reading {description}"
                    ) from error
            if attempt == 2:
                raise RuntimeError(
                    f"Could not read {description} after three attempts"
                ) from error
            LOGGER.warning("Retrying %s after %s", description, type(error).__name__)
            time.sleep(2**attempt)


def source_info(revision):
    api = HfApi(token=False)
    info = remote_read(
        lambda: api.dataset_info(SOURCE, revision=revision, expand=["sha", "siblings"]),
        "Hub dataset metadata",
    )
    shards = sorted(
        entry.rfilename
        for entry in (info.siblings or [])
        if re.fullmatch(r"data/data_\d+\.parquet", entry.rfilename)
    )
    if not info.sha or not shards:
        raise RuntimeError(
            "The requested revision has no commit SHA or recognized train shards"
        )
    return info.sha, shards


def projected_group(fs, path, metadata, groups, seed):
    with fs.open(path, "rb", cache_type="none") as remote:
        parquet = pq.ParquetFile(remote, metadata=metadata, pre_buffer=True)
        if metadata is None:
            for name, dtype in SOURCE_SCHEMA.items():
                if (
                    name not in parquet.schema_arrow.names
                    or parquet.schema_arrow.field(name).type != dtype
                ):
                    raise RuntimeError(
                        f"Unexpected type or missing column {name!r} in {path}"
                    )
            metadata = parquet.metadata
            groups = list(range(metadata.num_row_groups))
            random.Random(f"{seed}/{path}").shuffle(groups)
        if not groups:
            return metadata, groups, None
        group = groups[-1]
        return metadata, groups, parquet.read_row_group(group, columns=COLUMNS)


def scan_groups(revision, shards, max_rows, seed):
    """Yield projected slices and their provenance in seeded shard/row-group order."""
    fs = HfFileSystem(token=False)
    order = sorted(shards)
    rng = random.Random(seed)
    rng.shuffle(order)
    shard_state = {}
    remaining = max_rows
    while order and remaining:
        next_round = []
        for shard in order:
            path = f"hf://datasets/{SOURCE}@{revision}/{shard}"
            metadata, groups = shard_state.get(shard, (None, None))
            metadata, groups, table = remote_read(
                projected_group, shard, fs, path, metadata, groups, seed
            )
            if table is None:
                continue
            group = groups.pop()
            if groups:
                shard_state[shard] = (metadata, groups)
                next_round.append(shard)
            else:
                shard_state.pop(shard, None)
            size = min(remaining, table.num_rows)
            offset = rng.randrange(table.num_rows - size + 1)
            remaining -= size
            row_group = metadata.row_group(group)
            yield (
                table.slice(offset, size),
                {
                    "shard": shard,
                    "row_group": group,
                    "row_group_rows": table.num_rows,
                    "offset": offset,
                    "scanned_rows": size,
                    "projected_compressed_bytes": sum(
                        column.total_compressed_size
                        for index in range(row_group.num_columns)
                        if (column := row_group.column(index)).path_in_schema
                        in SOURCE_SCHEMA
                    ),
                },
            )
            if remaining == 0:
                return
        order = next_round


def eval_bucket(cp):
    if cp < -500:
        return 0
    if cp < -150:
        return 1
    if cp <= 150:
        return 2
    if cp <= 500:
        return 3
    return 4


def game_phase(board):
    """Use remaining material and minor pieces still on their home squares."""
    material = (
        (board.knights | board.bishops).bit_count()
        + 2 * board.rooks.bit_count()
        + 4 * board.queens.bit_count()
    )
    if material <= 8:
        return 2
    home_minors = (
        (board.knights & board.occupied_co[chess.WHITE] & (chess.BB_B1 | chess.BB_G1))
        | (board.bishops & board.occupied_co[chess.WHITE] & (chess.BB_C1 | chess.BB_F1))
        | (board.knights & board.occupied_co[chess.BLACK] & (chess.BB_B8 | chess.BB_G8))
        | (board.bishops & board.occupied_co[chess.BLACK] & (chess.BB_C8 | chess.BB_F8))
    )
    if (
        material >= 20
        and board.pawns.bit_count() >= 12
        and home_minors.bit_count() >= 4
    ):
        return 0
    return 1


@lru_cache(maxsize=4096)
def normalize_fen(fen):
    if not fen:
        return None
    fields = fen.split()
    if len(fields) not in (4, 6):
        return None
    try:
        board = chess.Board(" ".join(fields))
    except ValueError:
        return None
    if not board.is_valid():
        return None
    board.halfmove_clock = 0
    board.fullmove_number = 1
    # Keep the en passant square only when a legal capture changes the moves.
    key = board.fen(en_passant="legal").rsplit(" ", 2)[0]
    return key, board.turn, game_phase(board)


def collect_batch(db, batch, min_depth, counts):
    columns = batch.to_pydict()
    winners = {}
    counts["scanned_rows"] += batch.num_rows
    for fen, depth, knodes, cp, mate in zip(
        *(columns[name] for name in COLUMNS), strict=True
    ):
        if depth is None or depth == 0 or (cp is None) == (mate is None):
            counts["invalid_evaluation_rows"] += 1
            continue
        if depth < min_depth:
            counts["below_min_depth_rows"] += 1
            continue
        position = normalize_fen(fen)
        if position is None:
            counts["invalid_fen_rows"] += 1
            continue
        key, white_to_move, phase = position
        direction = 1 if white_to_move else -1
        stratum = None
        if mate is None:
            # Lichess exports White-relative cp unchanged, even when Black moves.
            quality = direction * cp
            stratum = phase * len(BUCKETS) + eval_bucket(cp)
            counts["eligible_cp_rows"] += 1
        else:
            mate_for_mover = direction * mate
            # At the same depth and node count, choose the best PV for the mover.
            # Winning mates beat finite scores, and finite scores beat losing mates.
            quality = (100_000 if mate_for_mover >= 0 else -100_000) - mate_for_mover
            counts["eligible_mate_rows"] += 1
        rank = depth, knodes if knodes is not None else -1, quality
        previous = winners.get(key)
        if previous is None or rank > previous[:3]:
            winners[key] = (*rank, cp, stratum)
    db.executemany(UPSERT, ((key, *winner) for key, winner in winners.items()))


def allocate_quotas(target, available):
    """Water-fill equal quotas, capping each stratum at its unique population."""
    quotas = [0] * len(available)
    remaining = min(target, sum(available))
    while remaining:
        active = [
            index for index, count in enumerate(available) if quotas[index] < count
        ]
        share, extra = divmod(remaining, len(active))
        for offset, index in enumerate(active):
            added = min(share + (offset < extra), available[index] - quotas[index])
            quotas[index] += added
            remaining -= added
    return quotas


def write_parquet(db, path, quotas, seed, clip, revision):
    seed_key = hashlib.sha256(str(seed).encode()).digest()

    def priority(position):
        return hashlib.blake2b(position.encode(), digest_size=8, key=seed_key).digest()

    db.create_function("sample_priority", 1, priority, deterministic=True)
    db.execute(
        """CREATE INDEX sample_order
        ON positions(stratum, sample_priority(position), position) WHERE stratum IS NOT NULL"""
    )
    cursors = [
        db.execute(
            """SELECT position, raw_cp, depth, stratum FROM positions WHERE stratum = ?
            ORDER BY sample_priority(position), position LIMIT ?""",
            (index, quota),
        )
        for index, quota in enumerate(quotas)
        if quota
    ]
    schema = OUTPUT_SCHEMA.with_metadata(
        {"source": SOURCE, "source_revision": revision}
    )
    output = []
    clipped_by_stratum = Counter()
    with pq.ParquetWriter(path, schema, compression="zstd") as writer:
        for group in zip_longest(*cursors):
            for row in group:
                if row is None:
                    continue
                key, raw_cp, depth, stratum = row
                cp = max(-clip, min(clip, raw_cp))
                if cp != raw_cp:
                    clipped_by_stratum[stratum] += 1
                phase, bucket = STRATA[stratum]
                output.append((f"{key} 0 1", cp, raw_cp, depth, bucket, phase))
            if len(output) >= BATCH_SIZE:
                write_batch(writer, output, schema)
                output.clear()
        if output:
            write_batch(writer, output, schema)
    return clipped_by_stratum


def write_batch(writer, rows, schema):
    writer.write_batch(
        pa.RecordBatch.from_arrays(
            [
                pa.array(values, type=field.type)
                for values, field in zip(zip(*rows), schema, strict=True)
            ],
            schema=schema,
        )
    )


def build(args):
    revision, shards = source_info(args.revision)
    LOGGER.info("Source revision %s has %d shards", revision, len(shards))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    counts = Counter(
        scanned_rows=0,
        invalid_evaluation_rows=0,
        below_min_depth_rows=0,
        invalid_fen_rows=0,
        eligible_cp_rows=0,
        eligible_mate_rows=0,
    )
    scanned_groups = []
    with tempfile.TemporaryDirectory(
        prefix=".dataset-build-", dir=args.output_dir
    ) as scratch:
        scratch = Path(scratch)
        parquet_path = scratch / "chess_positions.parquet"
        report_path = scratch / "dataset_report.json"
        with closing(sqlite3.connect(scratch / "positions.sqlite")) as db:
            # This database is disposable and never reused after a failed run.
            db.executescript("""
                PRAGMA journal_mode=OFF;
                PRAGMA synchronous=OFF;
                PRAGMA cache_size=-65536;
                CREATE TABLE positions (
                    position TEXT PRIMARY KEY, depth INTEGER NOT NULL,
                    knodes INTEGER NOT NULL, quality INTEGER NOT NULL,
                    raw_cp INTEGER, stratum INTEGER
                ) WITHOUT ROWID;
            """)
            for table, group in scan_groups(
                revision, shards, args.max_scan_rows, args.seed
            ):
                LOGGER.info(
                    "Processing %s row group %d (%s rows)",
                    group["shard"],
                    group["row_group"],
                    f"{group['scanned_rows']:,}",
                )
                with db:
                    for batch in table.to_batches(max_chunksize=BATCH_SIZE):
                        collect_batch(db, batch, args.min_depth, counts)
                scanned_groups.append(group)
                LOGGER.info(
                    "Scanned %s/%s rows",
                    f"{counts['scanned_rows']:,}",
                    f"{args.max_scan_rows:,}",
                )

            unique_counts = dict(
                db.execute("SELECT stratum, COUNT(*) FROM positions GROUP BY stratum")
            )
            available = [unique_counts.get(index, 0) for index in range(len(STRATA))]
            quotas = allocate_quotas(args.target_count, available)
            if not sum(quotas):
                raise RuntimeError(
                    "No eligible non-mate positions found within the scan budget"
                )
            LOGGER.info(
                "Sampling %s of %s unique non-mate positions",
                f"{sum(quotas):,}",
                f"{sum(available):,}",
            )
            clipped = write_parquet(
                db, parquet_path, quotas, args.seed, args.clip_cp, revision
            )

        equal_quotas = allocate_quotas(
            args.target_count, [args.target_count] * len(STRATA)
        )
        strata = [
            {
                "game_phase": phase,
                "eval_bucket": bucket,
                "initial_quota": equal_quotas[index],
                "available": available[index],
                "selected": quotas[index],
                "clipped": clipped[index],
                "underrepresented": quotas[index] < equal_quotas[index],
            }
            for index, (phase, bucket) in enumerate(STRATA)
        ]
        with parquet_path.open("rb") as file:
            parquet_sha256 = hashlib.file_digest(file, "sha256").hexdigest()
        report = {
            "source": SOURCE,
            "source_revision": revision,
            "source_split": "train",
            "score_perspective": "white",
            "score_perspective_references": SCORE_SPEC,
            "projected_columns": COLUMNS,
            "source_shards": len(shards),
            "scanned_groups": scanned_groups,
            "projected_compressed_bytes": sum(
                group["projected_compressed_bytes"] for group in scanned_groups
            ),
            "seed": args.seed,
            "target_count": args.target_count,
            "max_scan_rows": args.max_scan_rows,
            "min_depth": args.min_depth,
            "clip_cp": args.clip_cp,
            "rows": counts,
            "eligible_nonmate_unique_positions": sum(available),
            "unique_positions_excluded_as_mate": unique_counts.get(None, 0),
            "eligible_duplicate_rows": counts["eligible_cp_rows"]
            + counts["eligible_mate_rows"]
            - sum(unique_counts.values()),
            "selected_positions": sum(quotas),
            "shortfall": args.target_count - sum(quotas),
            "clipped_positions": sum(clipped.values()),
            "strata": strata,
            "sampling_scope": "Uses the deepest qualifying evaluation observed in the scanned slices. "
            "Seeded key ranks select positions within strata after unused quotas are redistributed.",
            "parquet_sha256": parquet_sha256,
        }
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        publish((parquet_path, report_path), args.output_dir)
    if report["shortfall"]:
        LOGGER.warning(
            "Scan came up %s positions short of the target", f"{report['shortfall']:,}"
        )
    LOGGER.info(
        "Wrote %s and %s",
        args.output_dir / parquet_path.name,
        args.output_dir / report_path.name,
    )


def publish(paths, output_dir):
    # Serialize publication without creating an extra lock file. Each rename is atomic.
    import fcntl

    for path in paths:
        with path.open("rb") as file:
            os.fsync(file.fileno())
    directory = os.open(output_dir, os.O_RDONLY | os.O_DIRECTORY)
    try:
        fcntl.flock(directory, fcntl.LOCK_EX)
        for path in paths:
            os.replace(path, output_dir / path.name)
        os.fsync(directory)
    finally:
        os.close(directory)


def main():
    logging.basicConfig(format="%(levelname)s %(message)s", level=logging.WARNING)
    LOGGER.setLevel(logging.INFO)
    try:
        build(parse_args())
    except KeyboardInterrupt:
        LOGGER.error(
            "Build interrupted. Restart the command to repeat the same planned scan."
        )
        return 130
    except (RuntimeError, OSError, pa.ArrowException, sqlite3.Error) as error:
        LOGGER.error("Could not build the dataset (%s)", error)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
