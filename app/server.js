// ─── Import packages ────────────────────────────────────────────
const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');

const app = express();

// ─── Middleware ──────────────────────────────────────────────────
app.use(cors());              // allow browser requests from any origin
app.use(express.json());      // parse JSON body from requests

// ─── Database Connection ─────────────────────────────────────────
// process.env means: "read this value from environment variable"
// the || 'fallback' means: "if env var not set, use this default"
// In docker-compose we SET these env vars — Node just reads them
const db = mysql.createConnection({
  host     : process.env.DB_HOST     || 'db',
  user     : process.env.DB_USER     || 'root',
  password : process.env.DB_PASSWORD || 'rootpass',
  database : process.env.DB_NAME     || 'tododb'
});

// ─── Connect to DB and create table if it doesn't exist ──────────
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);               // crash the app — docker will restart it
  }
  console.log('Connected to MySQL database!');

  // Create todos table if it doesn't exist yet
  db.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      title     VARCHAR(255) NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Table creation error:', err.message);
    else console.log('Todos table ready!');
  });
});

// ─── ROUTES ──────────────────────────────────────────────────────

// GET all todos
app.get('/api/todos', (req, res) => {
  db.query('SELECT * FROM todos ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST create a new todo
app.post('/api/todos', (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  db.query(
    'INSERT INTO todos (title) VALUES (?)',
    [title],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        id: result.insertId,
        title,
        completed: false
      });
    }
  );
});

// PUT toggle complete/incomplete
app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  db.query(
    'UPDATE todos SET completed = NOT completed WHERE id = ?',
    [id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Todo updated' });
    }
  );
});

// DELETE a todo
app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM todos WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Todo deleted' });
  });
});

// Health check — Docker uses this to know if app is alive
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ─── Start Server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App server running on port ${PORT}`);
});

