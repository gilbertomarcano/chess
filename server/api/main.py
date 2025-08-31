# main.py

from fastapi import FastAPI, HTTPException, Query, Header
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware

import chess
from ..models.models import (
    HumanMoveRequest, MoveMetadata, AnalysisResponse,
    GameStateUpdate, GameState
)
from ..core.stockfish_utils import get_stockfish_analysis
from ..core.db import init_db, insert_game_id, list_game_ids, update_game_state, get_game_state

import uuid

# --- App setup ---
app = FastAPI(
    title="Chess API with LLM",
    description="API for chess game logic, analysis, and LLM-powered chat/explanations.",
    version="0.5.1",
)

# Standard starting position FEN
STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

@app.on_event("startup")
async def startup_event():
    # Initialize SQLite and ensure schema exists
    try:
        init_db()
    except Exception as e:
        print(f"DB init error: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

@app.post("/api/v1/board/human/move", response_model=MoveMetadata)
async def process_human_move(
    request_data: HumanMoveRequest,
    game_id: Optional[str] = Header(default=None, alias='X-Game-Id'),
    game_id_q: Optional[str] = Query(default=None, alias='game_id'),
):
    try:
        board = chess.Board(request_data.fen)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid FEN string: {str(e)}")
    move_uci_str = request_data.from_square + request_data.to_square
    if request_data.promotion:
        move_uci_str += request_data.promotion.lower()
    try:
        move = board.parse_uci(move_uci_str)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid UCI: {move_uci_str} - {e}")
    if move in board.legal_moves:
        # capture details before push
        is_white_to_move_before = board.turn == chess.WHITE
        fullmove_before = board.fullmove_number
        san = board.san(move)
        is_capture = board.is_capture(move)
        board.push(move)
        new_fen = board.fen()

        # Persist to DB if possible
        gid = game_id or game_id_q
        if gid:
            try:
                state = get_game_state(gid)
                if state is not None:
                    current_pgn = (state.get('pgn') or '').strip()
                    if current_pgn:
                        if is_white_to_move_before:
                            updated_pgn = f"{current_pgn} {fullmove_before}. {san}"
                        else:
                            updated_pgn = f"{current_pgn} {san}"
                    else:
                        if is_white_to_move_before:
                            updated_pgn = f"{fullmove_before}. {san}"
                        else:
                            updated_pgn = f"{fullmove_before}... {san}"
                    update_game_state(gid, fen=new_fen, pgn=updated_pgn)
                    try:
                        print(f"[DB] Updated game {gid}: fen updated, pgn now '{updated_pgn[:50] + ('...' if len(updated_pgn) > 50 else '')}'")
                    except Exception:
                        pass
            except Exception as e:
                print(f"Warning: failed to update game state for {gid}: {e}")

        return MoveMetadata(
            new_fen=new_fen, move_san=san, is_capture=is_capture,
            is_castle=board.is_castling(move),
            is_kingside_castle=board.is_kingside_castling(move),
            is_queenside_castle=board.is_queenside_castling(move),
            is_check=board.is_check(), is_checkmate=board.is_checkmate(),
            is_stalemate=board.is_stalemate(), is_draw=board.is_game_over() and not board.is_checkmate(),
            is_game_over=board.is_game_over(), uci=move.uci()
        )
    else:
        raise HTTPException(status_code=422, detail=f"Illegal move: {move_uci_str}")

@app.get("/api/v1/analyze/moves", response_model=AnalysisResponse)
async def analyze_position_with_engine(
    fen: str = Query(...),
    time_limit: float = Query(1.0, ge=0.1, le=10.0),
    num_lines: int = Query(5, ge=1, le=24)
):
    if not fen:
        raise HTTPException(status_code=400, detail="FEN required.")
    try:
        chess.Board(fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid FEN.")
    try:
        return await get_stockfish_analysis(fen, analysis_time_limit=time_limit, multi_pv_count=num_lines)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Chess API v0.5.1 with LLM chat is running. Use /docs for API documentation."}


# --- Game ID endpoints ---
@app.post("/api/v1/games/new")
async def create_new_game_id():
    """Generate a new UUID and insert into the DB, return the id."""
    try:
        new_id = str(uuid.uuid4())
        insert_game_id(new_id)
        # Initialize with starting FEN and empty PGN to avoid NULLs
        try:
            update_game_state(new_id, fen=STARTING_FEN, pgn="")
        except Exception as _:
            # Non-fatal: keep id creation even if init state fails
            pass
        return {"id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create new game id: {e}")


@app.get("/api/v1/games")
async def list_games():
    """Return all game ids (newest first if available)."""
    try:
        ids = list_game_ids()
        return {"ids": ids}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list game ids: {e}")


@app.get("/api/v1/games/{game_id}", response_model=GameState)
async def get_game(game_id: str):
    try:
        state = get_game_state(game_id)
        if not state:
            raise HTTPException(status_code=404, detail="Game not found")
        return state
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/v1/games/{game_id}", response_model=GameState)
async def patch_game_state(game_id: str, payload: GameStateUpdate):
    try:
        # ensure game exists
        if not get_game_state(game_id):
            raise HTTPException(status_code=404, detail="Game not found")
        update_game_state(game_id, fen=payload.fen, pgn=payload.pgn)
        state = get_game_state(game_id)
        return state
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to update game: {e}")
