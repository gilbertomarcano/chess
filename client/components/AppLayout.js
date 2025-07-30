// AppLayout.js
import { html } from 'https://esm.sh/htm/preact';
import { DEFAULT_INITIAL_FEN, DEFAULT_API_BASE_URL } from '../config.js';
import ChessboardComponent from './ChessboardComponent.js';

function AppLayout(props) {
    const {
        initialFen = DEFAULT_INITIAL_FEN,
        apiBaseUrl = DEFAULT_API_BASE_URL,
    } = props;

    return html`
        <div className="flex flex-col md:flex-row w-full h-screen">
            <div className="w-full md:w-2/3 lg:w-3/5 h-full flex flex-col items-center justify-center p-2 md:p-4 bg-gray-800 overflow-y-auto">
                <div className="w-full max-w-[630px] aspect-square">
                    <${ChessboardComponent} 
                        initialFen=${initialFen}
                        apiBaseUrl=${apiBaseUrl}
                        className="w-full h-full"
                    />
                </div>
            </div>

            <div className="hidden md:block w-px bg-gray-700"></div>
        </div>
    `;
}

export default AppLayout;
