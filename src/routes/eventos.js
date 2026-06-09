const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.use(authMiddleware);

// === EVENTOS ===
router.get('/', (req, res) => {
  const db = getDb();
  const eventos = db.prepare('SELECT e.*, (SELECT COUNT(*) FROM ingressos WHERE evento_id=e.id AND status="pago") as ingressos_vendidos FROM eventos e ORDER BY data_evento DESC').all();
  res.json(eventos);
});

router.post('/', (req, res) => {
  const { nome, descricao, data_evento, local, capacidade, valor_ingresso, imagem_url } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
  const db = getDb();
  const result = db.prepare('INSERT INTO eventos (nome,descricao,data_evento,local,capacidade,valor_ingresso,imagem_url) VALUES (?,?,?,?,?,?,?)').run(nome, descricao, data_evento, local, capacidade || 0, valor_ingresso || 0, imagem_url);
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { nome, descricao, data_evento, local, capacidade, valor_ingresso, status, imagem_url } = req.body;
  const db = getDb();
  db.prepare(`UPDATE eventos SET nome=?,descricao=?,data_evento=?,local=?,capacidade=?,valor_ingresso=?,status=?,imagem_url=?,updated_at=datetime('now','localtime') WHERE id=?`).run(nome, descricao, data_evento, local, capacidade, valor_ingresso, status, imagem_url, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE eventos SET status="cancelado" WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// Lotes
router.get('/:id/lotes', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM lotes_ingresso WHERE evento_id=?').all(req.params.id));
});

router.post('/:id/lotes', (req, res) => {
  const { nome, quantidade, valor, data_inicio, data_fim } = req.body;
  const db = getDb();
  const result = db.prepare('INSERT INTO lotes_ingresso (evento_id,nome,quantidade,valor,data_inicio,data_fim) VALUES (?,?,?,?,?,?)').run(req.params.id, nome, quantidade, valor, data_inicio, data_fim);
  res.json({ id: result.lastInsertRowid });
});

// === INGRESSOS ===
router.get('/:id/ingressos', (req, res) => {
  const db = getDb();
  const ingressos = db.prepare('SELECT i.*, l.nome as lote_nome FROM ingressos i LEFT JOIN lotes_ingresso l ON i.lote_id=l.id WHERE i.evento_id=? ORDER BY i.created_at DESC').all(req.params.id);
  res.json(ingressos);
});

// Vender ingresso
router.post('/:id/ingressos', (req, res) => {
  const { nome_comprador, email_comprador, telefone_comprador, lote_id, quantidade, metodo_pagamento } = req.body;
  if (!nome_comprador) return res.status(400).json({ error: 'Nome obrigatório' });
  const db = getDb();
  const evento = db.prepare('SELECT * FROM eventos WHERE id=?').get(req.params.id);
  if (!evento) return res.status(404).json({ error: 'Evento não encontrado' });

  let valor = evento.valor_ingresso;
  if (lote_id) {
    const lote = db.prepare('SELECT * FROM lotes_ingresso WHERE id=?').get(lote_id);
    if (lote) valor = lote.valor;
  }

  const qtd = quantidade || 1;
  const ingressosCriados = [];
  const insertIngresso = db.prepare('INSERT INTO ingressos (codigo,evento_id,lote_id,nome_comprador,email_comprador,telefone_comprador,nome_portador,email_portador,valor,metodo_pagamento,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)');

  for (let i = 0; i < qtd; i++) {
    const codigo = `ING-${Date.now()}-${uuidv4().slice(0,6).toUpperCase()}`;
    const status = metodo_pagamento === 'dinheiro' ? 'pago' : 'pendente';
    const result = insertIngresso.run(codigo, req.params.id, lote_id || null, nome_comprador, email_comprador, telefone_comprador, nome_comprador, email_comprador, valor, metodo_pagamento, status);
    ingressosCriados.push({ id: result.lastInsertRowid, codigo, status });

    if (status === 'pago') {
      const config = db.prepare("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'").get();
      const saldoAtual = parseFloat(config?.valor || 0);
      const novoSaldo = saldoAtual + valor;
      db.prepare("UPDATE configuracoes SET valor=? WHERE chave='saldo_caixa'").run(novoSaldo.toString());
      db.prepare(`INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior) VALUES ('entrada','ingressos',?,?,?,?,?,?)`).run(`Ingresso ${evento.nome} - ${codigo}`, valor, 'ingresso', result.lastInsertRowid, saldoAtual, novoSaldo);
    }
  }

  res.json({ ingressos: ingressosCriados });
});

// Transferir ingresso
router.post('/ingressos/:ingressoId/transferir', (req, res) => {
  const { nome_novo_portador, email_novo_portador, motivo } = req.body;
  if (!nome_novo_portador) return res.status(400).json({ error: 'Nome do novo portador obrigatório' });
  const db = getDb();
  const ingresso = db.prepare('SELECT * FROM ingressos WHERE id=?').get(req.params.ingressoId);
  if (!ingresso) return res.status(404).json({ error: 'Ingresso não encontrado' });
  if (ingresso.status !== 'pago') return res.status(400).json({ error: 'Ingresso não está pago' });

  const historico = JSON.parse(ingresso.historico_transferencias || '[]');
  historico.push({
    de: { nome: ingresso.nome_portador, email: ingresso.email_portador },
    para: { nome: nome_novo_portador, email: email_novo_portador },
    motivo,
    data: new Date().toISOString()
  });

  db.prepare('UPDATE ingressos SET nome_portador=?, email_portador=?, transferido=1, historico_transferencias=? WHERE id=?').run(nome_novo_portador, email_novo_portador, JSON.stringify(historico), req.params.ingressoId);
  res.json({ success: true });
});

// Confirmar pagamento ingresso
router.put('/ingressos/:ingressoId/pagar', (req, res) => {
  const db = getDb();
  const ingresso = db.prepare('SELECT * FROM ingressos WHERE id=?').get(req.params.ingressoId);
  if (!ingresso) return res.status(404).json({ error: 'Ingresso não encontrado' });
  db.prepare(`UPDATE ingressos SET status='pago', data_pagamento=datetime('now','localtime') WHERE id=?`).run(req.params.ingressoId);

  const evento = db.prepare('SELECT nome FROM eventos WHERE id=?').get(ingresso.evento_id);
  const config = db.prepare("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'").get();
  const saldoAtual = parseFloat(config?.valor || 0);
  const novoSaldo = saldoAtual + ingresso.valor;
  db.prepare("UPDATE configuracoes SET valor=? WHERE chave='saldo_caixa'").run(novoSaldo.toString());
  db.prepare(`INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior) VALUES ('entrada','ingressos',?,?,?,?,?,?)`).run(`Ingresso ${evento?.nome} - ${ingresso.codigo}`, ingresso.valor, 'ingresso', ingresso.id, saldoAtual, novoSaldo);

  res.json({ success: true });
});

// Stats evento
router.get('/:id/stats', (req, res) => {
  const db = getDb();
  const total = db.prepare("SELECT COUNT(*) as c FROM ingressos WHERE evento_id=?").get(req.params.id).c;
  const pagos = db.prepare("SELECT COUNT(*) as c, COALESCE(SUM(valor),0) as receita FROM ingressos WHERE evento_id=? AND status='pago'").get(req.params.id);
  const pendentes = db.prepare("SELECT COUNT(*) as c FROM ingressos WHERE evento_id=? AND status='pendente'").get(req.params.id).c;
  const transferidos = db.prepare("SELECT COUNT(*) as c FROM ingressos WHERE evento_id=? AND transferido=1").get(req.params.id).c;
  res.json({ total, pagos: pagos.c, receita: pagos.receita, pendentes, transferidos });
});

module.exports = router;
