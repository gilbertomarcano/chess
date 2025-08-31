import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef, useCallback } from 'https://esm.sh/preact/hooks';

// --- Constants ---
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']; // Board renders from 8 down to 1
const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const API_BASE_URL = "http://127.0.0.1:8011/api/v1"; // Or pass as prop
const PIECE_SYMBOL_MAP = {
    'p': { 'b': '♟︎', 'w': '♙' }, 'r': { 'b': '♜', 'w': '♖' },
    'n': { 'b': '♞', 'w': '♘' }, 'b': { 'b': '♝', 'w': '♗' },
    'q': { 'b': '♛', 'w': '♕' }, 'k': { 'b': '♚', 'w': '♔' }
};

// --- Preact Chessboard Component ---
function ChessboardComponent(props) {
    // --- State Variables ---
    const initialFenFromProps = props.initialFen || INITIAL_FEN;
    const [fen, setFen] = useState(initialFenFromProps);
    const [boardState, setBoardState] = useState([]);
    const [selectedSquareId, setSelectedSquareId] = useState(null);
    const [legalMovesForSelected, setLegalMovesForSelected] = useState([]);
    const [analysisData, setAnalysisData] = useState(null);
    const [statusMessage, setStatusMessageContent] = useState({ text: "Initializing board...", isError: false });
    const [isBoardLocked, setIsBoardLocked] = useState(false);
    const [activePieceDots, setActivePieceDots] = useState({});
    const [moveEvaluations, setMoveEvaluations] = useState({});
    console.log(fen)

    // --- Refs ---
    const chessInstanceRef = useRef(null); // To store the chess.js instance
    const boardContainerRef = useRef(null); // Reference to board container for button placement
    const newGameButtonRef = useRef(null); // Store reference to injected New Game button

    // --- Utility Functions (useCallback for memoization) ---
    const getGameStatus = useCallback(() => {
        const chess = chessInstanceRef.current;
        if (!chess) {
            // console.warn("[getGameStatus] chessInstanceRef.current is null or undefined");
            return "Chess engine not ready.";
        }
        // Ensure core methods from chess.js 0.10.x are present
        if (typeof chess.in_checkmate !== 'function' || typeof chess.turn !== 'function') { 
            console.error("[getGameStatus] CRITICAL: Chess instance is missing core methods (e.g., in_checkmate, turn). Instance:", chess);
            return "Error: Chess instance invalid.";
        }

        let statusText = `Turn: ${chess.turn() === 'w' ? 'White' : 'Black'}.`;
        // Use the in_...() methods as per chess.js v0.10.x and your original code
        if (chess.in_checkmate()) { // CORRECTED
            statusText = `Checkmate! ${chess.turn() === 'b' ? 'White' : 'Black'} wins.`;
        } else if (chess.in_stalemate()) { // CORRECTED
            statusText = 'Stalemate! (Draw)';
        } else if (chess.in_threefold_repetition && chess.in_threefold_repetition()) { // CORRECTED & check existence
            statusText = 'Draw by threefold repetition!';
        } else if (chess.insufficient_material && chess.insufficient_material()) { // CORRECTED & check existence
            statusText = 'Draw by insufficient material!';
        } else if (chess.in_draw()) { // CORRECTED
            statusText = 'Draw!'; 
        } else if (chess.in_check()) { // CORRECTED
            statusText += ` ${chess.turn() === 'w' ? 'White' : 'Black'} is in check.`;
        }
        return statusText;
    }, [chessInstanceRef]); // chessInstanceRef itself is stable

    const updateDisplayStatus = useCallback((message, isError = false) => {
        setStatusMessageContent({ text: message || getGameStatus(), isError });
    }, [getGameStatus, setStatusMessageContent]);

    const triggerEngineAnalysis = useCallback(async (currentFenForAnalysis, timeLimit = 1.0, numLines = 24) => {
        if (!currentFenForAnalysis) {
            // console.warn("[triggerEngineAnalysis] called with no FEN.");
            return;
        }
        updateDisplayStatus("Fetching engine analysis...");
        const encodedFen = encodeURIComponent(currentFenForAnalysis);
        const analysisUrl = `${API_BASE_URL}/analyze/moves?fen=${encodedFen}&time_limit=${timeLimit}&num_lines=${numLines}`;
        try {
            const response = await fetch(analysisUrl);
            const responseText = await response.text();
            let newAnalysisData;
            try { newAnalysisData = JSON.parse(responseText); }
            catch (parseError) { throw new Error(`Server returned non-JSON analysis (Status: ${response.status}). Text: ${responseText}`); }
            if (!response.ok) {
                const errorMessage = newAnalysisData.detail || newAnalysisData.message || `Analysis error: ${response.status}`;
                throw new Error(errorMessage);
            }
            setAnalysisData(newAnalysisData);
            updateDisplayStatus("Analysis updated.");
        } catch (error) {
            // console.error("[triggerEngineAnalysis] Error:", error.message);
            updateDisplayStatus(`Analysis error: ${error.message}`, true);
            setAnalysisData(null);
        }
    }, [updateDisplayStatus, setAnalysisData, API_BASE_URL]);

    const loadFenAndUpdateBoard = useCallback((newFenToLoad) => {
        const chess = chessInstanceRef.current;
        // console.log("[loadFenAndUpdateBoard] Attempting to load FEN:", newFenToLoad, "Current chess instance:", chess);
        if (!chess) {
            // console.warn("[loadFenAndUpdateBoard] chessInstanceRef.current is not ready. Cannot load FEN:", newFenToLoad);
            updateDisplayStatus("Chess engine not initialized. Cannot load FEN.", true);
            return;
        }
        try {
            // Defensive check for the 'load' method
            if (typeof chess.load !== 'function') {
                console.error("[loadFenAndUpdateBoard] CRITICAL: chess.load is NOT a function. Instance:", chess);
                throw new Error("Chess instance invalid, 'load' method missing.");
            }
            const validLoad = chess.load(newFenToLoad);
            if (!validLoad) {
                // chess.load() returns false for invalid FEN, but doesn't throw typically.
                throw new Error(`chess.load() returned false for FEN: ${newFenToLoad}.`);
            }
            
            const currentLoadedFen = chess.fen(); // Make sure .fen() exists too
            setFen(currentLoadedFen);
            setBoardState(chess.board());
            updateDisplayStatus(getGameStatus()); // This will now use in_checkmate etc.
            setSelectedSquareId(null);
            setLegalMovesForSelected([]);
            setMoveEvaluations({});
            setActivePieceDots({});
            triggerEngineAnalysis(currentLoadedFen);
        } catch (e) {
            // console.error("[loadFenAndUpdateBoard] Error during FEN processing:", e, "FEN:", newFenToLoad);
            updateDisplayStatus(`Error processing FEN: ${e.message}`, true);
        }
    }, [chessInstanceRef, setFen, setBoardState, updateDisplayStatus, getGameStatus, setSelectedSquareId, setLegalMovesForSelected, setMoveEvaluations, setActivePieceDots, triggerEngineAnalysis]);

    const handleNewGame = useCallback(() => {
        const chess = chessInstanceRef.current;
        if (chess && typeof chess.reset === 'function') {
            chess.reset();
        }
        loadFenAndUpdateBoard(initialFenFromProps);
    }, [loadFenAndUpdateBoard, initialFenFromProps]);

    useEffect(() => {
        const boardEl = boardContainerRef.current;
        if (!boardEl || newGameButtonRef.current) return;
        const btn = document.createElement('button');
        btn.textContent = 'New Game';
        btn.id = 'new-game-button';
        btn.type = 'button';
        btn.addEventListener('click', handleNewGame);
        boardEl.insertAdjacentElement('afterend', btn);
        newGameButtonRef.current = btn;
        return () => {
            btn.removeEventListener('click', handleNewGame);
        };
    }, [handleNewGame]);
    
    // --- Initialization Effect ---
    useEffect(() => {
        // console.log("[Preact useEffect Init] Top. typeof window.Chess:", typeof window.Chess);
        if (typeof window.Chess !== 'function') {
            console.error("[Preact useEffect Init] CRITICAL: window.Chess is not a function/constructor!", window.Chess);
            updateDisplayStatus("CRITICAL: Chess.js library did not load as a constructor for Preact.", true);
            setIsBoardLocked(true);
            return;
        }

        if (!chessInstanceRef.current) { // Ensure it's only initialized once
            try {
                chessInstanceRef.current = new window.Chess(); // Explicitly use window.Chess
                // console.log("[Preact useEffect Init] Chess.js instance CREATED via Preact:", chessInstanceRef.current);
                // Check for a core method after creation
                if (typeof chessInstanceRef.current?.fen !== 'function') { // Using .fen() as a basic check
                    console.error("[Preact useEffect Init] CRITICAL: Newly created Chess instance (via Preact) LACKS core methods like .fen()!");
                    updateDisplayStatus("CRITICAL: Chess.js instance invalid after Preact creation (missing .fen).", true);
                    setIsBoardLocked(true);
                    return; 
                }
            } catch (e) {
                    console.error("[Preact useEffect Init] CRITICAL: Error instantiating Chess.js in Preact useEffect:", e);
                    updateDisplayStatus("CRITICAL: Error creating Chess.js instance in Preact.", true);
                    setIsBoardLocked(true);
                    return;
            }
        }
        
        // console.log("[Preact useEffect Init] Calling loadFenAndUpdateBoard with FEN:", fen);
        loadFenAndUpdateBoard(fen); // `fen` is from useState, initially `initialFenFromProps`

    }, [fen, loadFenAndUpdateBoard, updateDisplayStatus, setIsBoardLocked]); // `fen` is a key dependency here for initial load.

    const getMoveQualityClass = useCallback((scoreCp, mateIn, isWhiteToMoveInAnalyzedFen, isBestOverallForPiece = false, bestOverallScoreCpForTurn) => {
        if (mateIn !== null && mateIn !== undefined) { return mateIn > 0 ? {text: "eval-text-mate-positive", dot: "dot-mate-positive"} : {text: "eval-text-mate-negative", dot: "dot-mate-negative"}; }
        else if (scoreCp !== null && scoreCp !== undefined) {
            let currentMovePerspectiveScoreCp = isWhiteToMoveInAnalyzedFen ? scoreCp : -scoreCp;
            if (isBestOverallForPiece) return {text: "eval-text-best", dot: "dot-best"};
            const cpDrop = bestOverallScoreCpForTurn - currentMovePerspectiveScoreCp;
            const goodThresholdDrop = 20; const neutralThresholdDrop = 70; const badThresholdDrop = 150;
            if (cpDrop <= goodThresholdDrop) return {text: "eval-text-good", dot: "dot-good"};
            if (cpDrop <= neutralThresholdDrop) return {text: "eval-text-neutral", dot: "dot-neutral"};
            if (cpDrop <= badThresholdDrop) return {text: "eval-text-bad", dot: "dot-bad"};
            return {text: "eval-text-blunder", dot: "dot-blunder"};
        }
        return {text: "eval-text-neutral", dot: "dot-neutral"}; // Default
    }, []);

    const processAnalysisData = useCallback((currentAnalysis) => {
        const chess = chessInstanceRef.current;
        // Ensure chess instance and its 'moves' method are valid before proceeding
        if (!chess || typeof chess.moves !== 'function' || !currentAnalysis || !currentAnalysis.top_moves || currentAnalysis.top_moves.length === 0) {
            setActivePieceDots({}); setMoveEvaluations({}); return;
        }

        const boardForTurn = new window.Chess(currentAnalysis.fen_analyzed); // Use new Chess instance for analysis context safety
        const isWhiteToMoveInAnalyzedFen = boardForTurn.turn() === 'w';
        
        let bestOverallScoreCpForTurn;
        const engineBestMoveOverall = currentAnalysis.top_moves[0];
        if (engineBestMoveOverall.mate_in !== null && engineBestMoveOverall.mate_in !== undefined) {
            bestOverallScoreCpForTurn = engineBestMoveOverall.mate_in > 0 ? 10000 : -10000;
        } else if (engineBestMoveOverall.score_cp !== null && engineBestMoveOverall.score_cp !== undefined) {
            bestOverallScoreCpForTurn = isWhiteToMoveInAnalyzedFen ? engineBestMoveOverall.score_cp : -engineBestMoveOverall.score_cp;
        } else {
            bestOverallScoreCpForTurn = 0; // Fallback
        }

        const newActivePieceDots = {};
        const bestMovePerPiece = new Map();
        currentAnalysis.top_moves.forEach(move => {
            if (move && move.move_uci) {
                const fromSq = move.move_uci.substring(0, 2);
                let currentMovePerspectiveScoreCp;
                if (move.mate_in !== null && move.mate_in !== undefined) {
                    currentMovePerspectiveScoreCp = move.mate_in > 0 ? (10000 - Math.abs(move.mate_in)) : (-10000 + Math.abs(move.mate_in));
                } else if (move.score_cp !== null && move.score_cp !== undefined) {
                    currentMovePerspectiveScoreCp = isWhiteToMoveInAnalyzedFen ? move.score_cp : -move.score_cp;
                } else { return; } // Skip if no score

                if (!bestMovePerPiece.has(fromSq) || currentMovePerspectiveScoreCp > bestMovePerPiece.get(fromSq).perspectiveScore) {
                    bestMovePerPiece.set(fromSq, { uci: move.move_uci, score_cp_white: move.score_cp, mate_in: move.mate_in, perspectiveScore: currentMovePerspectiveScoreCp });
                }
            }
        });

        bestMovePerPiece.forEach((bestMoveForThisPiece, fromSq) => {
            const isThisTheOverallBestMove = bestMoveForThisPiece.uci === engineBestMoveOverall.move_uci;
            const qualityClasses = getMoveQualityClass(bestMoveForThisPiece.score_cp_white, bestMoveForThisPiece.mate_in, isWhiteToMoveInAnalyzedFen, isThisTheOverallBestMove, bestOverallScoreCpForTurn);
            if (qualityClasses.dot) newActivePieceDots[fromSq] = qualityClasses.dot;
        });
        setActivePieceDots(newActivePieceDots);

        if (selectedSquareId) {
            const newMoveEvals = {};
            const legalMovesForCurrentSelection = chess.moves({ square: selectedSquareId, verbose: true }); // Use main chess instance
            currentAnalysis.top_moves.forEach(evaluatedMove => {
                if (evaluatedMove && evaluatedMove.move_uci && evaluatedMove.move_uci.startsWith(selectedSquareId)) {
                    const isLegallyPossible = legalMovesForCurrentSelection.some(legalMove => legalMove.to === evaluatedMove.move_uci.substring(2,4) && legalMove.from === selectedSquareId);
                    if(!isLegallyPossible) return;

                    const toSq = evaluatedMove.move_uci.substring(2, 4);
                    const isThisTheBestOverallMove = evaluatedMove.move_uci === engineBestMoveOverall.move_uci;
                    const qualityClasses = getMoveQualityClass(evaluatedMove.score_cp, evaluatedMove.mate_in, isWhiteToMoveInAnalyzedFen, isThisTheBestOverallMove, bestOverallScoreCpForTurn);
                    let evalText = "";
                    if (evaluatedMove.mate_in !== null && evaluatedMove.mate_in !== undefined) {
                        evalText = 'M' + Math.abs(evaluatedMove.mate_in);
                    } else if (evaluatedMove.score_cp !== null && evaluatedMove.score_cp !== undefined) {
                        let scoreInPawnUnits = evaluatedMove.score_cp / 100.0;
                        evalText = (scoreInPawnUnits >= 0 ? "+" : "") + scoreInPawnUnits.toFixed(1);
                    } else { evalText = "?"; }
                    newMoveEvals[toSq] = { text: evalText, class: qualityClasses.text };
                }
            });
            setMoveEvaluations(newMoveEvals);
        } else {
                setMoveEvaluations({}); // Clear if no piece is selected
        }
    }, [chessInstanceRef, analysisData, selectedSquareId, getMoveQualityClass, setActivePieceDots, setMoveEvaluations]);
    
    // Effect for analysis data processing
    useEffect(() => {
        processAnalysisData(analysisData);
    }, [analysisData, selectedSquareId, processAnalysisData]);


    const submitMoveToServer = useCallback(async (currentFenOnClient, fromSquare, toSquare, promotion) => {
        setIsBoardLocked(true); updateDisplayStatus(`Submitting move ${fromSquare}-${toSquare}...`);
        setActivePieceDots({}); setMoveEvaluations({}); setLegalMovesForSelected([]);
        const payload = { fen: currentFenOnClient, from: fromSquare, to: toSquare }; if (promotion) payload.promotion = promotion;
        try {
            const response = await fetch(`${API_BASE_URL}/board/human/move`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) });
            const responseText = await response.text(); let responseData;
            try { responseData = JSON.parse(responseText); } catch (e) { throw new Error(`Non-JSON move response (Status:${response.status}). Text:${responseText}`); }
            if (!response.ok) throw new Error(responseData.detail || responseData.message || `Move error:${response.status}`);
            if (!responseData.new_fen) throw new Error("No 'new_fen' in response.");
            loadFenAndUpdateBoard(responseData.new_fen); 
            updateDisplayStatus(`Move: ${responseData.move_san || (fromSquare + '-' + toSquare)}. ${getGameStatus()}`);
        } catch (error) {
            // console.error("[submitMoveToServer] Error:", error.message);
            updateDisplayStatus(`Error: ${error.message}. Board reverted.`, true);
            loadFenAndUpdateBoard(currentFenOnClient); // Revert client
        } finally { setIsBoardLocked(false); }
    }, [API_BASE_URL, setIsBoardLocked, updateDisplayStatus, getGameStatus, loadFenAndUpdateBoard, setActivePieceDots, setMoveEvaluations, setLegalMovesForSelected]);

    const onSquareClick = useCallback(async (clickedSquareId) => {
        const chess = chessInstanceRef.current;
        // Ensure chess instance and its 'moves' method are valid before proceeding
        if (!chess || typeof chess.moves !== 'function' || (isBoardLocked && selectedSquareId !== clickedSquareId)) {
            if(isBoardLocked) updateDisplayStatus("Processing, please wait..."); 
            else if (!chess || typeof chess.moves !== 'function') updateDisplayStatus("Chess engine not ready for click.", true);
            return;
        }
        if (selectedSquareId) {
            if (selectedSquareId === clickedSquareId) { // Clicked the same square
                setSelectedSquareId(null); setLegalMovesForSelected([]);
                updateDisplayStatus(`Deselected. ${getGameStatus()}`);
            } else { // Clicked a different square (potential move)
                const movesForSelectedPiece = chess.moves({ square: selectedSquareId, verbose: true });
                const isLegalDestination = movesForSelectedPiece.some(move => move.to === clickedSquareId);
                if (isLegalDestination) {
                    const fromSq = selectedSquareId; const toSq = clickedSquareId; let promotionPiece = null;
                    const pieceBeingMoved = chess.get(fromSq);
                    if (pieceBeingMoved && pieceBeingMoved.type === 'p' && ((pieceBeingMoved.color === 'w' && toSq[1] === '8') || (pieceBeingMoved.color === 'b' && toSq[1] === '1'))) {
                        promotionPiece = 'q'; // Auto-queen
                    }
                    setSelectedSquareId(null); setLegalMovesForSelected([]); // Deselect before submitting
                    await submitMoveToServer(chess.fen(), fromSq, toSq, promotionPiece);
                } else { // Clicked an illegal square or another piece
                    const pieceOnClickedSquare = chess.get(clickedSquareId);
                    if (pieceOnClickedSquare && pieceOnClickedSquare.color === chess.turn()) { // Selected another of own pieces
                        setSelectedSquareId(clickedSquareId);
                        setLegalMovesForSelected(chess.moves({ square: clickedSquareId, verbose: true }).map(m => m.to));
                        updateDisplayStatus(`Selected ${PIECE_SYMBOL_MAP[pieceOnClickedSquare.type][pieceOnClickedSquare.color]} on ${clickedSquareId}. ${getGameStatus()}`);
                    } else { // Clicked an empty square or opponent piece not part of a legal move
                        setSelectedSquareId(null); setLegalMovesForSelected([]);
                        updateDisplayStatus(`Invalid move. ${getGameStatus()}`);
                    }
                }
            }
        } else { // No piece was selected, so select this one if valid
            const piece = chess.get(clickedSquareId);
            if (piece && piece.color === chess.turn()) {
                setSelectedSquareId(clickedSquareId);
                setLegalMovesForSelected(chess.moves({ square: clickedSquareId, verbose: true }).map(m => m.to));
                updateDisplayStatus(`Selected ${PIECE_SYMBOL_MAP[piece.type][piece.color]} on ${clickedSquareId}. ${getGameStatus()}`);
            }
        }
    }, [chessInstanceRef, isBoardLocked, selectedSquareId, updateDisplayStatus, getGameStatus, submitMoveToServer, setSelectedSquareId, setLegalMovesForSelected, PIECE_SYMBOL_MAP]);

    // --- Render Logic ---
    const renderSquares = () => { 
        const squares = [];
        for (let r_idx = 0; r_idx < 8; r_idx++) { // Corresponds to ranks 8 down to 1
            for (let f_idx = 0; f_idx < 8; f_idx++) { // Corresponds to files a up to h
                const squareId = FILES[f_idx] + RANKS[r_idx];
                const piece = boardState[r_idx] && boardState[r_idx][f_idx] ? boardState[r_idx][f_idx] : null;
                let squareClasses = "square " + ((r_idx + f_idx) % 2 === 0 ? 'light' : 'dark');
                if (squareId === selectedSquareId) squareClasses += ' selected-square';
                if (legalMovesForSelected.includes(squareId)) squareClasses += ' legal-move-highlight';
                if (activePieceDots[squareId]) squareClasses += ` active-piece-dot ${activePieceDots[squareId]}`;
                squares.push(html`
                    <div key=${squareId} id=${squareId} class=${squareClasses} onClick=${() => onSquareClick(squareId)}>
                        ${piece && html`<span class="piece ${piece.color === 'w' ? 'piece-white' : 'piece-black'}">${PIECE_SYMBOL_MAP[piece.type][piece.color]}</span>`}
                        ${moveEvaluations[squareId] && html`<div class="evaluation-text ${moveEvaluations[squareId].class}">${moveEvaluations[squareId].text}</div>`}
                    </div>`);
            }
        }
        return squares;
    };

    // More robust check for valid instance and board state before rendering full board
    if (!chessInstanceRef.current || typeof chessInstanceRef.current.fen !== 'function' || boardState.length === 0) {
            return html`<div class="board-container" ref=${boardContainerRef}><div id="status-message-preact" class="status-message ${statusMessage.isError ? 'error-message' : ''}">${statusMessage.text}</div></div>`;
    }

    return html`
        <div class="board-container" ref=${boardContainerRef}>
            <div class="board-wrapper">
                <div class="rank-labels">${RANKS.map(rank => html`<span key=${"rank-" + rank}>${rank}</span>`)}</div>
                <div class="chessboard">${renderSquares()}</div>
                <div class="file-labels">${FILES.map(file => html`<span key=${"file-" + file}>${file}</span>`)}</div>
            </div>
            <div id="status-message-preact" class="status-message ${statusMessage.isError ? 'error-message' : ''}">${statusMessage.text}</div>
        </div>`;
}

// Export the component to be used in other files
export default ChessboardComponent;