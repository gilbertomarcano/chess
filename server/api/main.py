# main.py

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import chess
from ..models.models import (
    HumanMoveRequest, MoveMetadata, AnalysisResponse
)
from ..core.stockfish_utils import get_stockfish_analysis

# --- App setup ---
app = FastAPI(
    title="Chess API with LLM",
    description="API for chess game logic, analysis, and LLM-powered chat/explanations.",
    version="0.5.1",
)

@app.on_event("startup")
async def startup_event():
    print('Startup Event')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

@app.post("/api/v1/board/human/move", response_model=MoveMetadata)
async def process_human_move(request_data: HumanMoveRequest):
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
        san = board.san(move)
        is_capture = board.is_capture(move)
        board.push(move)
        return MoveMetadata(
            new_fen=board.fen(), move_san=san, is_capture=is_capture,
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
