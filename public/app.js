const API_URL = '/api';

// State
let token = localStorage.getItem('token') || null;
let username = localStorage.getItem('username') || null;
let gameState = {
    data_points: 0,
    depth: 0,
    oxygen_generators: 0,
    hull_upgrades: 0,
    thermal_heaters: 0
};

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');
const authForm = document.getElementById('auth-form');
const authMessage = document.getElementById('auth-message');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');

// Game UI Elements
const displayUsername = document.getElementById('display-username');
const displayData = document.getElementById('data-points-display');
const displayDepth = document.getElementById('depth-display');
const displayDataPerSec = document.getElementById('data-per-sec');

const manualScanBtn = document.getElementById('manual-scan-btn');
const pulseBtn = document.querySelector('.pulse-btn');

const btnOxygen = document.getElementById('buy-oxygen-btn');
const btnHull = document.getElementById('buy-hull-btn');
const btnThermal = document.getElementById('buy-thermal-btn');

const countOxygen = document.getElementById('oxygen-gen-count');
const countHull = document.getElementById('hull-count');
const countThermal = document.getElementById('thermal-count');

const costOxygenEl = document.getElementById('oxygen-cost');
const costHullEl = document.getElementById('hull-cost');
const costThermalEl = document.getElementById('thermal-cost');


// --- Init ---
function init() {
    if (token) {
        showGame();
        fetchGameState();
    } else {
        showAuth();
    }
}

// --- Auth UI Flow ---
function showAuth() {
    authScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
}

function showGame() {
    authScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    displayUsername.textContent = username;
}

// --- Auth API ---
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    handleAuth('/login');
});

registerBtn.addEventListener('click', () => {
    handleAuth('/register');
});

async function handleAuth(endpoint) {
    const user = document.getElementById('username-input').value;
    const pass = document.getElementById('password-input').value;
    
    try {
        const res = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            authMessage.textContent = data.error;
            return;
        }

        if (endpoint === '/login') {
            token = data.token;
            username = user;
            localStorage.setItem('token', token);
            localStorage.setItem('username', username);
            init();
        } else {
            authMessage.textContent = "Registration successful. Please connect.";
            authMessage.style.color = "var(--accent-cyan)";
        }
    } catch (err) {
        authMessage.textContent = "Server connection failed.";
    }
}

logoutBtn.addEventListener('click', () => {
    saveGameState(); // Save before logout
    token = null;
    username = null;
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    init();
});

// --- Game Logic ---
async function fetchGameState() {
    try {
        const res = await fetch(API_URL + '/game/state', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401 || res.status === 403) {
            logoutBtn.click();
            return;
        }

        const data = await res.json();
        gameState = {
            data_points: data.data_points || 0,
            depth: data.depth || 0,
            oxygen_generators: data.oxygen_generators || 0,
            hull_upgrades: data.hull_upgrades || 0,
            thermal_heaters: data.thermal_heaters || 0
        };

        if (data.offline_gained > 0) {
            alert(`Observation drones collected ${Math.floor(data.offline_gained)} data points while you were disconnected.`);
        }

        updateUI();
        startGameLoop();
    } catch (err) {
        console.error("Failed to fetch game state");
    }
}

async function saveGameState() {
    if (!token) return;
    try {
        await fetch(API_URL + '/game/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(gameState)
        });
    } catch (err) {
        console.error("Save failed");
    }
}

// Auto-save every 30 seconds
setInterval(saveGameState, 30000);

// Interaction
manualScanBtn.addEventListener('click', (e) => {
    gameState.data_points += 1;
    updateUI();
    showFloatingText(e, "+1 Data");
});

function showFloatingText(e, text) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    
    // Position near click
    const rect = pulseBtn.getBoundingClientRect();
    const x = e.clientX || rect.left + rect.width / 2;
    const y = e.clientY || rect.top + rect.height / 2;
    
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    
    document.body.appendChild(el);
    setTimeout(() => { document.body.removeChild(el); }, 1000);
}

// Base Costs (can be moved to a config object)
function getCost(baseCost, count) {
    return Math.floor(baseCost * Math.pow(1.15, count));
}

function updateUI() {
    displayData.textContent = Math.floor(gameState.data_points);
    displayDepth.textContent = gameState.depth;
    
    // Data per sec
    const dataPerSec = gameState.oxygen_generators * 1;
    displayDataPerSec.textContent = dataPerSec.toFixed(1);

    // Counts
    countOxygen.textContent = gameState.oxygen_generators;
    countHull.textContent = gameState.hull_upgrades;
    countThermal.textContent = gameState.thermal_heaters;

    // Update Costs
    const oxCost = getCost(10, gameState.oxygen_generators);
    const hullCost = getCost(50, gameState.hull_upgrades);
    const thermCost = getCost(100, gameState.thermal_heaters);

    costOxygenEl.textContent = oxCost;
    costHullEl.textContent = hullCost;
    costThermalEl.textContent = thermCost;

    // Affordability Styling
    btnOxygen.style.opacity = gameState.data_points >= oxCost ? '1' : '0.5';
    btnHull.style.opacity = gameState.data_points >= hullCost ? '1' : '0.5';
    btnThermal.style.opacity = gameState.data_points >= thermCost ? '1' : '0.5';
}

// Purchasing
btnOxygen.addEventListener('click', () => buyItem('oxygen_generators', 10));
btnHull.addEventListener('click', () => {
    if (buyItem('hull_upgrades', 50)) {
        gameState.depth += 50; // Descend deeper
        updateUI();
    }
});
btnThermal.addEventListener('click', () => buyItem('thermal_heaters', 100));

function buyItem(itemKey, baseCost) {
    const cost = getCost(baseCost, gameState[itemKey]);
    if (gameState.data_points >= cost) {
        gameState.data_points -= cost;
        gameState[itemKey] += 1;
        updateUI();
        saveGameState(); // Force save on purchase
        return true;
    }
    return false;
}

// Game Loop (60 FPS)
let lastTime = null;
let animationId = null;

function gameLoop(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Calculate Data gain
    if (gameState.oxygen_generators > 0) {
        const dataGain = gameState.oxygen_generators * 1 * deltaTime;
        gameState.data_points += dataGain;
        updateUI();
    }

    animationId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
    if (animationId) cancelAnimationFrame(animationId);
    lastTime = null;
    animationId = requestAnimationFrame(gameLoop);
}

// Boot
init();
