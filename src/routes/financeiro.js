const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// === CAIXA ===
router.get('/caixa', (req, res) => {
  const db = getDb();
  const { inicio, fim, tipo } = req.query;
  let query = `SELECT c.*, u.nome as operador_nome FROM caixa c LEFT JOIN users u ON c.operador_id=u.id WHERE 1=1`;
  const params = [];
  if (inicio) { query += ' AND date(c.data_movimentacao) >= ?'; params.push(inicio); }
  if (fim) { query += ' AND date(c.data_movimentacao) <= ?'; params.push(fim); }
  if (tipo) { query += ' AND c.tipo = ?'; params.push(tipo); }
  query += ' ORDER BY c.data_movimentacao DESC LIMIT 200';
  const movimentos = db.prepare(query).all(...params);
  const config = db.prepare("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'").get();
  const saldo = parseFloat(config?.valor || 0);
  res.json({ saldo, movimentos });
});

router.get('/caixa/resumo', (req, res) => {
  const db = getDb();
  const hoje = db.prepare(`SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END),0) as entradas, COALESCE(SUM(CASE WHEN tipo='saida' THEN valor ELSE 0 END),0) as saidas FROM caixa WHERE date(data_movimentacao)=date('now','localtime')`).get();
  const mes = db.prepare(`SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END),0) as entradas, COALESCE(SUM(CASE WHEN tipo='saida' THEN valor ELSE 0 END),0) as saidas FROM caixa WHERE strftime('%Y-%m',data_movimentacao)=strftime('%Y-%m','now','localtime')`).get();
  const config = db.prepare("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'").get();
  res.json({ saldo: parseFloat(config?.valor || 0), hoje, mes });
});

// Lançamento manual no caixa
router.post('/caixa', (req, res) => {
  const { tipo, categoria, descricao, valor, observacoes } = req.body;
  if (!tipo || !descricao || !valor) return res.status(400).json({ error: 'Campos obrigatórios' });
  const db = getDb();
  const config = db.prepare("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'").get();
  const saldoAtual = parseFloat(config?.valor || 0);
  const v = parseFloat(valor);
  const novoSaldo = tipo === 'entrada' ? saldoAtual + v : saldoAtual - v;
  db.prepare("UPDATE configuracoes SET valor=? WHERE chave='saldo_caixa'").run(novoSaldo.toString());
  const result = db.prepare(`INSERT INTO caixa (tipo,categoria,descricao,valor,saldo_anterior,saldo_posterior,operador_id,observacoes) VALUES (?,?,?,?,?,?,?,?)`).run(tipo, categoria, descricao, v, saldoAtual, novoSaldo, req.user.id, observacoes);
  res.json({ id: result.lastInsertRowid, saldo: novoSaldo });
});

// === CONTAS A PAGAR ===
router.get('/pagar', (req, res) => {
  const db = getDb();
  const { status, inicio, fim } = req.query;
  let q = 'SELECT * FROM contas_pagar WHERE 1=1';
  const p = [];
  if (status) { q += ' AND status=?'; p.push(status); }
  if (inicio) { q += ' AND data_vencimento>=?'; p.push(inicio); }
  if (fim) { q += ' AND data_vencimento<=?'; p.push(fim); }
  q += ' ORDER BY data_vencimento';
  res.json(db.prepare(q).all(...p));
});

router.post('/pagar', (req, res) => {
  const { descricao, fornecedor, categoria, valor, data_vencimento, recorrente, observacoes } = req.body;
  if (!descricao || !valor || !data_vencimento) return res.status(400).json({ error: 'Campos obrigatórios' });
  const db = getDb();
  const result = db.prepare('INSERT INTO contas_pagar (descricao,fornecedor,categoria,valor,data_vencimento,recorrente,observacoes) VALUES (?,?,?,?,?,?,?)').run(descricao, fornecedor, categoria, valor, data_vencimento, recorrente ? 1 : 0, observacoes);
  res.json({ id: result.lastInsertRowid });
});

router.put('/pagar/:id', (req, res) => {
  const { descricao, fornecedor, categoria, valor, data_vencimento, status, metodo_pagamento, observacoes } = req.body;
  const db = getDb();
  db.prepare(`UPDATE contas_pagar SET descricao=?,fornecedor=?,categoria=?,valor=?,data_vencimento=?,status=?,metodo_pagamento=?,observacoes=?,updated_at=datetime('now','localtime') WHERE id=?`).run(descricao, fornecedor, categoria, valor, data_vencimento, status, metodo_pagamento, observacoes, req.params.id);
  res.json({ success: true });
});

router.put('/pagar/:id/pagar', (req, res) => {
  const { metodo_pagamento } = req.body;
  const db = getDb();
  const conta = db.prepare('SELECT * FROM contas_pagar WHERE id=?').get(req.params.id);
  if (!conta) return res.status(404).json({ error: 'Conta não encontrada' });
  db.prepare(`UPDATE contas_pagar SET status='pago', metodo_pagamento=?, data_pagamento=datetime('now','localtime') WHERE id=?`).run(metodo_pagamento || 'dinheiro', req.params.id);
  // Debitar do caixa
  const config = db.prepare("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'").get();
  const saldoAtual = parseFloat(config?.valor || 0);
  const novoSaldo = saldoAtual - conta.valor;
  db.prepare("UPDATE configuracoes SET valor=? WHERE chave='saldo_caixa'").run(novoSaldo.toString());
  db.prepare(`INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior) VALUES ('saida','conta_pagar',?,?,?,?,?,?)`).run(conta.descricao, conta.valor, 'conta_pagar', conta.id, saldoAtual, novoSaldo);
  res.json({ success: true });
});

router.delete('/pagar/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM contas_pagar WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// === CONTAS A RECEBER ===
router.get('/receber', (req, res) => {
  const db = getDb();
  const { status } = req.query;
  let q = 'SELECT * FROM contas_receber WHERE 1=1';
  const p = [];
  if (status) { q += ' AND status=?'; p.push(status); }
  q += ' ORDER BY data_vencimento';
  res.json(db.prepare(q).all(...p));
});

router.post('/receber', (req, res) => {
  const { descricao, cliente, categoria, valor, data_vencimento, observacoes } = req.body;
  if (!descricao || !valor || !data_vencimento) return res.status(400).json({ error: 'Campos obrigatórios' });
  const db = getDb();
  const result = db.prepare('INSERT INTO contas_receber (descricao,cliente,categoria,valor,data_vencimento,observacoes) VALUES (?,?,?,?,?,?)').run(descricao, cliente, categoria, valor, data_vencimento, observacoes);
  res.json({ id: result.lastInsertRowid });
});

router.put('/receber/:id/receber', (req, res) => {
  const { metodo_pagamento } = req.body;
  const db = getDb();
  const conta = db.prepare('SELECT * FROM contas_receber WHERE id=?').get(req.params.id);
  if (!conta) return res.status(404).json({ error: 'Conta não encontrada' });
  db.prepare(`UPDATE contas_receber SET status='recebido', metodo_pagamento=?, data_recebimento=datetime('now','localtime') WHERE id=?`).run(metodo_pagamento || 'dinheiro', req.params.id);
  const config = db.prepare("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'").get();
  const saldoAtual = parseFloat(config?.valor || 0);
  const novoSaldo = saldoAtual + conta.valor;
  db.prepare("UPDATE configuracoes SET valor=? WHERE chave='saldo_caixa'").run(novoSaldo.toString());
  db.prepare(`INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior) VALUES ('entrada','conta_receber',?,?,?,?,?,?)`).run(conta.descricao, conta.valor, 'conta_receber', conta.id, saldoAtual, novoSaldo);
  res.json({ success: true });
});

router.delete('/receber/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM contas_receber WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// === PRODUTOS ===
router.get('/produtos', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM produtos WHERE ativo=1 ORDER BY nome').all());
});

router.post('/produtos', (req, res) => {
  const { nome, descricao, categoria, preco_custo, preco_venda, estoque, estoque_minimo } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
  const db = getDb();
  const result = db.prepare('INSERT INTO produtos (nome,descricao,categoria,preco_custo,preco_venda,estoque,estoque_minimo) VALUES (?,?,?,?,?,?,?)').run(nome, descricao, categoria, preco_custo || 0, preco_venda || 0, estoque || 0, estoque_minimo || 5);
  res.json({ id: result.lastInsertRowid });
});

router.put('/produtos/:id', (req, res) => {
  const { nome, descricao, categoria, preco_custo, preco_venda, estoque, estoque_minimo, ativo } = req.body;
  const db = getDb();
  db.prepare(`UPDATE produtos SET nome=?,descricao=?,categoria=?,preco_custo=?,preco_venda=?,estoque=?,estoque_minimo=?,ativo=?,updated_at=datetime('now','localtime') WHERE id=?`).run(nome, descricao, categoria, preco_custo, preco_venda, estoque, estoque_minimo, ativo ?? 1, req.params.id);
  res.json({ success: true });
});

router.delete('/produtos/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE produtos SET ativo=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// === VENDAS ===
router.get('/vendas', (req, res) => {
  const db = getDb();
  const vendas = db.prepare(`SELECT v.*, u.nome as operador_nome FROM vendas v LEFT JOIN users u ON v.operador_id=u.id ORDER BY v.data_venda DESC LIMIT 100`).all();
  res.json(vendas);
});

router.post('/vendas', (req, res) => {
  const { descricao, itens, metodo_pagamento, desconto, observacoes } = req.body;
  const db = getDb();
  const total = (itens || []).reduce((s, i) => s + (i.preco_unitario * i.quantidade), 0);
  const totalFinal = total - (desconto || 0);
  const result = db.prepare('INSERT INTO vendas (descricao,valor_total,desconto,metodo_pagamento,status,operador_id,observacoes) VALUES (?,?,?,?,?,?,?)').run(descricao || 'Venda', totalFinal, desconto || 0, metodo_pagamento, 'pago', req.user.id, observacoes);
  const vendaId = result.lastInsertRowid;
  const insertItem = db.prepare('INSERT INTO itens_venda (venda_id,produto_id,descricao,quantidade,preco_unitario,subtotal) VALUES (?,?,?,?,?,?)');
  for (const item of (itens || [])) {
    insertItem.run(vendaId, item.produto_id || null, item.descricao, item.quantidade, item.preco_unitario, item.quantidade * item.preco_unitario);
    if (item.produto_id) {
      db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id=?').run(item.quantidade, item.produto_id);
    }
  }
  // Registrar no caixa
  const config = db.prepare("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'").get();
  const saldoAtual = parseFloat(config?.valor || 0);
  const novoSaldo = saldoAtual + totalFinal;
  db.prepare("UPDATE configuracoes SET valor=? WHERE chave='saldo_caixa'").run(novoSaldo.toString());
  db.prepare(`INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior,operador_id) VALUES ('entrada','venda',?,?,?,?,?,?,?)`).run(descricao || 'Venda', totalFinal, 'venda', vendaId, saldoAtual, novoSaldo, req.user.id);
  res.json({ id: vendaId, total: totalFinal });
});

// === CONFIGURACOES ===
router.get('/config', (req, res) => {
  const db = getDb();
  const configs = db.prepare('SELECT * FROM configuracoes').all();
  const obj = {};
  configs.forEach(c => obj[c.chave] = c.valor);
  res.json(obj);
});

router.put('/config', (req, res) => {
  const db = getDb();
  const update = db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor, updated_at) VALUES (?, ?, datetime('now','localtime'))");
  for (const [k, v] of Object.entries(req.body)) {
    update.run(k, v);
  }
  res.json({ success: true });
});

// === DASHBOARD ===
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const config = db.prepare("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'").get();
  const saldo = parseFloat(config?.valor || 0);
  const socios = db.prepare("SELECT COUNT(*) as c FROM socios WHERE status='ativo'").get().c;
  const receitaMes = db.prepare(`SELECT COALESCE(SUM(valor),0) as t FROM caixa WHERE tipo='entrada' AND strftime('%Y-%m',data_movimentacao)=strftime('%Y-%m','now','localtime')`).get().t;
  const despesasMes = db.prepare(`SELECT COALESCE(SUM(valor),0) as t FROM caixa WHERE tipo='saida' AND strftime('%Y-%m',data_movimentacao)=strftime('%Y-%m','now','localtime')`).get().t;
  const contasVencer = db.prepare(`SELECT COUNT(*) as c FROM contas_pagar WHERE status='pendente' AND data_vencimento <= date('now','+7 days','localtime')`).get().c;
  const eventosPróximos = db.prepare(`SELECT COUNT(*) as c FROM eventos WHERE status='ativo' AND data_evento >= date('now','localtime')`).get().c;
  const ingressosHoje = db.prepare(`SELECT COUNT(*) as c FROM ingressos WHERE status='pago' AND date(data_pagamento)=date('now','localtime')`).get().c;
  const ultimosMovimentos = db.prepare(`SELECT * FROM caixa ORDER BY data_movimentacao DESC LIMIT 5`).all();
  const receitaAnual = [];
  for (let m = 1; m <= 12; m++) {
    const mes = m.toString().padStart(2, '0');
    const ano = new Date().getFullYear();
    const entrada = db.prepare(`SELECT COALESCE(SUM(valor),0) as t FROM caixa WHERE tipo='entrada' AND strftime('%Y-%m',data_movimentacao)=?`).get(`${ano}-${mes}`).t;
    const saida = db.prepare(`SELECT COALESCE(SUM(valor),0) as t FROM caixa WHERE tipo='saida' AND strftime('%Y-%m',data_movimentacao)=?`).get(`${ano}-${mes}`).t;
    receitaAnual.push({ mes, entrada, saida });
  }
  res.json({ saldo, socios, receitaMes, despesasMes, contasVencer, eventosPróximos, ingressosHoje, ultimosMovimentos, receitaAnual });
});

module.exports = router;
