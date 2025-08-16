// ===== Minimal Chatbox Script (clean) =====
// Purpose: extremely simple helper chat with budget + usage hints.

const CHAT_STATE = { budget:null, usage:null };

const USAGE_MAP = {
    gaming: [/\bgaming\b|game|chơi/i],
    office: [/văn phòng|office|học tập|study|word|excel/i],
    design: [/đồ họa|do hoa|design|render|edit|premiere|photoshop/i],
    ai: [/\bai\b|machine learning|deep|ml\b|hoc may/i]
};

function initChatbox(){
    const openBtn=document.getElementById('openChatbox');
    const closeBtn=document.getElementById('closeChatbox');
    const input=document.getElementById('chatInput');
    const form=document.getElementById('chatForm');
    const backdrop=document.getElementById('chat-backdrop');
    openBtn?.addEventListener('click', ()=> toggleChat());
    closeBtn?.addEventListener('click', ()=> toggleChat(false));
    backdrop?.addEventListener('click', ()=> toggleChat(false));
    form?.addEventListener('submit', e=>{ e.preventDefault(); sendMessage(); });
    input?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); sendMessage(); }});
    // ESC to close
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') toggleChat(false); });
    // On resize adjust backdrop usage (mobile vs desktop)
    window.addEventListener('resize', updateBackdropState);
    addBotMessage('Xin chào! Nhập: "20 triệu gaming" hoặc gõ "reset" để bắt đầu lại.');
}

function toggleChat(force){
    const box=document.getElementById('chatDrawer');
    const backdrop=document.getElementById('chat-backdrop');
    if(!box) return;
    const willOpen = force===undefined ? !box.classList.contains('open') : !!force;
    box.classList.toggle('open', willOpen);
    // Only use backdrop (block page) on mobile; desktop user can interact with builder simultaneously
    if(backdrop){
        const isMobile = window.matchMedia('(max-width: 560px)').matches;
        backdrop.classList.toggle('active', willOpen && isMobile);
    }
    document.body.classList.toggle('chat-open', willOpen);
    if(willOpen) document.getElementById('chatInput')?.focus();
}

function updateBackdropState(){
    const box=document.getElementById('chatDrawer');
    const backdrop=document.getElementById('chat-backdrop');
    if(!box || !backdrop) return;
    if(!box.classList.contains('open')) return; // nothing to do
    const isMobile = window.matchMedia('(max-width: 560px)').matches;
    backdrop.classList.toggle('active', isMobile);
}

function sendMessage(textOverride){
    const input=document.getElementById('chatInput');
    const raw=textOverride!==undefined?textOverride:(input?input.value:'');
    const msg=raw.trim();
    if(!msg) return;
    addUserMessage(msg);
    if(input) input.value='';
    basicReply(msg);
}

function basicReply(text){
    const lower=text.toLowerCase();
    if(lower==='reset' || /\breset\b/.test(lower)){ CHAT_STATE.budget=null; CHAT_STATE.usage=null; addBotMessage('Đã reset. Nhập ngân sách + mục đích: ví dụ "25 triệu gaming".'); return; }
    // detect budget
    const m=lower.match(/(\d+)(?=\s*(tr|triệu|m|trieu)?)/i);
    if(m){ CHAT_STATE.budget = parseInt(m[1],10); }
    // detect usage
    for(const [k,arr] of Object.entries(USAGE_MAP)){
        if(arr.some(r=> r.test(lower))){ CHAT_STATE.usage=k; break; }
    }
    if(!CHAT_STATE.budget && !CHAT_STATE.usage){
        addBotMessage('Nhập dạng: "20 triệu gaming" hoặc "25tr văn phòng".');
        return;
    }
    if(CHAT_STATE.budget && !CHAT_STATE.usage){
        addBotMessage('Đã ghi nhận ~'+CHAT_STATE.budget+' triệu. Thêm mục đích: gaming / văn phòng / đồ họa / AI.');
        return;
    }
    if(!CHAT_STATE.budget && CHAT_STATE.usage){
        addBotMessage('Mục đích '+labelUsage(CHAT_STATE.usage)+' đã rõ. Thêm ngân sách (vd: 30 triệu).');
        return;
    }
    // Have both
    const suggestion = buildQuickSuggestion(CHAT_STATE.budget, CHAT_STATE.usage);
    addBotMessage(suggestion);
    addBotMessage('Gõ "reset" để làm mới hoặc nhập ngân sách khác.');
}

function labelUsage(u){
    switch(u){
        case 'gaming': return 'gaming';
        case 'office': return 'văn phòng';
        case 'design': return 'đồ họa';
        case 'ai': return 'AI';
        default: return u;
    }
}

function buildQuickSuggestion(budget, usage){
    // Very rough tiering just for text guidance.
    const b = budget;
    const priceTag = b + ' triệu';
    const lines=[];
    lines.push('Tóm tắt gợi ý cho '+priceTag+' ('+labelUsage(usage)+'):' );
    if(usage==='gaming'){
        if(b<15) lines.push('- Ưu tiên GPU tầm GTX 1650 / RX 6400, RAM 16GB');
        else if(b<25) lines.push('- CPU 6 nhân + GPU tầm RTX 4060 / RX 7600');
        else if(b<35) lines.push('- CPU 6-8 nhân + GPU RTX 4060 Ti / 4070');
        else lines.push('- CPU 8 nhân + GPU mạnh (RTX 4070+), SSD NVMe 1TB');
    } else if(usage==='office'){
        lines.push('- CPU tiết kiệm điện 6 nhân, iGPU đủ dùng');
        lines.push('- RAM 16GB, SSD NVMe 500GB hoặc 1TB');
    } else if(usage==='design'){
        lines.push('- CPU 8 nhân, RAM 32GB nếu render nặng');
        lines.push('- GPU VRAM >= 8GB, SSD NVMe 1TB');
    } else if(usage==='ai'){
        lines.push('- Ưu tiên GPU VRAM lớn (>=12GB nếu có thể)');
        lines.push('- RAM 32GB, SSD NVMe 1TB');
    }
    lines.push('- PSU chất lượng, case thoáng khí.');
    return lines.join('\n');
}

function addMessage(text,type){
    const wrap=document.getElementById('chatMessages');
    if(!wrap) return;
    const div=document.createElement('div');
    div.className='message '+type;
    div.textContent=text;
    wrap.appendChild(div);
    wrap.scrollTop=wrap.scrollHeight;
}
function addUserMessage(t){ addMessage(t,'user'); }
function addBotMessage(t){ addMessage(t,'bot'); }

function quickReply(t){ sendMessage(t); }

document.addEventListener('DOMContentLoaded', initChatbox);

// Export minimal API (if inline handlers used)
window.quickReply = quickReply;
window.sendMessage = sendMessage;