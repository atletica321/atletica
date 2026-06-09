const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, all, run, query } = require('../database');
const { authMiddleware, adminOnly, JWT_SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const user = await get('SELECT * FROM users WHERE email = $1 AND ativo = 1', [email]);
    if (!user || !bcrypt.compareSync(senha, user.senha))
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    const token = jwt.sign({ id: user.id, nome: user.nome, email: user.email, cargo: user.cargo }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, cargo: user.cargo } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await get('SELECT id, nome, email, cargo, created_at FROM users WHERE id = $1', [req.user.id]);
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    res.json(await all('SELECT id, nome, email, cargo, ativo, created_at FROM users ORDER BY nome'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nome, email, senha, cargo } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ error: 'Campos obrigatórios' });
    const exists = await get('SELECT id FROM users WHERE email = $1', [email]);
    if (exists) return res.status(400).json({ error: 'Email já cadastrado' });
    const hash = bcrypt.hashSync(senha, 10);
    const result = await run('INSERT INTO users (nome, email, senha, cargo) VALUES ($1,$2,$3,$4) RETURNING id', [nome, email, hash, cargo || 'diretor']);
    res.json({ id: result.rows[0].id, nome, email, cargo: cargo || 'diretor' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nome, email, cargo, senha, ativo } = req.body;
    if (senha) {
      const hash = bcrypt.hashSync(senha, 10);
      await query('UPDATE users SET nome=$1, email=$2, cargo=$3, senha=$4, ativo=$5, updated_at=NOW() WHERE id=$6',
        [nome, email, cargo, hash, ativo ?? 1, req.params.id]);
    } else {
      await query('UPDATE users SET nome=$1, email=$2, cargo=$3, ativo=$4, updated_at=NOW() WHERE id=$5',
        [nome, email, cargo, ativo ?? 1, req.params.id]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id)
      return res.status(400).json({ error: 'Não é possível remover seu próprio usuário' });
    await query('UPDATE users SET ativo=0 WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    const user = await get('SELECT * FROM users WHERE id=$1', [req.user.id]);
    if (!bcrypt.compareSync(senha_atual, user.senha))
      return res.status(400).json({ error: 'Senha atual incorreta' });
    const hash = bcrypt.hashSync(nova_senha, 10);
    await query('UPDATE users SET senha=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
