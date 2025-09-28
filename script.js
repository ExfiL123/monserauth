let currentUser = null;
let currentPage = 1;
let isLoading = false;
let onlineCount = 0;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем авторизацию
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        window.location.href = 'login.html';
        return;
    }

    // Инициализируем интерфейс
    initializeInterface();
    
    // Загружаем начальные данные
    await loadInitialData();
});

// Функция инициализации интерфейса
function initializeInterface() {
    // Навигация
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetPage = this.getAttribute('data-page');
            switchPage(targetPage, navItems, pages);
        });
    });

    // Кнопки поиска
    const searchButtons = document.querySelectorAll('.gaming-btn');
    searchButtons.forEach(btn => {
        if (btn.querySelector('.fa-search')) {
            btn.addEventListener('click', function() {
                const page = this.closest('.page');
                const pageId = page.id.replace('-page', '');
                handleSearch(pageId);
            });
        }
    });

    // Обработчики Enter в полях поиска
    const searchInputs = document.querySelectorAll('.gaming-input');
    searchInputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const page = this.closest('.page');
                const pageId = page.id.replace('-page', '');
                handleSearch(pageId);
            }
        });
    });

    // Кнопка выхода
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Переключение сервера
    const serverSelect = document.getElementById('server-select');
    if (serverSelect) {
        serverSelect.addEventListener('change', handleServerSwitch);
    }
}

// Переключение страниц
function switchPage(targetPage, navItems, pages) {
    // Убираем активный класс
    navItems.forEach(nav => nav.classList.remove('active'));
    pages.forEach(page => page.classList.remove('active'));

    // Добавляем активный класс
    const activeNav = document.querySelector(`[data-page="${targetPage}"]`);
    const activePage = document.getElementById(targetPage + '-page');
    
    if (activeNav) activeNav.classList.add('active');
    if (activePage) {
        activePage.classList.add('active');
        loadPageData(targetPage);
    }
}

// Обработка поиска
function handleSearch(pageType) {
    currentPage = 1;
    loadPageData(pageType);
}

// API вызовы
async function apiCall(endpoint, options = {}) {
    try {
        showLoadingState(true);
        
        const response = await fetch(`api.php?action=${endpoint}`, {
            method: options.method || 'GET',
            body: options.body || null,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        const data = await response.json();

        if (!data.success && response.status === 401) {
            window.location.href = 'login.html';
            return null;
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        showNotification('Ошибка соединения с сервером', 'error');
        return null;
    } finally {
        showLoadingState(false);
    }
}

// Проверка авторизации
async function checkAuth() {
    const data = await apiCall('session');
    if (data && data.step === 'admin') {
        currentUser = data.admin;
        updateUserInterface();
        return true;
    }
    return false;
}

// Обновление пользовательского интерфейса
function updateUserInterface() {
    if (!currentUser) return;

    // Обновляем информацию о пользователе
    const username = document.querySelector('.username');
    const userRole = document.querySelector('.user-role');
    const userAvatar = document.querySelector('.user-avatar');
    const statusText = document.querySelector('.status-text');
    const serverSelect = document.getElementById('server-select');

    if (username) username.textContent = currentUser.name;
    if (userRole) userRole.textContent = `Level ${currentUser.level}`;
    if (userAvatar) userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
    if (statusText) {
        statusText.textContent = `Server: ${currentUser.server}`;
        statusText.parentElement.classList.add('online');
    }
    if (serverSelect) {
        serverSelect.value = currentUser.server;
        serverSelect.closest('.server-switcher').style.display = 'block';
    }
}

// Загрузка начальных данных
async function loadInitialData() {
    await loadPageData('admins');
    await updateOnlineStats();
}

// Загрузка данных для страниц
async function loadPageData(pageType) {
    switch (pageType) {
        case 'admins':
            await loadAdmins();
            break;
        case 'logs':
            await loadLogs(currentPage);
            break;
        case 'reputation':
            await loadReputation(currentPage);
            break;
        case 'names':
            await loadNames(currentPage);
            break;
    }
}

// Загрузка администраторов
async function loadAdmins() {
    if (isLoading) return;
    isLoading = true;

    const adminGrid = document.querySelector('.admin-grid');
    if (!adminGrid) return;

    adminGrid.innerHTML = '<div class="loading">Загружаем администраторов...</div>';

    const searchInput = document.querySelector('#adminSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';

    let endpoint = `get-admins&server=${currentUser.server}`;
    if (searchQuery) {
        endpoint += `&search=${encodeURIComponent(searchQuery)}`;
    }

    const data = await apiCall(endpoint);

    if (data && data.success) {
        renderAdmins(data.admins);
        showNotification(`Загружено ${data.count || data.admins.length} администраторов`, 'success');
    } else {
        adminGrid.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
        showNotification(data?.error || 'Ошибка загрузки администраторов', 'error');
    }

    isLoading = false;
}

// Отрисовка администраторов
function renderAdmins(admins) {
    const adminGrid = document.querySelector('.admin-grid');
    if (!adminGrid) return;

    adminGrid.innerHTML = admins.map(admin => `
        <a href="admin-detail.html?name=${encodeURIComponent(admin.Name)}" class="admin-card-link" target="_blank">
            <div class="admin-card">
                <div class="admin-header">
                    <span class="admin-name">${admin.Name}</span>
                    <span class="admin-level">Level ${admin.ADM || admin.Adm || 1}</span>
                </div>
                
                <div class="admin-stats">
                    <div class="stat-row">
                        <div class="stat-item">
                            <div class="stat-label">Предупреждения</div>
                            <div class="stat-value">${admin.Preds || 0}/3</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Подтвержден</div>
                            <div class="stat-value ${admin.Podtverjden == 1 ? 'status-yes' : 'status-no'}">
                                ${admin.Podtverjden == 1 ? 'Да' : 'Нет'}
                            </div>
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-item">
                            <div class="stat-label">Support</div>
                            <div class="stat-value ${admin.Support == 1 ? 'status-yes' : 'status-no'}">
                                ${admin.Support == 1 ? 'Да' : 'Нет'}
                            </div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Онлайн</div>
                            <div class="stat-value status-offline">Оффлайн</div>
                        </div>
                    </div>
                </div>
                
                <div class="admin-info">
                    <div class="info-row">
                        <span class="info-label">Дата назначения:</span>
                        <span class="info-value">${formatDate(admin.Date)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Назначил:</span>
                        <span class="info-value">${admin.Kem || 'Неизвестно'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">IP адрес:</span>
                        <span class="info-value">${admin.IP || 'Скрыт'}</span>
                    </div>
                </div>
            </div>
        </a>
    `).join('');
}

// Загрузка логов
async function loadLogs(page = 1) {
    if (isLoading) return;
    isLoading = true;

    const tbody = document.querySelector('#logs-page .gaming-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="loading">Загружаем логи...</td></tr>';

    const filters = {
        admin: document.querySelector('#adminFilter')?.value || '',
        player: document.querySelector('#playerFilter')?.value || '',
        cmd: document.querySelector('#cmdFilter')?.value || '',
        reason: document.querySelector('#reasonFilter')?.value || ''
    };

    const queryParams = new URLSearchParams({
        server: currentUser.server,
        page: page,
        ...filters
    });

    const data = await apiCall(`get-logs&${queryParams}`);

    if (data && data.success) {
        renderLogs(data.logs);
        updatePagination('logs', page, data.hasMore);
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="error">Ошибка загрузки данных</td></tr>';
        showNotification(data?.error || 'Ошибка загрузки логов', 'error');
    }

    isLoading = false;
}

// Отрисовка логов
function renderLogs(logs) {
    const tbody = document.querySelector('#logs-page .gaming-table tbody');
    if (!tbody) return;

    tbody.innerHTML = logs.map(log => `
        <tr>
            <td><span class="admin-name">${log.Admin}</span></td>
            <td><span class="player-name">${log.Player}</span></td>
            <td><span class="command-badge">${log.CMD}</span></td>
            <td>${log.Reason}</td>
            <td>${log.Amount || '—'}</td>
            <td>${formatDate(log.Date)}</td>
        </tr>
    `).join('');
}

// Загрузка репутации
async function loadReputation(page = 1) {
    if (isLoading) return;
    isLoading = true;

    const tbody = document.querySelector('#reputation-page .gaming-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="loading">Загружаем данные репутации...</td></tr>';

    const filters = {
        from: document.querySelector('#fromFilter')?.value || '',
        to: document.querySelector('#toFilter')?.value || '',
        comment: document.querySelector('#commentFilter')?.value || ''
    };

    const queryParams = new URLSearchParams({
        page: page,
        ...filters
    });

    const data = await apiCall(`get-reputation&${queryParams}`);

    if (data && data.success) {
        renderReputation(data.logs);
        updatePagination('reputation', page, data.hasMore);
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="error">Ошибка загрузки данных</td></tr>';
        showNotification(data?.error || 'Ошибка загрузки репутации', 'error');
    }

    isLoading = false;
}

// Отрисовка репутации
function renderReputation(logs) {
    const tbody = document.querySelector('#reputation-page .gaming-table tbody');
    if (!tbody) return;

    tbody.innerHTML = logs.map(log => `
        <tr>
            <td><span class="player-name">${log.A}</span></td>
            <td><span class="player-name">${log.B}</span></td>
            <td>
                <span class="reputation-badge ${log.Repa > 0 ? 'positive' : 'negative'}">
                    ${log.Repa > 0 ? '+' : ''}${log.Repa}
                </span>
            </td>
            <td>${log.Comment}</td>
            <td><span class="${log.Blocked === 'Да' ? 'status-no' : 'status-yes'}">${log.Blocked}</span></td>
            <td>${formatDateCorrect(log.Date2)}</td>
        </tr>
    `).join('');
}

// Загрузка истории никнеймов
async function loadNames(page = 1) {
    if (isLoading) return;
    isLoading = true;

    const tbody = document.querySelector('#names-page .gaming-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="loading">Загружаем историю никнеймов...</td></tr>';

    const filters = {
        account: document.querySelector('#accountFilter')?.value || '',
        before: document.querySelector('#beforeFilter')?.value || '',
        after: document.querySelector('#afterFilter')?.value || '',
        admin: document.querySelector('#adminNamesFilter')?.value || ''
    };

    const queryParams = new URLSearchParams({
        page: page,
        ...filters
    });

    const data = await apiCall(`get-names&${queryParams}`);

    if (data && data.success) {
        renderNames(data.logs);
        updatePagination('names', page, data.hasMore);
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="error">Ошибка загрузки данных</td></tr>';
        showNotification(data?.error || 'Ошибка загрузки истории никнеймов', 'error');
    }

    isLoading = false;
}

// Отрисовка истории никнеймов
function renderNames(logs) {
    const tbody = document.querySelector('#names-page .gaming-table tbody');
    if (!tbody) return;

    tbody.innerHTML = logs.map(log => `
        <tr>
            <td><span class="account-id">${log.idacc}</span></td>
            <td><span class="old-nickname">${log.Do}</span></td>
            <td><span class="new-nickname">${log.Posle}</span></td>
            <td><span class="admin-name">${log.Adm}</span></td>
            <td>${formatDate(log.Date)}</td>
        </tr>
    `).join('');
}

// Обновление пагинации
function updatePagination(type, currentPage, hasMore) {
    const pagination = document.querySelector(`#${type}-page .pagination`);
    if (!pagination) return;

    pagination.innerHTML = `
        <button class="pagination-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="loadPage('${type}', ${currentPage - 1})">
            <i class="fas fa-chevron-left"></i> Предыдущая
        </button>
        <span class="pagination-info">Страница ${currentPage}</span>
        <button class="pagination-btn" ${!hasMore ? 'disabled' : ''} onclick="loadPage('${type}', ${currentPage + 1})">
            Следующая <i class="fas fa-chevron-right"></i>
        </button>
    `;
}

// Загрузка определенной страницы
function loadPage(type, page) {
    currentPage = page;
    loadPageData(type);
}

// Обновление статистики онлайн
async function updateOnlineStats() {
    const data = await apiCall(`get-online-stats&server=${currentUser?.server || 'One'}`);
    if (data && data.success) {
        onlineCount = data.online || 0;
        const onlineCountEl = document.getElementById('online-count');
        if (onlineCountEl) {
            onlineCountEl.textContent = onlineCount;
        }
    }
}

// Обработчики событий
async function handleLogout() {
    if (confirm('Вы действительно хотите выйти из системы?')) {
        const data = await apiCall('logout', { method: 'POST' });
        if (data && data.success) {
            window.location.href = 'login.html';
        }
    }
}

async function handleServerSwitch() {
    const serverSelect = document.getElementById('server-select');
    const newServer = serverSelect.value;
    
    const data = await apiCall(`switch-server&server=${newServer}`, { method: 'POST' });
    if (data && data.success) {
        currentUser.server = newServer;
        updateUserInterface();
        await loadPageData('admins');
        showNotification(`Переключено на сервер ${newServer}`, 'success');
    } else {
        showNotification('Ошибка переключения сервера', 'error');
        // Возвращаем предыдущий выбор
        serverSelect.value = currentUser.server;
    }
}

// Утилиты
function formatDate(dateString) {
    if (!dateString) return 'Не указано';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Не указано';
        
        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Не указано';
    }
}

function formatDateCorrect(dateString) {
    if (!dateString) return 'Не указано';

    try {
        // Если дата в формате timestamp
        if (typeof dateString === 'number' || /^\d+$/.test(dateString)) {
            const timestamp = Number.parseInt(dateString);
            if (timestamp < 946684800) { // 01.01.2000
                return 'Не указано';
            }
            const date = new Date(timestamp * 1000);
            return date.toLocaleString('ru-RU', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // Обычная дата
        const date = new Date(dateString);
        if (date.getFullYear() < 2000) {
            return 'Не указано';
        }

        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Не указано';
    }
}

// Система уведомлений
function showNotification(message, type = 'info') {
    // Удаляем предыдущие уведомления
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = getNotificationIcon(type);
    notification.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    // Обработчик закрытия
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });

    // Автоудаление через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success':
            return 'fas fa-check-circle';
        case 'error':
            return 'fas fa-exclamation-circle';
        case 'warning':
            return 'fas fa-exclamation-triangle';
        default:
            return 'fas fa-info-circle';
    }
}

// Показ состояния загрузки
function showLoadingState(loading) {
    // Можно добавить глобальный индикатор загрузки
    const body = document.body;
    if (loading) {
        body.style.cursor = 'wait';
    } else {
        body.style.cursor = '';
    }
}

// Автообновление онлайн статистики
setInterval(updateOnlineStats, 60000); // Каждую минуту
