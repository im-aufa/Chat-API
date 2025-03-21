// Toggle Chatbox Visibility
document.getElementById("chatToggle").addEventListener("click", function () {
    const chatBox = document.getElementById("chatBox");
    chatBox.classList.toggle("hidden");
});

// Send Message to API
function sendMessage() {
    const input = document.getElementById("chatInput").value;
    const responseElement = document.getElementById("chatResponse");
    responseElement.textContent = "Thinking...";

    fetch("https://api.aufaim.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input })
    })
        .then(response => response.json())
        .then(data => {
            responseElement.textContent = data.response || "No response";
        })
        .catch(error => {
            responseElement.textContent = "Error: " + error.message;
        });

    // Clear input after sending
    document.getElementById("chatInput").value = "";
}