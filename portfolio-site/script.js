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
    fetch("/projects.json")
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
    const div = document.createElement("div");
    div.className = `message ${isUser ? "user" : "bot"}`;
    div.textContent = content;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

let typingIndicatorElement = null;

function showTypingIndicator() {
  const messagesContainer = document.getElementById("chatMessages");
  if (messagesContainer) {
    if (!typingIndicatorElement) {
      typingIndicatorElement = document.createElement("div");
      typingIndicatorElement.className = "typing-indicator message bot";
      typingIndicatorElement.textContent = "Cerince is typing...";
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
  const input = document.getElementById("chatInput");
  const spinner = document.getElementById("chatSpinner");
  const query = input.value.trim();

  if (!query) {
    addMessage("Please enter a message!", false);
    return;
  }

  addMessage(query, true);
  input.value = "";
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
  }
}
