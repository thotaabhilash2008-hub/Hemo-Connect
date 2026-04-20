document.addEventListener('DOMContentLoaded', () => {
    // Inject HTML
    const chatbotHTML = `
    <div id="chatbot-container">
        <!-- Floating Button -->
        <button id="chatbot-toggle" class="chatbot-toggle">
            💬
        </button>

        <!-- Chat Window -->
        <div id="chatbot-window" class="chatbot-window hidden">
            <div class="chatbot-header">
                <h3>Hemo Connect Assistant</h3>
                <button id="chatbot-close" class="chatbot-close">&times;</button>
            </div>
            
            <div id="chatbot-messages" class="chatbot-messages">
                <div class="message bot-message">
                    Hello! I'm your Hemo Connect assistant. How can I help you today?
                    <span class="timestamp">${formatTime()}</span>
                </div>
            </div>

            <div class="chatbot-suggestions">
                <button class="suggestion-btn">Find Blood</button>
                <button class="suggestion-btn">Donate Info</button>
                <button class="suggestion-btn">Emergency Help</button>
            </div>
            
            <div class="chatbot-input-area">
                <input type="text" id="chatbot-input" placeholder="Type your message...">
                <button id="chatbot-send">➤</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    const toggleBtn = document.getElementById('chatbot-toggle');
    const closeBtn = document.getElementById('chatbot-close');
    const chatWindow = document.getElementById('chatbot-window');
    const sendBtn = document.getElementById('chatbot-send');
    const inputField = document.getElementById('chatbot-input');
    const messagesContainer = document.getElementById('chatbot-messages');
    const suggestionBtns = document.querySelectorAll('.suggestion-btn');

    // Toggle Chat Window
    toggleBtn.addEventListener('click', () => {
        chatWindow.classList.toggle('hidden');
        if (!chatWindow.classList.contains('hidden')) {
            inputField.focus();
        }
    });

    closeBtn.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
    });

    function formatTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;
        msgDiv.innerHTML = `${text} <span class="timestamp">${formatTime()}</span>`;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `AI is typing...`;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function removeTypingIndicator() {
        const typingDiv = document.getElementById('typing-indicator');
        if (typingDiv) {
            typingDiv.remove();
        }
    }

    function processMessage(text) {
        text = text.toLowerCase();
        let response = "I'm not sure about that. Try asking about blood availability, donation, or emergency help.";

        if (text.includes("available") || text.includes("availability") || text.includes("o+") || text.includes("a+") || text.includes("b+") || text.includes("ab+")) {
            response = "Checking nearby donors and blood banks for availability...";
        } else if (text.includes("urgent") || text.includes("emergency") || text.includes("need blood") || text.includes("help") || text.includes("critical")) {
            response = "<strong>Urgent:</strong> Please go to the Request Blood section and mark it as critical. We will alert nearby donors immediately.";
        } else if (text.includes("donate") || text.includes("eligibility") || text.includes("can i")) {
            response = "You can donate if you are healthy, above 18, and haven't donated in the last 3 months.";
        } else if (text.includes("find donor") || text.includes("near me") || text.includes("nearest") || text.includes("find blood")) {
            response = "Searching for available donors near your location...";
        } else if (text.includes("compatible") || text.includes("universal") || text.includes("groups")) {
            response = "O- is universal donor, AB+ is universal receiver.";
        } else if (text.includes("hi") || text.includes("hello") || text.includes("hey")) {
            response = "Hello! I'm your Hemo Connect assistant. How can I help you today?";
        }

        setTimeout(() => {
            removeTypingIndicator();
            addMessage(response, 'bot');
        }, 1000);
    }

    function handleSend() {
        const text = inputField.value.trim();
        if (text) {
            addMessage(text, 'user');
            inputField.value = '';
            showTypingIndicator();
            processMessage(text);
        }
    }

    sendBtn.addEventListener('click', handleSend);
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    suggestionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.innerText;
            inputField.value = text;
            handleSend();
        });
    });
});
