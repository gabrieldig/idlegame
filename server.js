const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_abyssal_key'; // In prod, use environment variable

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- API ROUTES ---

// Register
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Username already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            
            const userId = this.lastID;
            const now = new Date().toISOString();
            
            // Initialize game state for new user
            db.run('INSERT INTO game_state (user_id, last_login) VALUES (?, ?)', [userId, now], (err2) => {
                if (err2) return res.status(500).json({ error: 'Failed to initialize game state' });
                res.status(201).json({ message: 'User registered successfully' });
            });
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    });
});

// Get Game State & Calculate Offline Progress
app.get('/api/game/state', authenticateToken, (req, res) => {
    db.get('SELECT * FROM game_state WHERE user_id = ?', [req.user.id], (err, state) => {
        if (err || !state) return res.status(500).json({ error: 'Could not fetch game state' });

        // Calculate offline progress
        const now = new Date();
        const lastLogin = new Date(state.last_login);
        const diffSeconds = Math.max(0, (now.getTime() - lastLogin.getTime()) / 1000);
        
        // Income logic: Each Oxygen Generator gives 1 data per second
        // You could add thermal_heaters or hull_upgrades logic here as multipliers later.
        const offlineData = diffSeconds * state.oxygen_generators * 1; 
        
        const newDataPoints = state.data_points + offlineData;

        // Update last_login
        db.run('UPDATE game_state SET data_points = ?, last_login = ? WHERE user_id = ?', 
            [newDataPoints, now.toISOString(), req.user.id], (updateErr) => {
                if (updateErr) console.error("Failed to update last login");
            });

        state.data_points = newDataPoints;
        state.last_login = now.toISOString();
        state.offline_gained = offlineData;

        res.json(state);
    });
});

// Save Game State
app.post('/api/game/save', authenticateToken, (req, res) => {
    const { data_points, depth, oxygen_generators, hull_upgrades, thermal_heaters } = req.body;
    const now = new Date().toISOString();

    db.run(`UPDATE game_state SET 
        data_points = ?, depth = ?, oxygen_generators = ?, hull_upgrades = ?, thermal_heaters = ?, last_login = ? 
        WHERE user_id = ?`, 
        [data_points, depth, oxygen_generators, hull_upgrades, thermal_heaters, now, req.user.id], 
        (err) => {
            if (err) return res.status(500).json({ error: 'Failed to save game state' });
            res.json({ message: 'Saved successfully' });
        }
    );
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
