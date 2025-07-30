# models.py

from pydantic import BaseModel, Field
from typing import Optional, List

class HumanMoveRequest(BaseModel):
    fen: str
    from_square: str = Field(alias="from")
    to_square: str = Field(alias="to")
    promotion: Optional[str] = None

class MoveMetadata(BaseModel):
    new_fen: str
    move_san: str
    is_capture: bool
    is_castle: bool
    is_kingside_castle: bool
    is_queenside_castle: bool
    is_check: bool
    is_checkmate: bool
    is_stalemate: bool
    is_draw: bool
    is_game_over: bool
    uci: str

class EngineMoveEvaluation(BaseModel):
    rank: int
    move_uci: str
    move_san: str
    score_cp: Optional[int] = None
    mate_in: Optional[int] = None
    pv: List[str] = []

class AnalysisResponse(BaseModel):
    fen_analyzed: str
    best_move_uci: Optional[str] = None
    best_move_san: Optional[str] = None
    evaluation: Optional["EngineMoveEvaluation"] = None
    top_moves: List["EngineMoveEvaluation"] = []
