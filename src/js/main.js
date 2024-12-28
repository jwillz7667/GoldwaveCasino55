import '../css/reset.css';
import '../css/styles.css';
import { login, register, logout, getCurrentUser, checkAuthStatus } from './utils/auth.js';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const gamesList = document.getElementById('gamesList');
const errorMessage = document.getElementById('errorMessage');

// Event Listeners
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// Authentication Handlers
async function handleLogin(event) {
    event.preventDefault();
    const username = event.target.username.value;
    const password = event.target.password.value;

    try {
        await login(username, password);
        window.location.href = '/casino';
    } catch (error) {
        showError(error.message);
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const username = event.target.username.value;
    const password = event.target.password.value;
    const email = event.target.email?.value;

    try {
        await register(username, password, email);
        showSuccess('Registration successful! Please log in.');
        event.target.reset();
    } catch (error) {
        showError(error.message);
    }
}

async function handleLogout() {
    try {
        await logout();
        window.location.href = '/';
    } catch (error) {
        showError(error.message);
    }
}

// UI Functions
function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
}

function showSuccess(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.color = 'green';
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
            errorMessage.style.color = 'red';
        }, 5000);
    }
}

// Casino Functions
async function loadGames() {
    if (!gamesList) return;

    try {
        const response = await fetch('/api/games');
        if (!response.ok) {
            throw new Error('Failed to load games');
        }

        const games = await response.json();
        displayGames(games);
    } catch (error) {
        showError(error.message);
    }
}

function displayGames(games) {
    if (!gamesList) return;

    gamesList.innerHTML = games.map(game => `
        <div class="game-card" data-game-id="${game.id}">
            <img src="${game.thumbnail}" alt="${game.name}" class="game-thumbnail">
            <h3>${game.name}</h3>
            <p>Type: ${game.type}</p>
            <p>Bet Range: ${game.min_bet} - ${game.max_bet}</p>
            <button onclick="playGame(${game.id})">Play Now</button>
        </div>
    `).join('');
}

function updateUserInfo() {
    if (!userInfo) return;

    const user = getCurrentUser();
    if (user) {
        userInfo.innerHTML = `
            <span>Welcome, ${user.username}</span>
            <span>Balance: ${user.balance}</span>
        `;
    }
}

// Initialize
async function initialize() {
    const isAuth = await checkAuthStatus();
    if (window.location.pathname === '/casino' && !isAuth) {
        window.location.href = '/';
        return;
    }

    if (isAuth) {
        updateUserInfo();
        if (window.location.pathname === '/casino') {
            loadGames();
        }
    }
}

// Start the application
initialize();
