const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.use(authMiddleware);

// List
router.get('/', (req, res) => {
  const db = getDb();
  const { status, busca } = req.query;
  let query = 'SELECT * FROM socios WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (busca) { query += ' AND (nome LIKE ? OR email LIKE ? OR matricula LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`); }
  query += ' ORDER BY nome';
  res.json(db.prepare(query).all(...params));
});

// Stats
router.get('/stats', (req, res) => {
  const db = getDb();
  const total = db.prepare("SELECT COUNT(*) as c FROM socios").get().c;
  const ativos = db.prepare("SELECT COUNT(*) as c FROM socios WHERE status='ativo'").get().c;
  const inativos = db.prepare("SELECT COUNT(*) as c FROM socios WHERE status='inativo'").get().c;
  const receitaMes = db.prepare(`SELECT COALESCE(SUM(valor),0) as total FROM pagamentos_socios WHERE status='pago' AND strftime('%Y-%m', data_pagamento) = strftime('%Y-%m', 'now','localtime')`).get().total;
  const receitaAno = db.prepare(`SELECT COALESCE(SUM(valor),0) as total FROM pagamentos_socios WHERE status='pago' AND strftime('%Y', data_pagamento) = strftime('%Y', 'now','localtime')`).get().total;
  const porPlano = db.prepare("SELECT plano, COUNT(*) as count FROM socios WHERE status='ativo' GROUP BY plano").all();
  res.json({ total, ativos, inativos, receitaMes, receitaAno, porPlano });
});

// Get one
router.get('/:id', (req, res) => {
  const db = getDb();
  const socio = db.prepare('SELECT * FROM socios WHERE id=?').get(req.params.id);
  if (!socio) return res.status(404).json({ error: 'Sócio não encontrado' });
  const pagamentos = db.prepare('SELECT * FROM pagamentos_socios WHERE socio_id=? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...socio, pagamentos });
});

// Create
router.post('/', (req, res) => {
  const { nome, email, telefone, matricula, curso, plano, valor_mensalidade, data_inicio, data_fim, observacoes } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
  const db = getDb();
  const result = db.prepare(`INSERT INTO socios (nome,email,telefone,matricula,curso,plano,valor_mensalidade,data_inicio,data_fim,observacoes) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(nome, email, telefone, matricula, curso, plano || 'mensal', valor_mensalidade || 0, data_inicio, data_fim, observacoes);
  res.json({ id: result.lastInsertRowid });
});

// Update
router.put('/:id', (req, res) => {
  const { nome, email, telefone, matricula, curso, plano, valor_mensalidade, status, data_inicio, data_fim, observacoes } = req.body;
  const db = getDb();
  db.prepare(`UPDATE socios SET nome=?,email=?,telefone=?,matricula=?,curso=?,plano=?,valor_mensalidade=?,status=?,data_inicio=?,data_fim=?,observacoes=?,updated_at=datetime('now','localtime') WHERE id=?`).run(nome, email, telefone, matricula, curso, plano, valor_mensalidade, status, data_inicio, data_fim, observacoes, req.params.id);
  res.json({ success: true });
});

// Delete
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM socios WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// Registrar pagamento de socio
router.post('/:id/pagamentos', (req, res) => {
  const { valor, mes_referencia, ano_referencia, metodo_pagamento, data_vencimento, observacoes } = req.body;
  const db = getDb();
  const result = db.prepare(`INSERT INTO pagamentos_socios (socio_id,valor,mes_referencia,ano_referencia,metodo_pagamento,data_vencimento,status,observacoes) VALUES (?,?,?,?,?,?,?,?)`).run(req.params.id, valor, mes_referencia, ano_referencia, metodo_pagamento, data_vencimento, 'pendente', observacoes);
  res.json({ id: result.lastInsertRowid });
});

// Marcar pagamento como pago
router.put('/pagamentos/:pagId/pagar', (req, res) => {
  const { metodo_pagamento } = req.body;
  const db = getDb();
  db.prepare(`UPDATE pagamentos_socios SET status='pago', metodo_pagamento=?, data_pagamento=datetime('now','localtime') WHERE id=?`).run(metodo_pagamento || 'dinheiro', req.params.pagId);
  // Registrar no caixa
  const pag = db.prepare('SELECT * FROM pagamentos_socios WHERE id=?').get(req.params.pagId);
  if (pag) {
    const config = db.prepare("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'").get();
    const saldoAtual = parseFloat(config?.valor || 0);
    const novoSaldo = saldoAtual + pag.valor;
    db.prepare("UPDATE configuracoes SET valor=? WHERE chave='saldo_caixa'").run(novoSaldo.toString());
    db.prepare(`INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior) VALUES ('entrada','mensalidade',?,?,?,?,?,?)`).run(`Mensalidade sócio #${pag.socio_id}`, pag.valor, 'pagamento_socio', pag.id, saldoAtual, novoSaldo);
  }
  res.json({ success: true });
});

// Receita mensal/anual detalhada
router.get('/relatorio/receitas', (req, res) => {
  const db = getDb();
  const { ano } = req.query;
  const anoAtual = ano || new Date().getFullYear();
  const porMes = db.prepare(`SELECT mes_referencia as mes, COALESCE(SUM(valor),0) as total, COUNT(*) as quantidade FROM pagamentos_socios WHERE status='pago' AND ano_referencia=? GROUP BY mes_referencia ORDER BY mes_referencia`).all(anoAtual);
  res.json({ ano: anoAtual, porMes });
});

module.exports = router;
