const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'sua-chave-secreta-super-segura'; // Em produção, usariamos variáveis de ambiente

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONEXÃO E CRIAÇÃO DO BANCO DE DADOS SQLite ---
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados SQLite:', err.message);
    } else {
        console.log('📦 Conectado ao banco de dados SQLite.');
    }
});

// Criar tabelas de Usuários e Livros se não existirem
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        category TEXT,
        status TEXT,
        rating INTEGER,
        review TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// --- MIDDLEWARE DE AUTENTICAÇÃO (VERIFICA O TOKEN) ---
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (!token) return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' }); req.user = user; // Guarda os dados do usuário decodificados (id, email)
        next();
    });
}

// --- ROTAS DE AUTENTICAÇÃO ---

// 1. Cadastro de Usuário
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, [email, hashedPassword], function (err) {
            if (err) {
                return res.status(400).json({ error: 'E-mail já cadastrado.' });
            }
            res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// 2. Login de Usuário
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'E-mail ou senha inválidos.' });
        }

        const senhaValida = await bcrypt.compare(password, user.password);
        if (!senhaValida) {
            return res.status(400).json({ error: 'E-mail ou senha inválidos.' });
        }

        // Gerar Token JWT válido por 24 horas
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, email: user.email });
    });
});

// --- ROTAS DE LIVROS (PROTEGIDAS POR USUÁRIO) ---

// Listar apenas os livros do usuário logado
app.get('/api/books', verificarToken, (req, res) => {
    db.all(`SELECT * FROM books WHERE user_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Adicionar livro vinculado ao usuário logado
app.post('/api/books', verificarToken, (req, res) => {
    const { title, author, category, status, rating, review } = req.body;
    const query = `INSERT INTO books (user_id, title, author, category, status, rating, review) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(query, [req.user.id, title, author, category || 'Geral', status || 'Quero Ler', rating || 5, review || ''], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
            id: this.lastID,
            user_id: req.user.id,
            title, author, category, status, rating, review
        });
    });
});

// Atualizar livro (garantindo que pertence ao usuário)
app.put('/api/books/:id', verificarToken, (req, res) => {
    const bookId = req.params.id;
    const { title, author, category, status, rating, review } = req.body;

    const query = `UPDATE books SET title = ?, author = ?, category = ?, status = ?, rating = ?, review = ? WHERE id = ? AND user_id = ?`;

    db.run(query, [title, author, category, status, rating, review, bookId, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Livro não encontrado ou sem permissão.' });
        res.json({ message: 'Livro atualizado com sucesso!' });
    });
});

// Excluir livro (garantindo que pertence ao usuário)
app.delete('/api/books/:id', verificarToken, (req, res) => {
    const bookId = req.params.id;

    db.run(`DELETE FROM books WHERE id = ? AND user_id = ?`, [bookId, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Livro não encontrado ou sem permissão.' });
        res.json({ message: 'Livro removido com sucesso!' });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor backend rodando em http://localhost:${PORT}`);
});