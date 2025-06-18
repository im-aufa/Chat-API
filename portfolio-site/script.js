document.addEventListener("DOMContentLoaded", () => {
    // Load projects
    fetch("/projects.json")
        .then(response => response.json())
        .then(projects => {
            const projectList = document.getElementById("projectList");
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
        })
        .catch(error => console.error("Error loading projects:", error));

    // Chat toggle
    document.getElementById("chatToggle").addEventListener("click", () => {
        const chatBox = document.getElementById("chatBox");
        chatBox.classList.toggle("hidden");
        if (!chatBox.classList.contains("hidden")) {
            document.getElementById("chatInput").focus();
        }
    });
});

function addMessage(content, isUser) {
    const messages = document.getElementById("chatMessages");
    const div = document.createElement("div");
    div.className = `message ${isUser ? "user" : "bot"}`;
    div.textContent = content;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function sendMessage() {
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

    fetch("https://api.aufaim.com/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": "{{API_KEY}}"
        },
        body: JSON.stringify({ query, n_results: 5 })
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            addMessage(data.response || "No response", false);
            spinner.style.display = "none";
        })
        .catch(error => {
            addMessage(`Error: ${error.message}`, false);
            spinner.style.display = "none";
        });
}