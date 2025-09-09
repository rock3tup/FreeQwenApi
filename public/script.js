document.addEventListener('DOMContentLoaded', () => {
    const modelSelect = document.getElementById('model-select');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatList = document.getElementById('chat-list');
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeBtn = document.querySelector('.close-btn');
    const accountList = document.getElementById('account-list');
    const addAccountBtn = document.getElementById('add-account-btn');


    let currentChatId = null;

    const api = {
        async request(method, endpoint, body = null) {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(`/api/${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            return response.json();
        },
        async get(endpoint) {
            return this.request('GET', endpoint);
        },
        async post(endpoint, body) {
            return this.request('POST', endpoint, body);
        },
        async put(endpoint, body) {
            return this.request('PUT', endpoint, body);
        },
        async delete(endpoint) {
            return this.request('DELETE', endpoint);
        }
    };

    async function fetchModels() {
        try {
            const data = await api.get('models');
            modelSelect.innerHTML = '';
            data.data.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                modelSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to fetch models:', error);
        }
    }

    async function fetchChats() {
        try {
            const data = await api.get('chats');
            chatList.innerHTML = '';
            data.chats.forEach(chat => {
                const li = document.createElement('li');
                li.dataset.chatId = chat.id;

                const chatName = document.createElement('span');
                chatName.textContent = chat.name || chat.id;
                chatName.addEventListener('click', () => switchChat(chat.id));
                li.appendChild(chatName);

                const actions = document.createElement('div');
                actions.className = 'chat-actions';

                const renameBtn = document.createElement('button');
                renameBtn.textContent = '✏️';
                renameBtn.title = 'Переименовать';
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    renameChat(chat.id, chat.name);
                });
                actions.appendChild(renameBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '🗑️';
                deleteBtn.title = 'Удалить';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                });
                actions.appendChild(deleteBtn);

                li.appendChild(actions);
                chatList.appendChild(li);
            });
            if (data.chats.length > 0 && !currentChatId) {
                switchChat(data.chats[0].id);
            }
            highlightActiveChat();
        } catch (error) {
            console.error('Failed to fetch chats:', error);
        }
    }

    async function fetchChatHistory(chatId) {
        try {
            const data = await api.get(`chats/${chatId}`);
            messagesContainer.innerHTML = '';
            if (data.history && data.history.messages) {
                data.history.messages.forEach(msg => addMessage(msg.role, msg.content));
            }
        } catch (error) {
            console.error('Failed to fetch chat history:', error);
        }
    }

    async function createNewChat() {
        try {
            const data = await api.post('chats', { name: 'Новый чат' });
            await fetchChats();
            switchChat(data.chatId);
        } catch (error) {
            console.error('Failed to create new chat:', error);
        }
    }

    async function renameChat(chatId, oldName) {
        const newName = prompt('Введите новое имя чата:', oldName || '');
        if (newName && newName.trim() !== '') {
            try {
                await api.put(`chats/${chatId}/rename`, { name: newName.trim() });
                await fetchChats();
            } catch (error) {
                console.error('Failed to rename chat:', error);
                alert(`Ошибка: ${error.message}`);
            }
        }
    }

    async function deleteChat(chatId) {
        if (confirm('Вы уверены, что хотите удалить этот чат?')) {
            try {
                await api.delete(`chats/${chatId}`);
                if (currentChatId === chatId) {
                    currentChatId = null;
                    messagesContainer.innerHTML = '';
                }
                await fetchChats();
            } catch (error) {
                console.error('Failed to delete chat:', error);
                alert(`Ошибка: ${error.message}`);
            }
        }
    }

    async function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        addMessage('user', messageText);
        messageInput.value = '';

        try {
            const response = await api.post('chat', {
                message: messageText,
                model: modelSelect.value,
                chatId: currentChatId,
            });

            if (response.choices && response.choices[0] && response.choices[0].message) {
                addMessage('assistant', response.choices[0].message.content);
            }
            if (!currentChatId) {
                currentChatId = response.chatId;
                await fetchChats();
                highlightActiveChat();
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            addMessage('assistant', 'Ошибка: не удалось отправить сообщение.');
        }
    }

    function addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        messageDiv.textContent = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function switchChat(chatId) {
        currentChatId = chatId;
        fetchChatHistory(chatId);
        highlightActiveChat();
    }

    function highlightActiveChat() {
        document.querySelectorAll('#chat-list li').forEach(li => {
            if (li.dataset.chatId === currentChatId) {
                li.classList.add('active');
            } else {
                li.classList.remove('active');
            }
        });
    }

    newChatBtn.addEventListener('click', createNewChat);
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // --- Account Management ---

    async function fetchAccounts() {
        try {
            const data = await api.get('accounts');
            accountList.innerHTML = ''; // Clear existing list
            if (data.accounts) {
                data.accounts.forEach(acc => {
                    const item = document.createElement('div');
                    item.className = 'account-item';
                    item.innerHTML = `
                        <span>${acc.id}</span>
                        <span class="account-status ${acc.status}">${acc.status}</span>
                        <div>
                            <button class="relogin-btn" data-id="${acc.id}" title="Перелогин">🔄</button>
                            <button class="delete-acc-btn" data-id="${acc.id}" title="Удалить">🗑️</button>
                        </div>
                    `;
                    accountList.appendChild(item);
                });
            }
        } catch (error) {
            console.error('Failed to fetch accounts:', error);
            accountList.innerHTML = '<p>Не удалось загрузить аккаунты.</p>';
        }
    }

    async function addAccount() {
        addAccountBtn.textContent = 'Откройте браузер и войдите...';
        addAccountBtn.disabled = true;
        try {
            await api.post('accounts/add');
            await fetchAccounts();
        } catch (error) {
            alert(`Ошибка при добавлении аккаунта: ${error.message}`);
        } finally {
            addAccountBtn.textContent = 'Добавить новый аккаунт';
            addAccountBtn.disabled = false;
        }
    }

    async function reloginAccount(accountId) {
        alert('Сейчас откроется браузер для повторного входа. После входа вернитесь в это окно.');
        try {
            await api.post(`accounts/relogin/${accountId}`);
            await fetchAccounts();
        } catch (error) {
            alert(`Ошибка при повторном входе: ${error.message}`);
        }
    }

    async function deleteAccount(accountId) {
        if (confirm('Вы уверены, что хотите удалить этот аккаунт?')) {
            try {
                await api.delete(`accounts/${accountId}`);
                await fetchAccounts();
            } catch (error) {
                alert(`Ошибка при удалении аккаунта: ${error.message}`);
            }
        }
    }


    // --- Modal Logic ---
    function openSettingsModal() {
        fetchAccounts();
        settingsModal.style.display = 'block';
    }

    function closeSettingsModal() {
        settingsModal.style.display = 'none';
    }

    // --- Event Listeners ---
    settingsBtn.addEventListener('click', openSettingsModal);
    closeBtn.addEventListener('click', closeSettingsModal);
    window.addEventListener('click', (event) => {
        if (event.target == settingsModal) {
            closeSettingsModal();
        }
    });
    addAccountBtn.addEventListener('click', addAccount);
    accountList.addEventListener('click', (e) => {
        if (e.target.classList.contains('relogin-btn')) {
            reloginAccount(e.target.dataset.id);
        } else if (e.target.classList.contains('delete-acc-btn')) {
            deleteAccount(e.target.dataset.id);
        }
    });


    function init() {
        fetchModels();
        fetchChats();
    }

    init();
});
