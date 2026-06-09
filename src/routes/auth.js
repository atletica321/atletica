const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { authMiddleware, adminOnly, JWT_SECRET } = require('../middleware/auth');

// Login
router.post('/login', (req, res) => {
  const { email, senha } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND ativo = 1').get(email);
  if (!user || !bcrypt.compareSync(senha, user.senha)) {
    return res.status(401).json({ error: 'Email ou senha inválidos' });
  }
  const token = jwt.sign({ id: user.id, nome: user.nome, email: user.email, cargo: user.cargo }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, cargo: user.cargo } });
});

// Get me
router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, nome, email, cargo, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// List users (admin only)
router.get('/users', authMiddleware, adminOnly, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, nome, email, cargo, ativo, created_at FROM users ORDER BY nome').all();
  res.json(users);
});

// Create user
router.post('/users', authMiddleware, adminOnly, (req, res) => {
  const { nome, email, senha, cargo } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ error: 'Campos obrigatórios' });
  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(400).json({ error: 'Email já cadastrado' });
  const hash = bcrypt.hashSync(senha, 10);
  const result = db.prepare('INSERT INTO users (nome, email, senha, cargo) VALUES (?, ?, ?, ?)').run(nome, email, hash, cargo || 'diretor');
  res.json({ id: result.lastInsertRowid, nome, email, cargo: cargo || 'diretor' });
});

// Update user
router.put('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const { nome, email, cargo, senha, ativo } = req.body;
  const db = getDb();
  if (senha) {
    const hash = bcrypt.hashSync(senha, 10);
    db.prepare('UPDATE users SET nome=?, email=?, cargo=?, senha=?, ativo=?, updated_at=datetime("now","localtime") WHERE id=?').run(nome, email, cargo, hash, ativo ?? 1, req.params.id);
  } else {
    db.prepare('UPDATE users SET nome=?, email=?, cargo=?, ativo=?, updated_at=datetime("now","localtime") WHERE id=?').run(nome, email, cargo, ativo ?? 1, req.params.id);
  }
  res.json({ success: true });
});

// Delete user
router.delete('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const db = getDb();
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Não é possível remover seu próprio usuário' });
  db.prepare('UPDATE users SET ativo=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// Change own password
router.put('/change-password', authMiddleware, (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(senha_atual, user.senha)) return res.status(400).json({ error: 'Senha atual incorreta' });
  const hash = bcrypt.hashSync(nova_senha, 10);
  db.prepare('UPDATE users SET senha=? WHERE id=?').run(hash, req.user.id);
  res.json({ success: true });
});

module.exports = router;
