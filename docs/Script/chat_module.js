function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (message) {
        addMessage('Bạn: ' + message, 'user');
        input.value = '';
        setTimeout(() => addMessage('GearVN: Cảm ơn bạn đã nhắn! Chúng tôi sẽ hỗ trợ ngay.', 'bot'), 500);
    }
}

function addMessage(text, type) {
    const messages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + type + '-message';
    messageDiv.textContent = text;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

document.querySelector('.close-btn').addEventListener('click', () => {
    document.querySelector('.chat-container').style.display = 'none';
});