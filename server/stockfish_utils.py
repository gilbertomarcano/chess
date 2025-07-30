# stockfish_utils.py

import chess
import chess.engine
from fastapi import HTTPException
from .config import STOCKFISH_PATH
from .models import AnalysisResponse, EngineMoveEvaluation

async def get_stockfish_analysis(fen: str, analysis_time_limit: float = 1.0, multi_pv_count: int = 3) -> AnalysisResponse:
    engine = None
    transport = None
    try:
        transport, engine = await chess.engine.popen_uci(STOCKFISH_PATH)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail=f"Stockfish engine not found: {STOCKFISH_PATH}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start Stockfish: {type(e).__name__} - {str(e)}")

    board = chess.Board(fen)
    if board.is_game_over():
        if engine: await engine.quit()
        return AnalysisResponse(fen_analyzed=fen)

    processed_results = []
    try:
        analysis_list = await engine.analyse(board, chess.engine.Limit(time=analysis_time_limit), multipv=multi_pv_count)
        if not isinstance(analysis_list, list):
            analysis_list = [analysis_list] if analysis_list else []
        for i, info in enumerate(analysis_list):
            if not (isinstance(info, dict) and info.get('pv') and info['pv']): continue
            move = info['pv'][0]
            score = info.get('score')
            score_cp_white_perspective, mate_in_current_player = None, None
            if score:
                pov_score = score.pov(board.turn)
                if pov_score.is_mate():
                    mate_in_current_player = pov_score.mate()
                else:
                    score_cp_white_perspective = pov_score.score() if board.turn == chess.WHITE else -pov_score.score()
            temp_board = board.copy()
            move_san = temp_board.san(move)
            pv_sans = [move_san]
            temp_board.push(move)
            for pv_m in info['pv'][1:]:
                try:
                    pv_sans.append(temp_board.san(pv_m))
                    temp_board.push(pv_m)
                except:
                    break
            processed_results.append(EngineMoveEvaluation(
                rank=info.get('multipv', i + 1), move_uci=move.uci(), move_san=move_san,
                score_cp=score_cp_white_perspective,
                mate_in=mate_in_current_player,
                pv=pv_sans
            ))
            if len(processed_results) >= multi_pv_count: break
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        if engine: await engine.quit()
    sorted_results = sorted(processed_results, key=lambda x: x.rank)
    best_eval = sorted_results[0] if sorted_results else None
    return AnalysisResponse(
        fen_analyzed=fen,
        best_move_uci=best_eval.move_uci if best_eval else None,
        best_move_san=best_eval.move_san if best_eval else None,
        evaluation=best_eval, top_moves=sorted_results
    )
