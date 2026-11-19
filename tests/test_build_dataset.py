import hashlib
import json
from argparse import Namespace
from pathlib import Path

import chess
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from scripts import build_dataset as dataset


@pytest.mark.parametrize(
    ("score", "bucket"),
    [
        (-501, 0),
        (-500, 1),
        (-151, 1),
        (-150, 2),
        (150, 2),
        (151, 3),
        (500, 3),
        (501, 4),
    ],
)
def test_bucket_edges(score, bucket):
    assert dataset.eval_bucket(score) == bucket


def test_canonical_fen_keeps_legal_en_passant():
    fen = "4k3/8/8/3pP3/8/8/8/4K3 w - d6"
    position, _, _ = dataset.normalize_fen(fen)
    assert position == fen
    assert dataset.normalize_fen(f"{fen} 17 42")[0] == position
    assert dataset.normalize_fen(fen.replace("d6", "-"))[0] != position


def test_build_resolves_duplicates_across_projected_shards(tmp_path, monkeypatch):
    board = chess.Board()
    board.push_san("e4")
    after_e4 = board.fen()
    after_e4_with_ep = board.fen(en_passant="fen")
    mate_position = "6k1/6p1/8/4K3/4NN2/8/8/8 w - -"
    endgame = "8/4r3/2R2pk1/6pp/3P4/6K1/5P1P/8 b - -"
    shards = {
        "data/data_0000.parquet": [
            (after_e4, 16, 100, -260, None),
            (chess.STARTING_FEN, 29, 200, 150, None),
            (mate_position, 23, 100, 32, None),
            ("invalid", 20, 100, 12, None),
            (after_e4, 23, 100, None, None),
            (endgame, 10, 100, 500, None),
        ],
        "data/data_0001.parquet": [
            (after_e4_with_ep, 30, 200, 1800, None),
            (after_e4, 30, 200, 2000, None),
            (after_e4, 30, 199, 10, None),
            (mate_position, 95, 200, None, 15),
            (endgame, 40, 100, -500, None),
            (endgame, 51, 100, -900, 9),
        ],
    }
    source_schema = pa.schema(dict(dataset.SOURCE_SCHEMA, line=pa.string()))
    for name, values in shards.items():
        path = tmp_path / name
        path.parent.mkdir(exist_ok=True)
        rows = [
            dict(zip(dataset.COLUMNS, row, strict=True), line="e2e4") for row in values
        ]
        pq.write_table(
            pa.Table.from_pylist(rows, schema=source_schema), path, row_group_size=3
        )

    fail_next_open = True

    class LocalShards:
        def open(self, path, mode, *, cache_type):
            nonlocal fail_next_open
            if fail_next_open:
                fail_next_open = False
                raise OSError("simulated interruption")
            assert cache_type == "none"
            return (tmp_path / "data" / Path(path).name).open(mode)

    monkeypatch.setattr(
        dataset, "source_info", lambda revision: (revision, list(shards))
    )
    monkeypatch.setattr(dataset, "HfFileSystem", lambda **_: LocalShards())
    monkeypatch.setattr(dataset.time, "sleep", lambda _: None)
    monkeypatch.setattr(dataset, "BATCH_SIZE", 2)
    args = Namespace(
        revision="pinned",
        output_dir=tmp_path / "output",
        max_scan_rows=12,
        min_depth=16,
        target_count=4,
        clip_cp=1500,
        seed=42,
    )
    dataset.build(args)

    parquet_path = args.output_dir / "chess_positions.parquet"
    report_path = args.output_dir / "dataset_report.json"
    rows = {row["fen"]: row for row in pq.read_table(parquet_path).to_pylist()}
    e4_key = after_e4.rsplit(" ", 2)[0] + " 0 1"
    assert len(rows) == 3
    assert rows[e4_key] == {
        "fen": e4_key,
        "cp": 1500,
        "raw_cp": 1800,
        "depth": 30,
        "eval_bucket": "strong_white",
        "game_phase": "opening",
    }
    assert rows[endgame + " 0 1"]["eval_bucket"] == "moderate_black"
    assert all(not fen.startswith(mate_position) for fen in rows)
    report = json.loads(report_path.read_text())
    assert report["rows"]["scanned_rows"] == 12
    assert report["rows"]["invalid_evaluation_rows"] == 2
    assert report["rows"]["invalid_fen_rows"] == 1
    assert report["eligible_duplicate_rows"] == 4
    assert report["unique_positions_excluded_as_mate"] == 1
    assert report["selected_positions"] == 3
    assert report["clipped_positions"] == 1
    assert report["shortfall"] == 1
    assert len(report["scanned_groups"]) == 4
    assert (
        report["parquet_sha256"]
        == hashlib.sha256(parquet_path.read_bytes()).hexdigest()
    )

    dataset.build(args)
    assert json.loads(report_path.read_text()) == report

    def unavailable(*args, **kwargs):
        raise OSError("simulated persistent interruption")

    monkeypatch.setattr(LocalShards, "open", unavailable)
    with pytest.raises(RuntimeError, match="after three attempts"):
        dataset.build(args)
    assert json.loads(report_path.read_text()) == report
    assert (
        hashlib.sha256(parquet_path.read_bytes()).hexdigest()
        == report["parquet_sha256"]
    )
    assert {path.name for path in args.output_dir.iterdir()} == {
        "chess_positions.parquet",
        "dataset_report.json",
    }


def test_quotas_redistribute_thin_strata():
    assert dataset.allocate_quotas(12, [1, 20, 0, 20]) == [1, 6, 0, 5]
