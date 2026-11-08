const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'sua-chave-secreta-super-segura';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- BANCO DE DADOS SQLite ---
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error('Erro ao abrir SQLite:', err.message);
    else console.log('📦 Conectado ao banco de dados SQLite.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        reading_goal INTEGER DEFAULT 12,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT CHECK(status IN ('Quero Ler', 'Lendo', 'Lido')) DEFAULT 'Quero Ler',
        rating INTEGER CHECK(rating BETWEEN 1 AND 5),
        review TEXT,
        cover_image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
});

// --- MIDDLEWARE ---
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' });
        req.user = user;
        next();
    });
}

// --- AUTENTICAÇÃO E PERFIL ---
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, [email, hashedPassword], function (err) {
            if (err) return res.status(400).json({ error: 'E-mail já cadastrado.' });
            res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'E-mail ou senha inválidos.' });

        const senhaValida = await bcrypt.compare(password, user.password);
        if (!senhaValida) return res.status(400).json({ error: 'E-mail ou senha inválidos.' });

        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, email: user.email, reading_goal: user.reading_goal });
    });
});

app.post('/api/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run(`UPDATE users SET password = ? WHERE email = ?`, [hashedPassword, email], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'E-mail não encontrado.' });
            res.json({ message: 'Senha redefinida com sucesso! Faça login.' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao redefinir a senha.' });
    }
});

app.get('/api/profile', verificarToken, (req, res) => {
    db.get(`SELECT id, email, reading_goal FROM users WHERE id = ?`, [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.put('/api/profile', verificarToken, (req, res) => {
    const { reading_goal } = req.body;
    db.run(`UPDATE users SET reading_goal = ? WHERE id = ?`, [reading_goal || 12, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Perfil atualizado com sucesso!' });
    });
});

// --- ROTAS DE LIVROS ---
app.get('/api/books', verificarToken, (req, res) => {
    db.all(`SELECT * FROM books WHERE user_id = ? ORDER BY id DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/books', verificarToken, (req, res) => {
    const { title, author, category, status, rating, review, cover_image } = req.body;
    const query = `INSERT INTO books (user_id, title, author, category, status, rating, review, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [req.user.id, title, author, category, status, rating, review, cover_image], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Livro cadastrado!' });
    });
});

app.put('/api/books/:id', verificarToken, (req, res) => {
    const { title, author, category, status, rating, review, cover_image } = req.body;
    const query = `UPDATE books SET title = ?, author = ?, category = ?, status = ?, rating = ?, review = ?, cover_image = ? WHERE id = ? AND user_id = ?`;
    db.run(query, [title, author, category, status, rating, review, cover_image, req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Livro não encontrado.' });
        res.json({ message: 'Livro atualizado!' });
    });
});

app.delete('/api/books/:id', verificarToken, (req, res) => {
    db.run(`DELETE FROM books WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Livro removido!' });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});