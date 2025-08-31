// main.js - Main application entry point
// Import Preact's render function and htm for templating
import { html, render } from 'https://esm.sh/htm/preact';
import { DEFAULT_INITIAL_FEN, DEFAULT_API_BASE_URL } from './config.js?v=ui-fix-1';

// Import the main AppLayout component
import AppLayout from './components/AppLayout.js?v=ui-fix-1';

// Get the DOM element where the Preact app will be mounted
const appRootElement = document.getElementById('appRoot');

if (appRootElement) {
    appRootElement.innerHTML = ''; // Clear any "Loading..." message
    // Render the AppLayout component
    render(html`
        <${AppLayout} 
            initialFen=${DEFAULT_INITIAL_FEN} 
            apiBaseUrl=${DEFAULT_API_BASE_URL}
        />
    `, appRootElement);
} else {
    console.error("Fatal Error: Root element with id 'appRoot' not found in the DOM. Application cannot start.");
}
