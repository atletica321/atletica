const express = require('express');
const router = express.Router();
const { get, all, run, query } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const eventos = await all(`SELECT e.*, (SELECT COUNT(*) FROM ingressos WHERE evento_id=e.id AND status='pago') as ingressos_vendidos FROM eventos e ORDER BY data_evento DESC`);
    res.json(eventos);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { nome, descricao, data_evento, local, capacidade, valor_ingresso, imagem_url } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
    const r = await run('INSERT INTO eventos (nome,descricao,data_evento,local,capacidade,valor_ingresso,imagem_url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [nome, descricao, data_evento, local, capacidade || 0, valor_ingresso || 0, imagem_url]);
    res.json({ id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { nome, descricao, data_evento, local, capacidade, valor_ingresso, status, imagem_url } = req.body;
    await query('UPDATE eventos SET nome=$1,descricao=$2,data_evento=$3,local=$4,capacidade=$5,valor_ingresso=$6,status=$7,imagem_url=$8,updated_at=NOW() WHERE id=$9',
      [nome, descricao, data_evento, local, capacidade, valor_ingresso, status, imagem_url, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query("UPDATE eventos SET status='cancelado' WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/lotes', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM lotes_ingresso WHERE evento_id=$1', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/lotes', async (req, res) => {
  try {
    const { nome, quantidade, valor, data_inicio, data_fim } = req.body;
    const r = await run('INSERT INTO lotes_ingresso (evento_id,nome,quantidade,valor,data_inicio,data_fim) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [req.params.id, nome, quantidade, valor, data_inicio, data_fim]);
    res.json({ id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/ingressos', async (req, res) => {
  try {
    res.json(await all('SELECT i.*, l.nome as lote_nome FROM ingressos i LEFT JOIN lotes_ingresso l ON i.lote_id=l.id WHERE i.evento_id=$1 ORDER BY i.created_at DESC', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/ingressos', async (req, res) => {
  try {
    const { nome_comprador, email_comprador, telefone_comprador, lote_id, quantidade, metodo_pagamento } = req.body;
    if (!nome_comprador) return res.status(400).json({ error: 'Nome obrigatório' });
    const evento = await get('SELECT * FROM eventos WHERE id=$1', [req.params.id]);
    if (!evento) return res.status(404).json({ error: 'Evento não encontrado' });
    let valor = parseFloat(evento.valor_ingresso);
    if (lote_id) {
      const lote = await get('SELECT * FROM lotes_ingresso WHERE id=$1', [lote_id]);
      if (lote) valor = parseFloat(lote.valor);
    }
    const qtd = quantidade || 1;
    const criados = [];
    for (let i = 0; i < qtd; i++) {
      const codigo = `ING-${Date.now()}-${uuidv4().slice(0,6).toUpperCase()}`;
      const status = metodo_pagamento === 'dinheiro' ? 'pago' : 'pendente';
      const r = await run('INSERT INTO ingressos (codigo,evento_id,lote_id,nome_comprador,email_comprador,telefone_comprador,nome_portador,email_portador,valor,metodo_pagamento,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
        [codigo, req.params.id, lote_id || null, nome_comprador, email_comprador, telefone_comprador, nome_comprador, email_comprador, valor, metodo_pagamento, status]);
      criados.push({ id: r.rows[0].id, codigo, status });
      if (status === 'pago') {
        const cfg = await get("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'");
        const sa = parseFloat(cfg?.valor || 0);
        const ns = sa + valor;
        await query("UPDATE configuracoes SET valor=$1 WHERE chave='saldo_caixa'", [ns.toString()]);
        await query("INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior) VALUES ('entrada','ingressos',$1,$2,'ingresso',$3,$4,$5)",
          [`Ingresso ${evento.nome} - ${codigo}`, valor, r.rows[0].id, sa, ns]);
      }
    }
    res.json({ ingressos: criados });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/ingressos/:ingressoId/transferir', async (req, res) => {
  try {
    const { nome_novo_portador, email_novo_portador, motivo } = req.body;
    if (!nome_novo_portador) return res.status(400).json({ error: 'Nome obrigatório' });
    const ing = await get('SELECT * FROM ingressos WHERE id=$1', [req.params.ingressoId]);
    if (!ing) return res.status(404).json({ error: 'Ingresso não encontrado' });
    if (ing.status !== 'pago') return res.status(400).json({ error: 'Ingresso não está pago' });
    const historico = JSON.parse(ing.historico_transferencias || '[]');
    historico.push({ de: { nome: ing.nome_portador, email: ing.email_portador }, para: { nome: nome_novo_portador, email: email_novo_portador }, motivo, data: new Date().toISOString() });
    await query('UPDATE ingressos SET nome_portador=$1, email_portador=$2, transferido=1, historico_transferencias=$3 WHERE id=$4',
      [nome_novo_portador, email_novo_portador, JSON.stringify(historico), req.params.ingressoId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/ingressos/:ingressoId/pagar', async (req, res) => {
  try {
    const ing = await get('SELECT * FROM ingressos WHERE id=$1', [req.params.ingressoId]);
    if (!ing) return res.status(404).json({ error: 'Ingresso não encontrado' });
    await query("UPDATE ingressos SET status='pago', data_pagamento=NOW() WHERE id=$1", [req.params.ingressoId]);
    const evento = await get('SELECT nome FROM eventos WHERE id=$1', [ing.evento_id]);
    const cfg = await get("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'");
    const sa = parseFloat(cfg?.valor || 0);
    const ns = sa + parseFloat(ing.valor);
    await query("UPDATE configuracoes SET valor=$1 WHERE chave='saldo_caixa'", [ns.toString()]);
    await query("INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior) VALUES ('entrada','ingressos',$1,$2,'ingresso',$3,$4,$5)",
      [`Ingresso ${evento?.nome} - ${ing.codigo}`, ing.valor, ing.id, sa, ns]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/stats', async (req, res) => {
  try {
    const total = (await get('SELECT COUNT(*) as c FROM ingressos WHERE evento_id=$1', [req.params.id])).c;
    const pagos = await get("SELECT COUNT(*) as c, COALESCE(SUM(valor),0) as receita FROM ingressos WHERE evento_id=$1 AND status='pago'", [req.params.id]);
    const pendentes = (await get("SELECT COUNT(*) as c FROM ingressos WHERE evento_id=$1 AND status='pendente'", [req.params.id])).c;
    const transferidos = (await get('SELECT COUNT(*) as c FROM ingressos WHERE evento_id=$1 AND transferido=1', [req.params.id])).c;
    res.json({ total, pagos: pagos.c, receita: pagos.receita, pendentes, transferidos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
