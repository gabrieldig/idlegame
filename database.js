const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`);

        // Game State Table
        db.run(`CREATE TABLE IF NOT EXISTS game_state (
            user_id INTEGER PRIMARY KEY,
            data_points REAL DEFAULT 0,
            depth INTEGER DEFAULT 0,
            oxygen_generators INTEGER DEFAULT 0,
            hull_upgrades INTEGER DEFAULT 0,
            thermal_heaters INTEGER DEFAULT 0,
            last_login TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);
    });
}

module.exports = db;
