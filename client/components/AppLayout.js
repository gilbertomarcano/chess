// AppLayout.js
import { html } from 'https://esm.sh/htm/preact';
import { useEffect, useState } from 'https://esm.sh/preact/hooks';
import { DEFAULT_INITIAL_FEN, DEFAULT_API_BASE_URL } from '../config.js';
import ChessboardComponent from './ChessboardComponent.js?v=evalbar-7';

function AppLayout(props) {
    const {
        initialFen = DEFAULT_INITIAL_FEN,
        apiBaseUrl = DEFAULT_API_BASE_URL,
    } = props;

    // Game id state and UI flags
    const [currentGameId, setCurrentGameId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showLoadList, setShowLoadList] = useState(false);
    const [availableIds, setAvailableIds] = useState([]);
    const [loadedFen, setLoadedFen] = useState(initialFen);
    const [loadedPgn, setLoadedPgn] = useState('');

    // Clean up any stray legacy buttons labeled exactly "New Game" and keep removing if they appear later
    useEffect(() => {
        const removeStray = () => {
            try {
                // Remove any element with id 'new-game-button'
                document.querySelectorAll('#new-game-button').forEach(el => el.remove());
                // Remove any element that looks like a "New Game" button (case-insensitive, contains)
                const candidates = document.querySelectorAll('button, [role="button"], .btn, .button, a, div');
                candidates.forEach(btn => {
                    const txt = (btn.textContent || btn.innerText || '').trim().toLowerCase();
                    if (txt && txt === 'new game') btn.remove();
                });
            } catch (_) { /* noop */ }
        };
        removeStray();
        const observer = new MutationObserver(() => removeStray());
        try { observer.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
        return () => { try { observer.disconnect(); } catch (_) {} };
    }, []);

    // Create a fresh id on app initialization
    useEffect(() => {
        const run = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${apiBaseUrl}/games/new`, { method: 'POST' });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || 'Failed to create initial game id');
                setCurrentGameId(data.id);
                setLoadedFen(initialFen);
                setLoadedPgn('');
                // persist initial state (starting FEN, empty PGN)
                try {
                    await fetch(`${apiBaseUrl}/games/${data.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fen: initialFen, pgn: '' })
                    });
                } catch (e) {
                    console.warn('Initial state persistence failed:', e);
                }
            } catch (e) {
                console.error('Initial game id creation failed:', e);
            } finally {
                setIsLoading(false);
            }
        };
        run();
    }, [apiBaseUrl]);

    const handleCreateNewGame = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBaseUrl}/games/new`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.detail || 'Failed to create new game id');
            setCurrentGameId(data.id);
            setLoadedFen(initialFen);
            setLoadedPgn('');
            try {
                await fetch(`${apiBaseUrl}/games/${data.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fen: initialFen, pgn: '' })
                });
            } catch (e) {
                console.warn('New game initial state persistence failed:', e);
            }
            setShowLoadList(false);
        } catch (e) {
            console.error('Create New Game failed:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadGameClick = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBaseUrl}/games`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.detail || 'Failed to fetch game ids');
            setAvailableIds(Array.isArray(data.ids) ? data.ids : []);
            setShowLoadList(true);
        } catch (e) {
            console.error('Load Game list fetch failed:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectExistingId = async (id) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBaseUrl}/games/${id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.detail || 'Failed to fetch game state');
            setCurrentGameId(id);
            setLoadedFen(data?.fen || initialFen);
            setLoadedPgn(data?.pgn || '');
        } catch (e) {
            console.error('Failed to load game state:', e);
            setCurrentGameId(id);
            setLoadedFen(initialFen);
            setLoadedPgn('');
        } finally {
            setShowLoadList(false);
            setIsLoading(false);
        }
    };

    return html`
        <div className="flex flex-col md:flex-row w-full h-screen">
            <div className="w-full md:w-2/3 lg:w-3/5 h-full flex flex-col items-center p-2 md:p-4 bg-gray-800 overflow-y-auto">
                <div className="w-full max-w-[630px] flex items-center justify-between gap-2 mb-2">
                    <div className="flex gap-2">
                        <button 
                            className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm font-semibold"
                            onClick=${handleLoadGameClick}
                            disabled=${isLoading}
                        >Load Game</button>
                        <button 
                            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
                            onClick=${handleCreateNewGame}
                            disabled=${isLoading}
                        >Create New Game</button>
                    </div>
                    <div className="text-xs text-gray-300 truncate">
                        ${currentGameId ? html`Current: ${currentGameId}` : (isLoading ? 'Working…' : 'Ready')}
                    </div>
                </div>

                ${showLoadList && html`
                    <div className="w-full max-w-[630px] mb-2 p-2 bg-gray-900 rounded border border-gray-700">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-semibold text-gray-200">Select a Game ID</div>
                            <button className="text-xs text-gray-300 hover:text-white" onClick=${() => setShowLoadList(false)}>Close</button>
                        </div>
                        <div className="max-h-40 overflow-y-auto divide-y divide-gray-800">
                            ${availableIds.length === 0 && html`<div className="text-xs text-gray-400 py-2">No saved games yet.</div>`}
                            ${availableIds.map(id => html`
                                <button 
                                    key=${id}
                                    className="w-full text-left px-2 py-2 text-xs hover:bg-gray-800 rounded"
                                    onClick=${() => handleSelectExistingId(id)}
                                >${id}</button>
                            `)}
                        </div>
                    </div>
                `}

                <div className="w-full max-w-[630px] aspect-square">
                    <${ChessboardComponent} 
                        key=${currentGameId || 'board'}
                        initialFen=${loadedFen || initialFen}
                        apiBaseUrl=${apiBaseUrl}
                        gameId=${currentGameId}
                        initialPgn=${loadedPgn}
                        className="w-full h-full"
                    />
                </div>
            </div>

            <div className="hidden md:block w-px bg-gray-700"></div>
        </div>
    `;
}

export default AppLayout;
