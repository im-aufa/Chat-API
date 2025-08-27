let auth0Client = null;
let isAuthenticatedGlobal = false;

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

    // Handle login state
    let isAuthenticated = await auth0Client.isAuthenticated();
    isAuthenticatedGlobal = isAuthenticated;
    updateUI(isAuthenticatedGlobal);

    if (location.search.includes("state=") && (location.search.includes("code=") || location.search.includes("error="))) {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, "/");
      isAuthenticated = await auth0Client.isAuthenticated();
      isAuthenticatedGlobal = isAuthenticated;
      updateUI(isAuthenticatedGlobal);
    }

    // Auth buttons
    document.getElementById("loginButton")?.addEventListener("click", () => {
      auth0Client.loginWithRedirect({
        screen_hint: 'signup'
      });
    });

    document.getElementById("logoutButton")?.addEventListener("click", () => {
      auth0Client.logout();
    });

    // Fetch and display projects
    fetch("projects.json")
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then(projects => {
        const projectList = document.getElementById("projectList");
        if (!projectList) return;
        projectList.innerHTML = '';

        projects.forEach(project => {
          const card = document.createElement("article");
          card.className = "card";

          let linkText = "View Project";
          if (project.link) {
            if (project.link.includes('github.com')) linkText = "View on GitHub";
            else if (project.link.includes('behance.net')) linkText = "View on Behance";
            else if (project.link.includes('figma.com')) linkText = "View on Figma";
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
      })
      .catch(error => {
        console.error("Error loading projects:", error);
        const projectList = document.getElementById("projectList");
        if (projectList) {
          projectList.innerHTML = '<p style="color: red;">Error loading projects. Check console for details.</p>';
        }
      });

    // Chat toggle
    const chatToggleButton = document.getElementById("chatToggle");
    const chatBox = document.getElementById("chatBox");
    const chatInput = document.getElementById("chatInput");
    const closeChatButton = document.getElementById("closeChat");

    if (chatToggleButton && chatBox && chatInput) {
      chatToggleButton.addEventListener("click", () => {
        chatBox.classList.toggle("hidden");
        if (!chatBox.classList.contains("hidden")) {
          chatInput.focus();
          if (!hasShownWelcomeMessage) {
            const intro = isAuthenticatedGlobal
              ? "Hi! I'm Cerince, your AI assistant. How can I help you today?"
              : "Hi! Login to start chatting with the AI. Click Send or the Login button.";
            addMessage(intro, false);
            hasShownWelcomeMessage = true;
          }
        }
      });
    }

    closeChatButton?.addEventListener("click", () => {
      chatBox?.classList.add("hidden");
    });

    const chatForm = document.querySelector("#chatBox form");
    chatForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage();
    });

  } catch (error) {
    console.error("Failed to initialize Auth0:", error);
    const loginButton = document.getElementById("loginButton");
    if (loginButton) {
      loginButton.textContent = "Login Unavailable";
      loginButton.disabled = true;
    }
  }
});

// === UI Helper Functions ===

function updateUI(isAuthenticated) {
  document.getElementById("loginButton").style.display = isAuthenticated ? "none" : "block";
  document.getElementById("logoutButton").style.display = isAuthenticated ? "block" : "none";
  // Always show chat toggle; gate interaction below
  const toggle = document.getElementById("chatToggle");
  if (toggle) toggle.style.display = "flex";

  const input = document.getElementById("chatInput");
  const formButton = document.querySelector('#chatBox button[type="submit"]');
  if (input) {
    input.disabled = !isAuthenticated;
    input.placeholder = isAuthenticated ? "Ask me anything..." : "Login required to chat";
  }
  if (formButton) {
    formButton.disabled = !isAuthenticated;
    formButton.title = isAuthenticated ? "Send" : "Login to enable chat";
  }
}

function addMessage(content, isUser) {
  const messagesContainer = document.getElementById("chatMessages");
  if (!messagesContainer) return;

  const messageWrapper = document.createElement("div");
  messageWrapper.className = `message-wrapper ${isUser ? "user" : "bot"}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerHTML = isUser
    ? `<svg xmlns="http://www.w3.org/2000/svg" ... />`
    : `<svg xmlns="http://www.w3.org/2000/svg" ... />`;

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

let typingIndicatorElement = null;
let isProcessingMessage = false;
let hasShownWelcomeMessage = false;

function showTypingIndicator() {
  const messagesContainer = document.getElementById("chatMessages");
  if (!messagesContainer || typingIndicatorElement) return;

  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper bot";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="7" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>`;

  const indicator = document.createElement("div");
  indicator.className = "message typing-indicator";
  indicator.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;

  wrapper.appendChild(avatar);
  wrapper.appendChild(indicator);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  typingIndicatorElement = wrapper;
}

function hideTypingIndicator() {
  if (typingIndicatorElement && typingIndicatorElement.parentNode) {
    typingIndicatorElement.parentNode.removeChild(typingIndicatorElement);
  }
  typingIndicatorElement = null;
}

async function sendMessage() {
  if (isProcessingMessage) return;

  const input = document.getElementById("chatInput");
  const spinner = document.getElementById("chatSpinner");
  const query = input.value.trim();
  if (!query) return;

  // Require login before sending
  if (!isAuthenticatedGlobal) {
    addMessage("Please login to chat. Redirecting to login...", false);
    try {
      await auth0Client.loginWithRedirect();
    } catch (e) {
      console.error("Login redirect failed:", e);
    }
    return;
  }

  isProcessingMessage = true;
  input.value = "";
  input.disabled = true;

  addMessage(query, true);
  spinner.style.display = "inline-block";
  showTypingIndicator();

  try {
    // Try to obtain token, but proceed without it if unavailable
    let accessToken = null;
    try {
      accessToken = await auth0Client.getTokenSilently();
    } catch (_err) {
      // Not logged in or silent auth failed; continue without token
    }

    const headers = {
      "Content-Type": "application/json"
    };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const response = await fetch("https://api.aufaim.com/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, n_results: 5 })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();
    addMessage(data.response || "No response received.", false);

  } catch (error) {
    const friendly = (
      error && typeof error.message === "string"
        ? error.message
        : "Unexpected error"
    );
    addMessage(`Error: ${friendly}. Please try again later.`, false);
    console.error("Fetch Error:", error);
  } finally {
    spinner.style.display = "none";
    hideTypingIndicator();
    input.disabled = false;
    input.focus();
    isProcessingMessage = false;
  }
}
