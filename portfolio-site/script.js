document.addEventListener("DOMContentLoaded", () => {
    // Fetch and display projects
    fetch("/projects.json")
        .then(response => {
            if (!response.ok) {
                // If response is not OK, log the status and throw an error
                console.error("Error fetching projects:", response.status, response.statusText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(projects => {
            const projectList = document.getElementById("projectList");
            if (projectList) { // Check if projectList element exists
                projects.forEach(project => {
                    const card = document.createElement("article");
                    card.className = "card mb-4 project-card";
                    card.innerHTML = `
                        <header><h3>${project.title}</h3></header>
                        <p>${project.description}</p>
                        <footer>
                            <small>Tech: ${project.tech.join(", ")}</small>
                            ${project.link ? `<br><a href="${project.link}" target="_blank">View Project</a>` : ""}
                        </footer>
                    `;
                    projectList.appendChild(card);
                });
            } else {
                console.error("Element with ID 'projectList' not found.");
            }
        })
        .catch(error => console.error("Error loading projects:", error));

    // Chat toggle functionality
    const chatToggleButton = document.getElementById("chatToggle");
    const chatBox = document.getElementById("chatBox");
    const chatInput = document.getElementById("chatInput");

    if (chatToggleButton && chatBox && chatInput) {
        chatToggleButton.addEventListener("click", () => {
            chatBox.classList.toggle("hidden");
            if (!chatBox.classList.contains("hidden")) {
                chatInput.focus();
            }
        });
    } else {
        console.error("One or more chat elements (chatToggle, chatBox, chatInput) not found.");
    }
});

/**
 * Adds a message to the chat interface.
 * @param {string} content The text content of the message.
 * @param {boolean} isUser True if the message is from the user, false for bot.
 */
function addMessage(content, isUser) {
    const messagesContainer = document.getElementById("chatMessages");
    if (messagesContainer) {
        const div = document.createElement("div");
        div.className = `message ${isUser ? "user" : "bot"}`;
        div.textContent = content;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
    } else {
        console.error("Element with ID 'chatMessages' not found.");
    }
}

let typingIndicatorElement = null; // Store a reference to the typing indicator

/**
 * Shows a "Bot is typing..." indicator in the chat.
 */
function showTypingIndicator() {
    const messagesContainer = document.getElementById("chatMessages");
    if (messagesContainer) {
        if (!typingIndicatorElement) { // Create only if it doesn't exist
            typingIndicatorElement = document.createElement("div");
            typingIndicatorElement.className = "typing-indicator message bot"; // Use message bot styling
            typingIndicatorElement.textContent = "Bot is typing...";
            typingIndicatorElement.id = "typingIndicator"; // Give it an ID for easy lookup
        }
        typingIndicatorElement.style.display = "block"; // Make it visible
        messagesContainer.appendChild(typingIndicatorElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
    }
}

/**
 * Hides the "Bot is typing..." indicator.
 */
function hideTypingIndicator() {
    if (typingIndicatorElement) {
        typingIndicatorElement.style.display = "none";
        // Optionally remove it from the DOM if not reusing
        // if (typingIndicatorElement.parentNode) {
        //     typingIndicatorElement.parentNode.removeChild(typingIndicatorElement);
        //     typingIndicatorElement = null;
        // }
    }
}

/**
 * Sends a message to the chat API and handles the response.
 */
async function sendMessage() {
    const input = document.getElementById("chatInput");
    const spinner = document.getElementById("chatSpinner");
    const query = input.value.trim();

    if (!query) {
        addMessage("Please enter a message!", false);
        return;
    }

    addMessage(query, true); // Add user's message
    input.value = ""; // Clear input field
    spinner.style.display = "inline-block"; // Show spinner
    showTypingIndicator(); // Show typing indicator

    // Retrieve API key from environment variable (substituted at build time)
    const apiKey = "${API_KEY}";
    console.log("API Key (from script.js):", apiKey); // Debug: Check if key is correctly substituted

    try {
        const response = await fetch("https://api.aufaim.com/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey // Ensure this is the correct, substituted API key
            },
            body: JSON.stringify({ query, n_results: 5 })
        });

        console.log("Response Status:", response.status); // Debug

        if (!response.ok) {
            let errorText = `HTTP error! Status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.detail) {
                    errorText = `Error: ${errorData.detail}`; // Use detail from FastAPI error
                }
            } catch (jsonError) {
                console.error("Error parsing API error response:", jsonError);
            }
            throw new Error(errorText);
        }

        const data = await response.json();
        addMessage(data.response || "No response received.", false); // Add bot's response

    } catch (error) {
        addMessage(`Error: ${error.message}. Please try again.`, false);
        console.error("Fetch Error:", error); // Log full error for debugging
    } finally {
        spinner.style.display = "none"; // Hide spinner
        hideTypingIndicator(); // Hide typing indicator
    }
}