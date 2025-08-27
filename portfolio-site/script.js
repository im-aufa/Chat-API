let auth0Client = null;

const fetchAuthConfig = () => ({
  domain: "dev-lhezyy52eycgfhum.us.auth0.com",
  clientId: "QwgGBUbGfPadlw1Zn8eR4yqr8GJIAcJu",
  authorizationParams: {
    audience: "https://api.aufaim.com/",
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Wait for Auth0 library to be loaded
    await window.auth0Ready;

    const config = fetchAuthConfig();

    auth0Client = await auth0.createAuth0Client({
      domain: config.domain,
      clientId: config.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: config.authorizationParams.audience,
      },
    });

    const isAuthenticated = await auth0Client.isAuthenticated();
    updateUI(isAuthenticated);

    if (location.search.includes("state=") && (location.search.includes("code=") || location.search.includes("error="))) {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, "/");
      const isAuthenticated = await auth0Client.isAuthenticated();
      updateUI(isAuthenticated);
    }

    document.getElementById("loginButton").addEventListener("click", () => {
      // You can change this to go directly to signup if needed
      auth0Client.loginWithRedirect({
        screen_hint: 'signup' // This will show signup page first
      });
    });

    document.getElementById("logoutButton").addEventListener("click", () => {
      auth0Client.logout();
    });

    // Fetch and display projects
    fetch("projects.json")
      .then(response => {
        if (!response.ok) {
          console.error("Error fetching projects:", response.status, response.statusText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(projects => {
        const projectList = document.getElementById("projectList");
        if (projectList) {
          projectList.innerHTML = ''; // Clear existing content
          projects.forEach(project => {
            const card = document.createElement("article");
            card.className = "card";

            let linkText = "View Project";
            if (project.link) {
                if (project.link.includes('github.com')) {
                    linkText = "View on GitHub";
                } else if (project.link.includes('behance.net')) {
                    linkText = "View on Behance";
                } else if (project.link.includes('figma.com')) {
                    linkText = "View on Figma";
                }
            }

            card.innerHTML = `
              <div class="card-body">
                <h3>${project.title}</h3>
                <p>${project.description}</p>
                <div class="tech-tags">
                  ${project.tech.map(t => `<span class="tag">${t}</span>`).join('')}
                </div>
              </div>
              ${project.link ? `
              <footer class="card-footer">
                <a href="${project.link}" target="_blank" role="button" class="contrast">${linkText}</a>
              </footer>
              ` : ''}
            `;
            projectList.appendChild(card);
          });
        }
      })
      .catch(error => {
        console.error("Error loading projects:", error);
        const projectList = document.getElementById("projectList");
        if (projectList) {
          projectList.innerHTML = '<p style="color: red;">Error loading projects. Check the browser console (F12) for more details.</p>';
        }
      });

    // Chat toggle functionality
    const chatToggleButton = document.getElementById("chatToggle");
    const chatBox = document.getElementById("chatBox");
    const chatInput = document.getElementById("chatInput");
    const closeChatButton = document.getElementById("closeChat");

    if (chatToggleButton && chatBox && chatInput) {
      chatToggleButton.addEventListener("click", () => {
        chatBox.classList.toggle("hidden");
        if (!chatBox.classList.contains("hidden")) {
          chatInput.focus();
          // Show welcome message only once when chat is opened
          if (!hasShownWelcomeMessage) {
            addMessage("Hi! I'm Cerince, your AI assistant. How can I help you today?", false);
            hasShownWelcomeMessage = true;
          }
        }
      });
    }

    if (closeChatButton) {
        closeChatButton.addEventListener("click", () => {
            const chatBox = document.getElementById("chatBox");
            if (chatBox) {
                chatBox.classList.add("hidden");
            }
        });
    }

    const chatForm = document.querySelector("#chatBox form");
    if (chatForm) {
      chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        sendMessage();
      });
    }
  } catch (error) {
    console.error("Failed to initialize Auth0:", error);
    // Show a user-friendly error message
    const loginButton = document.getElementById("loginButton");
    if (loginButton) {
      loginButton.textContent = "Login Unavailable";
      loginButton.disabled = true;
    }
  }
});

function updateUI(isAuthenticated) {
  document.getElementById("loginButton").style.display = isAuthenticated ? "none" : "block";
  document.getElementById("logoutButton").style.display = isAuthenticated ? "block" : "none";
  document.getElementById("chatToggle").style.display = isAuthenticated ? "flex" : "none";
}

function addMessage(content, isUser) {
  const messagesContainer = document.getElementById("chatMessages");
  if (messagesContainer) {
    const messageWrapper = document.createElement("div");
    messageWrapper.className = `message-wrapper ${isUser ? "user" : "bot"}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    // Simple SVG placeholders for avatars
    avatar.innerHTML = isUser 
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM8 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm4 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm4 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`;

    const messageContent = document.createElement("div");
    messageContent.className = "message";
    messageContent.textContent = content;

    const timestamp = document.createElement("div");
    timestamp.className = "timestamp";
    timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageContent.appendChild(timestamp);
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(messageContent);
    messagesContainer.appendChild(messageWrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

let typingIndicatorElement = null;
let isProcessingMessage = false; // Flag to prevent double-sending
let hasShownWelcomeMessage = false; // Flag to track if welcome message was shown

function showTypingIndicator() {
  const messagesContainer = document.getElementById("chatMessages");
  if (messagesContainer) {
    if (!typingIndicatorElement) {
      typingIndicatorElement = document.createElement("div");
      typingIndicatorElement.className = "typing-indicator message bot";
      typingIndicatorElement.textContent = "Cerina is typing...";
      typingIndicatorElement.id = "typingIndicator";
    }
    typingIndicatorElement.style.display = "block";
    messagesContainer.appendChild(typingIndicatorElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

function hideTypingIndicator() {
  if (typingIndicatorElement) {
    typingIndicatorElement.style.display = "none";
  }
}

async function sendMessage() {
  // Prevent double-sending
  if (isProcessingMessage) {
    return;
  }

  const input = document.getElementById("chatInput");
  const spinner = document.getElementById("chatSpinner");
  const query = input.value.trim();

  if (!query) {
    return; // Exit early if no message, but don't show error message
  }

  // Set processing flag and disable input
  isProcessingMessage = true;
  input.value = "";
  input.disabled = true;

  addMessage(query, true);
  spinner.style.display = "inline-block";
  showTypingIndicator();

  try {
    const accessToken = await auth0Client.getTokenSilently();
    const response = await fetch("https://api.aufaim.com/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({ query, n_results: 5 })
    });

    if (!response.ok) {
      let errorText = `HTTP error! Status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.detail) {
          errorText = `Error: ${errorData.detail}`;
        }
      } catch (jsonError) {
        console.error("Error parsing API error response:", jsonError);
      }
      throw new Error(errorText);
    }

    const data = await response.json();
    addMessage(data.response || "No response received.", false);

  } catch (error) {
    addMessage(`Error: ${error.message}. Please try again.`, false);
    console.error("Fetch Error:", error);
  } finally {
    spinner.style.display = "none";
    hideTypingIndicator();
    input.disabled = false; // Re-enable input after request completes
    input.focus(); // Focus back to input for better UX
    isProcessingMessage = false; // Reset processing flag
  }
}
