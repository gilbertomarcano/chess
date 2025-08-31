# Chess App

## Purpose
The app is an interactive chessboard that:
- Shows which piece the side to move should prefer playing next.
- When a piece is selected, shows every legal destination and the engine’s evaluation after that move.
- Uses colors both on pieces and on destination squares to communicate priority and move quality.

## Board Layout and Baseline UI
- Standard 8×8 chessboard with algebraic coordinates (files a–h, ranks 1–8).
- White appears at the bottom; Black at the top.
- A single status bar under the board displays state and turn. Example strings:
  - “Deselected. Turn: Black.” (when nothing is selected)
  - “Selected ♝ on c8. Turn: Black.” (when a bishop at c8 is selected)
  - “Selected ♞ on f6. Turn: Black.” (when a knight at f6 is selected)

## Two Interaction States
- **Idle:** No piece selected.
- **Piece selected:** One piece of the side to move is selected.

## Piece-Priority Dots (Idle State)
- In Idle, small colored dots appear on the pieces of the side to move only.
- Each piece has at most one dot.
- Exactly one piece carries a blue dot at a time.
- Meanings:
  - **Blue dot:** The single top candidate piece to move now.
  - **Green dot:** A good piece to play; it has at least one solid move.
  - **Yellow dot:** Playable but second-rate compared with better pieces.
  - **Red dot:** Risky or loose to move; typical moves worsen the evaluation or the piece is tactically sensitive.
- Dots are attached to pieces, not squares, and are visible only when nothing is selected.
- Only the side to move is annotated with dots; the opposing side shows no dots.

## Selecting a Piece
- Clicking a piece of the side to move changes the state to “Piece selected” for that piece.
- The origin square of the selected piece receives a solid green highlight.
- The status bar updates to “Selected [piece glyph] on [square]. Turn: [Color].”

## Legal Destinations (When a Piece is Selected)
- All legal destination squares for the selected piece are marked with a light blue outline.
- Some, many, or all of these outlined squares show a rounded label (“pill”) containing a signed decimal number.
- An outlined square without a pill is still a legal move; that square simply does not display a score in that view.

## Meaning of the Number Displayed in a Pill
- The number is the static engine evaluation of the position after making that move.
- Units are pawns (e.g., +0.9, −0.4).
- Positive means the resulting position favors White; negative means it favors Black.
- Since it is Black to move in the examples, “smaller is better for Black” (more negative or less positive).

## Pill Color (Quality Tier for the Selected Piece’s Moves)
Pill colors compare moves of the currently selected piece to one another.
- **Blue pill:** The best move among the selected piece’s legal moves, and the selected piece itself is also the global blue-dot piece.
- **Green pill:** The best (or near-best) move for the selected piece, when that piece is not the global blue-dot piece.
- **Yellow pill:** Clearly worse than that piece’s best move (inaccuracy tier for this piece).
- **Red pill:** Much worse than that piece’s best move (blunder tier for this piece).

Notes:
- Pill color does not encode “capture vs. quiet.” It communicates quality relative to the best move of the selected piece.
- The number in the pill is absolute (post-move evaluation); the pill color is relative (quality tier within this piece’s move set).

## Relationship Between Dots and Pills
- Dots rank pieces; pills grade squares.
- Exactly one piece has a blue dot at a time (global best piece).
- If the selected piece is the blue-dot piece, its best move appears with a blue pill.
- If the selected piece is not the blue-dot piece, its best move appears with a green pill.
- Yellow and red pills may appear on inferior destinations for the selected piece regardless of that piece’s dot color.

## Completing a Move
- Clicking an outlined destination square executes the move.
- The UI returns to Idle with the turn switched to the opponent.
- The set of piece-priority dots is recomputed for the new side to move and displayed again in Idle.

## Deterministic Behavior
- **Idle state:** For each piece of the side to move, the app considers that piece’s best obtainable post-move evaluation among its legal moves. The piece whose best obtainable evaluation is globally best receives the blue dot. Other pieces receive green, yellow, or red based on how promising their best obtainable evaluation is relative to the blue piece (and/or fixed thresholds).
- **Piece-selected state:** All legal destinations are outlined. For any destination that has an available score, the pill shows the evaluation after the move along with a quality color assigned by comparing that destination’s evaluation to the selected piece’s best evaluation.
- Exactly one selected piece at a time; selecting a different piece transfers selection. Clicking the same piece again or clicking away returns to Idle.

## What the Status Bar Communicates
- It always shows whose turn it is.
- It shows whether a piece is selected and, if so, which piece and from which square.

## Observed Examples
- When the bishop on c8 is selected, diagonal squares such as b7, d7, e6, f5, g4, h3 are outlined. Among them, e6 is marked as the best for that bishop (green pill). Moves like d7 and g4 are marked as blunders for that bishop (red pills).
- When the knight on f6 is selected and that knight carries the blue dot in Idle, one of its destinations (for example, h7 in the provided position) shows a blue pill as the best move overall. Other destinations such as e8 or h5 can be marked with red pills as blunders for that knight.

## Terminology
- **Dot (piece dot):** Colored marker on a piece of the side to move in Idle that ranks pieces by priority: blue (top), then green, then yellow, then red.
- **Pill:** Rounded label on a legal destination square that shows the post-move evaluation number and a quality color for that destination relative to the selected piece’s best move.
- **Post-move evaluation:** Engine score after hypothetically making a move; positive favors White, negative favors Black.
- **Outlined square:** Legal destination for the selected piece.

## Answers to Common Questions
- Blue dot indicates the single top candidate piece to move for the side to move.
- Green/yellow/red dots indicate decreasing desirability of moving that piece now; green = good piece to play, yellow = playable but second-rate, red = risky/loose.
- Numbers on destination squares are the engine’s evaluation after that move (in pawns). Positive favors White; negative favors Black.
- Pill colors grade the destinations for the selected piece: blue = best and the piece is also the global best piece, green = best for this non-blue piece, yellow = inferior compared to the piece’s best, red = much worse.
- Only the side to move shows dots. Dots rank pieces; pills grade squares.
- Some outlined squares may have no pill; they remain legal moves but no score is displayed there in that view.

## Edge Observations
- Pills appear on both capture and non-capture destinations; color is about quality, not move type.
- A destination can be outlined without a pill.
- The status bar always reports the turn and selection state.

---

## Setup Instructions

### Requirements
- Python 3.13
- Stockfish

### Setup

1. **Install dependencies (MacOS):**
    ```sh
    brew install python @3.13
    echo 'export PATH="$(brew --prefix)/opt/python@3.13/bin:$PATH"' >> ~/.zshrc

    brew install stockfish
    ```

2. **Create the virtual environment:**
    ```sh
    cd server
    python3.13 -m venv env
    source env/bin/activate
    pip install -r requirements.txt
    ```

3. **Run the backend and frontend:**
    From the project root:
    ```sh
    make run
    ```
    This will start both the FastAPI backend and the static file server for the client.

4. **Open the app:**
    - Visit [http://localhost:8000](http://localhost:8000) in your browser for the client.
    - The backend runs on port 8011.

---