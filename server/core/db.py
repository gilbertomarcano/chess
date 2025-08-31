import os
import sqlite3
from typing import List, Optional

SERVER_DIR = os.path.dirname(os.path.dirname(__file__))
DB_DIR = os.path.join(SERVER_DIR, 'data')
DB_PATH = os.path.join(DB_DIR, 'chess.db')


def _ensure_data_dir():
    os.makedirs(DB_DIR, exist_ok=True)


def init_db():
    """
    Ensure the database file and schema exist.
    Schema:
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY
      );
    """
    _ensure_data_dir()
    with sqlite3.connect(DB_PATH) as conn:
        # Base table
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY
            );
            """
        )
        # Migrate: ensure columns fen and pgn exist
        cursor = conn.execute("PRAGMA table_info(games)")
        cols = {row[1] for row in cursor.fetchall()}  # row[1] is column name
        if 'fen' not in cols:
            conn.execute("ALTER TABLE games ADD COLUMN fen TEXT")
        if 'pgn' not in cols:
            conn.execute("ALTER TABLE games ADD COLUMN pgn TEXT")
        conn.commit()


def insert_game_id(game_id: str) -> None:
    """Insert a game id into the database."""
    _ensure_data_dir()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO games (id) VALUES (?)", (game_id,))
        conn.commit()


def list_game_ids() -> List[str]:
    """Return all game ids. Newest first by rowid if available."""
    _ensure_data_dir()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute("SELECT id FROM games ORDER BY rowid DESC")
        return [row[0] for row in cursor.fetchall()]


def update_game_state(game_id: str, fen: Optional[str] = None, pgn: Optional[str] = None) -> None:
    """Update fen and/or pgn for a game id."""
    if fen is None and pgn is None:
        return
    _ensure_data_dir()
    with sqlite3.connect(DB_PATH) as conn:
        if fen is not None and pgn is not None:
            conn.execute("UPDATE games SET fen = ?, pgn = ? WHERE id = ?", (fen, pgn, game_id))
        elif fen is not None:
            conn.execute("UPDATE games SET fen = ? WHERE id = ?", (fen, game_id))
        else:
            conn.execute("UPDATE games SET pgn = ? WHERE id = ?", (pgn, game_id))
        conn.commit()


def get_game_state(game_id: str) -> Optional[dict]:
    """Return a dict with id, fen, pgn for the given game id, or None if not found."""
    _ensure_data_dir()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute("SELECT id, fen, pgn FROM games WHERE id = ?", (game_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {"id": row[0], "fen": row[1], "pgn": row[2]}
