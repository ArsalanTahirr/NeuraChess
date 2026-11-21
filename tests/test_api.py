from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event
from uuid import uuid4

import chess
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from neurachess import search
from neurachess.api import engine as api_engine
from neurachess.api.app import create_app
from neurachess.api.schemas import GameState, SearchResult
from neurachess.neural import evaluator as neural

CHECKPOINT = Path("checkpoints/model_v001.pt")
MATE_IN_ONE = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"
BLACK_MATE_IN_ONE = chess.Board(MATE_IN_ONE).mirror().fen()


@pytest.fixture
def checkpoint():
    return CHECKPOINT


@pytest.fixture
def client(checkpoint):
    with TestClient(create_app(checkpoint)) as client:
        yield client


def create_game(client, **settings):
    response = client.post("/games", json=settings)
    assert response.status_code == 201, response.text
    return GameState.model_validate(response.json())


def update(client, game, endpoint, **data):
    response = client.post(
        f"/games/{game.id}/{endpoint}", json={"revision": game.revision, **data}
    )
    assert response.status_code == 200, response.text
    return GameState.model_validate(response.json())


def assert_history(game):
    board = chess.Board(game.initial_fen)
    for record in game.move_history:
        move = chess.Move.from_uci(record.uci)
        assert record.san == board.san(move)
        assert record.move_number == board.fullmove_number
        assert record.color == ("w" if board.turn else "b")
        board.push(move)
        assert record.fen == board.fen()
    assert board.fen() == game.fen
    assert game.turn == ("w" if board.turn else "b")
    assert game.is_check == board.is_check()


def test_white_game_move_reply_continue_undo_and_reset(client):
    game = create_game(client, maxDepth=2, timeLimitMs=1200)
    other = create_game(client, playerColor="black")
    assert game.id != other.id
    assert game.fen == game.initial_fen == chess.STARTING_FEN
    assert game.revision == 0

    played = update(client, game, "moves", move="e2e4")
    assert played.move_history[-1].san == "e4"
    assert played.revision == 1
    reply = update(client, played, "engine-move")
    assert reply.revision == 2
    assert reply.last_search.fen == played.fen
    assert reply.last_search.move == reply.move_history[-1].uci
    assert reply.last_search.time_ms == reply.move_history[-1].time_ms
    assert reply.last_search.evaluation_mode == "material"
    assert reply.last_search.depth == 2
    assert reply.last_search.status == "completed"
    assert_history(reply)

    next_move = next(iter(chess.Board(reply.fen).legal_moves)).uci()
    continued = update(client, reply, "moves", move=next_move)
    assert_history(continued)
    assert continued.last_search is None

    undone_once = update(client, continued, "undo")
    assert undone_once.fen == reply.fen
    assert undone_once.move_history == reply.move_history
    undone_pair = update(client, undone_once, "undo")
    assert undone_pair.fen == chess.STARTING_FEN
    assert not undone_pair.move_history
    assert not undone_pair.last_search

    reset = update(client, undone_pair, "reset")
    assert reset.settings == game.settings
    assert reset.revision == 6
    assert GameState.model_validate(client.get(f"/games/{game.id}").json()) == reset
    assert GameState.model_validate(client.get(f"/games/{other.id}").json()) == other


def test_black_game_keeps_engine_opening_on_undo(client):
    game = create_game(client, playerColor="black", maxDepth=1)
    opening = update(client, game, "engine-move")
    assert opening.turn == "b"
    assert (
        client.post(
            f"/games/{game.id}/undo", json={"revision": opening.revision}
        ).json()["detail"]["code"]
        == "nothing_to_undo"
    )

    move = next(iter(chess.Board(opening.fen).legal_moves)).uci()
    played = update(client, opening, "moves", move=move)
    reply = update(client, played, "engine-move")
    undone = update(client, reply, "undo")
    assert undone.fen == opening.fen
    assert undone.move_history == opening.move_history
    assert_history(undone)


@pytest.mark.parametrize(
    "move,status,code",
    [
        ("nonsense", 422, "invalid_uci"),
        ("e2e2", 422, "invalid_uci"),
        ("e2e5", 400, "illegal_move"),
        ("e7e5", 400, "illegal_move"),
    ],
)
def test_invalid_move_does_not_change_game(client, move, status, code):
    game = create_game(client)
    response = client.post(
        f"/games/{game.id}/moves", json={"revision": game.revision, "move": move}
    )
    assert response.status_code == status
    assert response.json()["detail"]["code"] == code
    assert GameState.model_validate(client.get(f"/games/{game.id}").json()) == game


@pytest.mark.parametrize(
    "fen,move,san,captured,move_number",
    [
        ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 12", "e5d6", "exd6", "p", 12),
        ("4k3/8/8/8/8/8/p7/4K3 b - - 0 27", "a2a1r", "a1=R+", None, 27),
        ("4k3/8/8/8/8/8/8/4K2R w K - 0 3", "e1g1", "O-O", None, 3),
    ],
)
def test_special_moves_from_fen(client, fen, move, san, captured, move_number):
    game = create_game(
        client, fen=fen, playerColor="black" if " b " in fen else "white"
    )
    played = update(client, game, "moves", move=move)
    record = played.move_history[-1]
    assert (record.san, record.captured, record.move_number) == (
        san,
        captured,
        move_number,
    )
    assert_history(played)
    assert update(client, played, "undo").fen == game.initial_fen


def test_checkmate_resignation_and_reset_with_new_settings(client):
    game = create_game(client, fen=MATE_IN_ONE)
    finished = update(client, game, "moves", move="a1a8")
    assert finished.outcome.model_dump() == {
        "result": "white",
        "reason": "checkmate",
        "winner": "white",
    }
    assert (
        client.post(
            f"/games/{game.id}/engine-move", json={"revision": finished.revision}
        ).json()["detail"]["code"]
        == "finished_game"
    )
    assert update(client, finished, "undo").outcome is None

    game = create_game(client)
    resigned = update(client, game, "resign")
    assert resigned.outcome.reason == "resignation"
    assert resigned.outcome.winner == "black"
    assert update(client, resigned, "undo").outcome is None

    game = create_game(client)
    reset = update(
        client,
        game,
        "reset",
        fen=BLACK_MATE_IN_ONE,
        settings={"playerColor": "black", "evaluationMode": "neural", "maxDepth": 1},
    )
    assert reset.settings.evaluation_mode == "neural"
    assert reset.settings.player_color == "black"
    assert (reset.fen, reset.initial_fen, reset.turn) == (
        BLACK_MATE_IN_ONE,
        BLACK_MATE_IN_ONE,
        "b",
    )


@pytest.mark.parametrize(
    "fen,reason",
    [
        ("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "stalemate"),
        ("4k3/8/8/8/8/8/8/4K3 w - - 0 1", "insufficient-material"),
        ("4k3/8/8/8/8/8/8/R3K3 b - - 100 60", "fifty-move"),
        ("4k3/8/8/8/8/8/8/R3K3 b - - 150 85", "seventyfive-move"),
    ],
)
def test_terminal_draws(client, fen, reason):
    game = create_game(client, fen=fen)
    assert game.outcome.result == "draw"
    assert game.outcome.reason == reason
    result = SearchResult.model_validate(
        client.post("/analyze", json={"fen": fen}).json()
    )
    assert result.status == "terminal"
    assert result.move is result.mate is None
    assert result.score_cp == 0


def test_threefold_uses_full_move_history(client, monkeypatch):
    # Both sides repeat their knight shuffles to reach three occurrences.
    responses = iter(["g8f6", "f6g8"] * 2)

    def repeating_move(board, options):
        uci = next(responses)
        return SearchResult(
            fen=board.fen(),
            evaluation_mode=options.evaluation_mode,
            move=uci,
            san=board.san(chess.Move.from_uci(uci)),
            score_cp=0,
            mate=None,
            depth=1,
            time_ms=0,
            status="completed",
        )

    monkeypatch.setattr(
        api_engine.Engine, "search", lambda self, *args: repeating_move(*args)
    )
    game = create_game(client, maxDepth=1)
    for move in ["g1f3", "f3g1"] * 2:
        game = update(client, game, "moves", move=move)
        assert game.outcome is None
        game = update(client, game, "engine-move")
    assert game.outcome.reason == "threefold-repetition"
    assert_history(game)
    assert update(client, game, "undo").outcome is None


@pytest.mark.parametrize("turn", ["w", "b"])
def test_material_scores_have_white_perspective_and_centipawn_units(client, turn):
    fen = f"4k3/8/8/8/8/8/8/R3K3 {turn} - - 0 1"
    board = chess.Board(fen)
    for endpoint in ("/move", "/analyze"):
        response = client.post(endpoint, json={"fen": fen, "maxDepth": 1})
        assert response.status_code == 200
        assert "scoreCp" in response.json()
        result = SearchResult.model_validate(response.json())
        assert result.score_cp == 500
        assert result.mate is None
        assert result.depth == 1
        assert chess.Move.from_uci(result.move) in board.legal_moves


@pytest.mark.parametrize(
    "fen,winner", [(MATE_IN_ONE, "white"), (BLACK_MATE_IN_ONE, "black")]
)
def test_mate_distance_and_terminal_winner_have_distinct_fields(client, fen, winner):
    response = client.post("/analyze", json={"fen": fen, "maxDepth": 1})
    result = SearchResult.model_validate(response.json())
    assert result.score_cp is None
    assert result.mate.model_dump() == {"winner": winner, "plies": 1}
    board = chess.Board(fen)
    board.push_uci(result.move)
    terminal = SearchResult.model_validate(
        client.post("/analyze", json={"fen": board.fen()}).json()
    )
    assert terminal.status == "terminal"
    assert terminal.move is terminal.san is terminal.score_cp is None
    assert terminal.mate.model_dump() == {"winner": winner, "plies": 0}


@pytest.mark.parametrize("checkpoint", [CHECKPOINT, Path("checkpoints/nnue_v001.pt")])
def test_real_neural_checkpoint_search_reuse_and_mode_switch(
    client, monkeypatch, checkpoint
):
    if not checkpoint.is_file():
        pytest.skip(f"Real trained checkpoint required at {checkpoint}")
    actual_evaluator = neural.NeuralEvaluator(checkpoint, require_architecture=True)
    load_calls = []

    def load_checkpoint(path, **kwargs):
        load_calls.append(path)
        return neural_evaluator_class(path, **kwargs)

    neural_evaluator_class = neural.NeuralEvaluator
    monkeypatch.setattr(neural, "NeuralEvaluator", load_checkpoint)
    game = create_game(client, playerColor="black", maxDepth=1, timeLimitMs=2500)
    switched = client.patch(
        f"/games/{game.id}/settings",
        json={
            "revision": game.revision,
            "search": {"evaluationMode": "neural"},
        },
    )
    assert switched.status_code == 200
    configured = GameState.model_validate(switched.json())
    assert configured.settings.evaluation_mode == "neural"
    assert configured.settings.player_color == "black"
    assert configured.settings.max_depth == 1
    assert configured.settings.time_limit_ms == 2500
    assert configured.fen == game.fen
    opening = update(client, configured, "engine-move")
    expected_move, score, depth = search.iterative_deepening_timed(
        chess.Board(), 1, 1.2, actual_evaluator.evaluate
    )
    assert opening.last_search.move == expected_move.uci()
    assert opening.last_search.score_cp == pytest.approx(score, abs=0.001)
    assert opening.last_search.depth == depth == 1

    board = chess.Board(opening.fen)
    analysis = SearchResult.model_validate(
        client.post(
            "/analyze",
            json={"fen": board.fen(), "evaluationMode": "neural", "maxDepth": 1},
        ).json()
    )
    _, black_root_score, expected_depth = search.iterative_deepening_timed(
        board, 1, 1.2, actual_evaluator.evaluate
    )
    assert analysis.score_cp == pytest.approx(-black_root_score, abs=0.001)
    assert analysis.depth == expected_depth == 1
    assert load_calls == [checkpoint]
    assert GameState.model_validate(client.get(f"/games/{game.id}").json()) == opening

    move = next(iter(board.legal_moves)).uci()
    played = update(client, opening, "moves", move=move)
    reply = update(client, played, "engine-move")
    assert reply.last_search.evaluation_mode == "neural"
    assert_history(reply)
    assert load_calls == [checkpoint]


@pytest.mark.parametrize("corrupt", [False, True])
def test_neural_loading_error_keeps_material_operational(tmp_path, corrupt):
    checkpoint = tmp_path / "unavailable.pt"
    if corrupt:
        checkpoint.write_text("Not a checkpoint")
    with TestClient(create_app(checkpoint)) as client:
        fen = chess.STARTING_FEN
        failed = client.post("/analyze", json={"fen": fen, "evaluationMode": "neural"})
        assert failed.status_code == 503
        assert failed.json()["detail"]["code"] == "neural_unavailable"
        ok = client.post("/analyze", json={"fen": fen, "maxDepth": 1})
        assert ok.status_code == 200
        assert ok.json()["evaluationMode"] == "material"


def test_timeout_reports_depth_zero_and_a_legal_fallback(client, monkeypatch):
    def expired(_):
        raise search.SearchTimeout

    monkeypatch.setattr(search, "check_timeout", expired)
    result = SearchResult.model_validate(
        client.post("/move", json={"fen": chess.STARTING_FEN, "timeLimitMs": 1}).json()
    )
    assert (result.status, result.depth, result.score_cp) == ("time-limit", 0, 0)
    assert chess.Move.from_uci(result.move) in chess.Board().legal_moves


def test_search_failure_does_not_change_game_and_can_be_retried(client, monkeypatch):
    game = create_game(client, playerColor="black", maxDepth=1)

    def fail(*args):
        raise RuntimeError("private failure details")

    with monkeypatch.context() as patch:
        patch.setattr(api_engine, "iterative_deepening_timed", fail)
        response = client.post(
            f"/games/{game.id}/engine-move", json={"revision": game.revision}
        )
    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "search_failed"
    assert "private" not in response.text
    assert GameState.model_validate(client.get(f"/games/{game.id}").json()) == game
    assert update(client, game, "engine-move").turn == "b"


def test_inflight_search_does_not_overwrite_reset_or_block_other_requests(
    client, monkeypatch
):
    game = create_game(client, playerColor="black", maxDepth=1)
    started, finish = Event(), Event()
    actual_search = api_engine.Engine.search

    def blocked_search(self, board, settings):
        started.set()
        assert finish.wait(10)
        return actual_search(self, board, settings)

    monkeypatch.setattr(api_engine.Engine, "search", blocked_search)
    with ThreadPoolExecutor(max_workers=1) as executor:
        response = executor.submit(
            client.post,
            f"/games/{game.id}/engine-move",
            json={"revision": game.revision},
        )
        try:
            assert started.wait(10)
            assert client.get("/health").json()["status"] == "ok"
            duplicate = client.post(
                f"/games/{game.id}/engine-move", json={"revision": game.revision}
            )
            assert duplicate.status_code == 409
            assert duplicate.json()["detail"]["code"] == "search_in_progress"
            reset = update(client, game, "reset", settings={"playerColor": "white"})
        finally:
            finish.set()
        assert response.result(timeout=10).json()["detail"]["code"] == "stale_game"
    assert GameState.model_validate(client.get(f"/games/{game.id}").json()) == reset
    assert not reset.move_history


@pytest.mark.parametrize(
    "payload,status,code",
    [
        ({"fen": "invalid"}, 400, "invalid_fen"),
        ({"fen": "8/8/8/8/8/8/8/8 w - - 0 1"}, 400, "invalid_fen"),
        (
            {"fen": chess.STARTING_FEN, "evaluationMode": "unsupported"},
            422,
            "invalid_request",
        ),
        ({"fen": chess.STARTING_FEN, "maxDepth": 7}, 422, "invalid_request"),
        ({"fen": chess.STARTING_FEN, "timeLimitMs": 0}, 422, "invalid_request"),
    ],
)
def test_analysis_validation(client, payload, status, code):
    response = client.post("/analyze", json=payload)
    assert response.status_code == status
    assert response.json()["detail"]["code"] == code


def test_missing_game_wrong_turn_and_response_validation(client):
    response = client.get(f"/games/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "game_not_found"
    game = create_game(client)
    response = client.post(
        f"/games/{game.id}/engine-move", json={"revision": game.revision}
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "wrong_turn"

    payload = client.post("/move", json={"fen": game.fen, "maxDepth": 1}).json()
    assert set(payload) == {
        "fen",
        "evaluationMode",
        "move",
        "san",
        "scoreCp",
        "mate",
        "depth",
        "timeMs",
        "status",
    }
    with pytest.raises(ValidationError):
        SearchResult.model_validate({**payload, "scoreCp": float("inf")})
    with pytest.raises(ValidationError):
        GameState.model_validate({**game.model_dump(), "turn": "unknown"})
