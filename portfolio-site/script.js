// Toggle Chatbox Visibility
document.getElementById("chatToggle").addEventListener("click", function () {
    const chatBox = document.getElementById("chatBox");
    chatBox.classList.toggle("hidden");
});

// Send Message to API
function sendMessage() {
    const input = document.getElementById("chatInput").value;
    const responseElement = document.getElementById("chatResponse");
    if (!input.trim()) {
        responseElement.textContent = "Please enter a message!";
        return;
    }
    responseElement.textContent = "Thinking...";

    fetch("https://api.aufaim.com/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": "{{API_KEY}}"
        },
        body: JSON.stringify({ query: input, n_results: 5 })
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            responseElement.textContent = data.response || "No response";
        })
        .catch(error => {
            responseElement.textContent = `Error: ${error.message}`;
        });

    // Clear input
    document.getElementById("chatInput").value = "";
}