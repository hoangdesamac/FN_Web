// Hiển thị module sau 10 phút (600 giây)
setTimeout(() => {
    const chatModule = document.getElementById('chatModule');
    chatModule.style.display = 'block';
}, 600000);

// Đóng module chat
function closeChatModule() {
    const chatModule = document.getElementById('chatModule');
    chatModule.style.display = 'none';
    // Lưu trạng thái đóng để không hiển thị lại trong phiên
    sessionStorage.setItem('chatModuleClosed', 'true');
}

// Kiểm tra trạng thái đóng khi tải trang
window.onload = () => {
    if (sessionStorage.getItem('chatModuleClosed') === 'true') {
        const chatModule = document.getElementById('chatModule');
        chatModule.style.display = 'none';
    }
};

// Mở cửa sổ chat
function openChat() {
    const chatModule = document.getElementById('chatModule');
    const chatWindow = document.getElementById('chatWindow');
    chatModule.style.display = 'none';
    chatWindow.style.display = 'flex';
}

// Đóng cửa sổ chat
function closeChatWindow() {
    const chatWindow = document.getElementById('chatWindow');
    chatWindow.style.display = 'none';
}

// Gửi tin nhắn
function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const chatBody = document.getElementById('chatBody');

    if (chatInput.value.trim() !== '') {
        const userMessage = document.createElement('div');
        userMessage.classList.add('message', 'user-message');
        userMessage.innerHTML = `<p>${chatInput.value}</p>`;
        chatBody.appendChild(userMessage);

        // Cuộn xuống tin nhắn mới nhất
        chatBody.scrollTop = chatBody.scrollHeight;

        // Xóa nội dung ô nhập liệu
        chatInput.value = '';
    }
}