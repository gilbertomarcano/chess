// ChatMessageComponent.js
// Import necessary functions from Preact and HTM
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef, useCallback } from 'https://esm.sh/preact/hooks';

// The Preact Chat Message Component
function ChatMessageComponent(props) {
    // Expect apiChatUrl from props, with a default
    const { apiChatUrl = "http://127.0.0.1:8011/api/v1/llm/chat" } = props;

    // --- State Variables ---
    const [messages, setMessages] = useState([
        { text: "Hello! How can I assist you with chess today?", sender: 'llm' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [modelName, setModelName] = useState('Model: Not Connected');
    const [isSending, setIsSending] = useState(false);

    // --- Refs ---
    const chatMessagesContainerRef = useRef(null); // To scroll to bottom
    const messageInputRef = useRef(null); // To focus input

    // --- Scroll to bottom when messages change ---
    useEffect(() => {
        if (chatMessagesContainerRef.current) {
            chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // --- Initial focus on input ---
    useEffect(() => {
        if (messageInputRef.current) {
            messageInputRef.current.focus();
        }
        // Optional: Fetch initial model name or status here if your API supports it
        // For example:
        // async function fetchInitialStatus() {
        // try {
        // const statusResponse = await fetch(apiChatUrl + "/status"); // Fictional status endpoint
        // if (statusResponse.ok) {
        // const statusData = await statusResponse.json();
        // if (statusData.model_name) setModelName(\`Model: \${statusData.model_name}\`);
        // }
        // } catch (e) { console.warn("Could not fetch initial model status", e); }
        // }
        // fetchInitialStatus();
    }, []);


    // --- Add a message to the chat display ---
    const addMessageToChatState = useCallback((text, sender) => {
        setMessages(prevMessages => [...prevMessages, { text, sender }]);
    }, [setMessages]);

    // --- Send message to backend and get LLM reply ---
    const sendMessageToLLM = useCallback(async (userMessageText) => {
        if (!userMessageText.trim()) return;

        addMessageToChatState(userMessageText, 'user');
        setInputValue(''); // Clear input field
        setIsSending(true);

        try {
            const response = await fetch(apiChatUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ message: userMessageText })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "Unknown server error." }));
                throw new Error(`Server error: ${response.status} - ${errorData.detail || response.statusText}`);
            }

            const responseData = await response.json();
            addMessageToChatState(responseData.reply, 'llm');
            if (responseData.model_name) {
                setModelName(`Model: ${responseData.model_name}`);
            }

        } catch (error) {
            console.error("Error sending message to LLM:", error);
            addMessageToChatState(`Error: ${error.message}`, 'llm'); // Show error in chat
            setModelName("Model: Error Connecting");
        } finally {
            setIsSending(false);
            if (messageInputRef.current) {
                messageInputRef.current.focus();
            }
        }
    }, [apiChatUrl, addMessageToChatState, setInputValue, setIsSending, setModelName, messageInputRef]);

    // --- Event Handlers ---
    const handleInputChange = (event) => {
        setInputValue(event.target.value);
    };

    const handleSendClick = () => {
        sendMessageToLLM(inputValue);
    };

    const handleKeyPress = (event) => {
        if (event.key === 'Enter' && !isSending) {
            sendMessageToLLM(inputValue);
        }
    };

    // --- Render function ---
    return html`
        <div class="flex flex-col h-full w-full bg-gray-800 shadow-2xl">
            <div class="bg-gray-700 p-4">
                <h1 class="text-xl font-semibold text-center">Chat with Chess LLM</h1>
                <p class="text-xs text-gray-400 text-center" id="model-name-display">${modelName}</p>
            </div>

            <div 
                id="chat-messages-preact" 
                class="flex-grow p-4 space-y-4 overflow-y-auto" 
                ref=${chatMessagesContainerRef}
            >
                ${messages.map((msg, index) => html`
                    <div 
                        key=${index} 
                        class="message-bubble ${msg.sender === 'user' ? 'user-message' : 'llm-message'}"
                    >
                        ${msg.text}
                    </div>
                `)}
            </div>

            <div class="bg-gray-700 p-4 border-t border-gray-600">
                <div class="flex space-x-3">
                    <input 
                        type="text" 
                        ref=${messageInputRef}
                        id="message-input-preact" 
                        placeholder="Type your message..."
                        class="flex-grow bg-gray-600 text-gray-100 border border-gray-500 p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        autocomplete="off"
                        value=${inputValue}
                        onInput=${handleInputChange}
                        onKeyPress=${handleKeyPress}
                        disabled=${isSending}
                    />
                    <button 
                        id="send-button-preact"
                        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick=${handleSendClick}
                        disabled=${isSending || !inputValue.trim()}
                    >
                        ${isSending ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Export the component
export default ChatMessageComponent;
