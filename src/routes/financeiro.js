const express = require('express');
const router = express.Router();
const { get, all, run, query } = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── CAIXA ──
router.get('/caixa', async (req, res) => {
  try {
    const { inicio, fim, tipo } = req.query;
    let sql = `SELECT c.*, u.nome as operador_nome FROM caixa c LEFT JOIN users u ON c.operador_id=u.id WHERE 1=1`;
    const params = []; let i = 1;
    if (inicio) { sql += ` AND DATE(c.data_movimentacao) >= $${i++}`; params.push(inicio); }
    if (fim) { sql += ` AND DATE(c.data_movimentacao) <= $${i++}`; params.push(fim); }
    if (tipo) { sql += ` AND c.tipo = $${i++}`; params.push(tipo); }
    sql += ' ORDER BY c.data_movimentacao DESC LIMIT 200';
    const movimentos = await all(sql, params);
    const cfg = await get("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'");
    res.json({ saldo: parseFloat(cfg?.valor || 0), movimentos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/caixa/resumo', async (req, res) => {
  try {
    const hoje = await get(`SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END),0) as entradas, COALESCE(SUM(CASE WHEN tipo='saida' THEN valor ELSE 0 END),0) as saidas FROM caixa WHERE DATE(data_movimentacao)=CURRENT_DATE`);
    const mes = await get(`SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END),0) as entradas, COALESCE(SUM(CASE WHEN tipo='saida' THEN valor ELSE 0 END),0) as saidas FROM caixa WHERE DATE_TRUNC('month',data_movimentacao)=DATE_TRUNC('month',NOW())`);
    const cfg = await get("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'");
    res.json({ saldo: parseFloat(cfg?.valor || 0), hoje, mes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/caixa', async (req, res) => {
  try {
    const { tipo, categoria, descricao, valor, observacoes } = req.body;
    if (!tipo || !descricao || !valor) return res.status(400).json({ error: 'Campos obrigatórios' });
    const cfg = await get("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'");
    const saldoAtual = parseFloat(cfg?.valor || 0);
    const v = parseFloat(valor);
    const novoSaldo = tipo === 'entrada' ? saldoAtual + v : saldoAtual - v;
    await query("UPDATE configuracoes SET valor=$1 WHERE chave='saldo_caixa'", [novoSaldo.toString()]);
    const r = await run('INSERT INTO caixa (tipo,categoria,descricao,valor,saldo_anterior,saldo_posterior,operador_id,observacoes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [tipo, categoria, descricao, v, saldoAtual, novoSaldo, req.user.id, observacoes]);
    res.json({ id: r.rows[0].id, saldo: novoSaldo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CONTAS A PAGAR ──
router.get('/pagar', async (req, res) => {
  try {
    const { status, inicio, fim } = req.query;
    let sql = 'SELECT * FROM contas_pagar WHERE 1=1'; const params = []; let i = 1;
    if (status) { sql += ` AND status=$${i++}`; params.push(status); }
    if (inicio) { sql += ` AND data_vencimento>=$${i++}`; params.push(inicio); }
    if (fim) { sql += ` AND data_vencimento<=$${i++}`; params.push(fim); }
    sql += ' ORDER BY data_vencimento';
    res.json(await all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pagar', async (req, res) => {
  try {
    const { descricao, fornecedor, categoria, valor, data_vencimento, recorrente, observacoes } = req.body;
    if (!descricao || !valor || !data_vencimento) return res.status(400).json({ error: 'Campos obrigatórios' });
    const r = await run('INSERT INTO contas_pagar (descricao,fornecedor,categoria,valor,data_vencimento,recorrente,observacoes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [descricao, fornecedor, categoria, valor, data_vencimento, recorrente ? 1 : 0, observacoes]);
    res.json({ id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/pagar/:id', async (req, res) => {
  try {
    const { descricao, fornecedor, categoria, valor, data_vencimento, status, metodo_pagamento, observacoes } = req.body;
    await query('UPDATE contas_pagar SET descricao=$1,fornecedor=$2,categoria=$3,valor=$4,data_vencimento=$5,status=$6,metodo_pagamento=$7,observacoes=$8,updated_at=NOW() WHERE id=$9',
      [descricao, fornecedor, categoria, valor, data_vencimento, status, metodo_pagamento, observacoes, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/pagar/:id/pagar', async (req, res) => {
  try {
    const { metodo_pagamento } = req.body;
    const conta = await get('SELECT * FROM contas_pagar WHERE id=$1', [req.params.id]);
    if (!conta) return res.status(404).json({ error: 'Conta não encontrada' });
    await query("UPDATE contas_pagar SET status='pago', metodo_pagamento=$1, data_pagamento=NOW() WHERE id=$2", [metodo_pagamento || 'dinheiro', req.params.id]);
    const cfg = await get("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'");
    const sa = parseFloat(cfg?.valor || 0);
    const ns = sa - parseFloat(conta.valor);
    await query("UPDATE configuracoes SET valor=$1 WHERE chave='saldo_caixa'", [ns.toString()]);
    await query("INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior) VALUES ('saida','conta_pagar',$1,$2,'conta_pagar',$3,$4,$5)",
      [conta.descricao, conta.valor, conta.id, sa, ns]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/pagar/:id', async (req, res) => {
  try { await query('DELETE FROM contas_pagar WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CONTAS A RECEBER ──
router.get('/receber', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM contas_receber WHERE 1=1'; const params = []; let i = 1;
    if (status) { sql += ` AND status=$${i++}`; params.push(status); }
    sql += ' ORDER BY data_vencimento';
    res.json(await all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/receber', async (req, res) => {
  try {
    const { descricao, cliente, categoria, valor, data_vencimento, observacoes } = req.body;
    if (!descricao || !valor || !data_vencimento) return res.status(400).json({ error: 'Campos obrigatórios' });
    const r = await run('INSERT INTO contas_receber (descricao,cliente,categoria,valor,data_vencimento,observacoes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [descricao, cliente, categoria, valor, data_vencimento, observacoes]);
    res.json({ id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/receber/:id/receber', async (req, res) => {
  try {
    const { metodo_pagamento } = req.body;
    const conta = await get('SELECT * FROM contas_receber WHERE id=$1', [req.params.id]);
    if (!conta) return res.status(404).json({ error: 'Conta não encontrada' });
    await query("UPDATE contas_receber SET status='recebido', metodo_pagamento=$1, data_recebimento=NOW() WHERE id=$2", [metodo_pagamento || 'dinheiro', req.params.id]);
    const cfg = await get("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'");
    const sa = parseFloat(cfg?.valor || 0);
    const ns = sa + parseFloat(conta.valor);
    await query("UPDATE configuracoes SET valor=$1 WHERE chave='saldo_caixa'", [ns.toString()]);
    await query("INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior) VALUES ('entrada','conta_receber',$1,$2,'conta_receber',$3,$4,$5)",
      [conta.descricao, conta.valor, conta.id, sa, ns]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/receber/:id', async (req, res) => {
  try { await query('DELETE FROM contas_receber WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PRODUTOS ──
router.get('/produtos', async (req, res) => {
  try { res.json(await all('SELECT * FROM produtos WHERE ativo=1 ORDER BY nome')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/produtos', async (req, res) => {
  try {
    const { nome, descricao, categoria, preco_custo, preco_venda, estoque, estoque_minimo } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
    const r = await run('INSERT INTO produtos (nome,descricao,categoria,preco_custo,preco_venda,estoque,estoque_minimo) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [nome, descricao, categoria, preco_custo || 0, preco_venda || 0, estoque || 0, estoque_minimo || 5]);
    res.json({ id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/produtos/:id', async (req, res) => {
  try {
    const { nome, descricao, categoria, preco_custo, preco_venda, estoque, estoque_minimo, ativo } = req.body;
    await query('UPDATE produtos SET nome=$1,descricao=$2,categoria=$3,preco_custo=$4,preco_venda=$5,estoque=$6,estoque_minimo=$7,ativo=$8,updated_at=NOW() WHERE id=$9',
      [nome, descricao, categoria, preco_custo, preco_venda, estoque, estoque_minimo, ativo ?? 1, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/produtos/:id', async (req, res) => {
  try { await query('UPDATE produtos SET ativo=0 WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── VENDAS ──
router.get('/vendas', async (req, res) => {
  try {
    res.json(await all('SELECT v.*, u.nome as operador_nome FROM vendas v LEFT JOIN users u ON v.operador_id=u.id ORDER BY v.data_venda DESC LIMIT 100'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/vendas', async (req, res) => {
  try {
    const { descricao, itens, metodo_pagamento, desconto, observacoes } = req.body;
    const total = (itens || []).reduce((s, i) => s + (i.preco_unitario * i.quantidade), 0);
    const totalFinal = total - (desconto || 0);
    const r = await run('INSERT INTO vendas (descricao,valor_total,desconto,metodo_pagamento,status,operador_id,observacoes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [descricao || 'Venda', totalFinal, desconto || 0, metodo_pagamento, 'pago', req.user.id, observacoes]);
    const vendaId = r.rows[0].id;
    for (const item of (itens || [])) {
      await query('INSERT INTO itens_venda (venda_id,produto_id,descricao,quantidade,preco_unitario,subtotal) VALUES ($1,$2,$3,$4,$5,$6)',
        [vendaId, item.produto_id || null, item.descricao, item.quantidade, item.preco_unitario, item.quantidade * item.preco_unitario]);
      if (item.produto_id) {
        await query('UPDATE produtos SET estoque = estoque - $1 WHERE id=$2', [item.quantidade, item.produto_id]);
      }
    }
    const cfg = await get("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'");
    const sa = parseFloat(cfg?.valor || 0);
    const ns = sa + totalFinal;
    await query("UPDATE configuracoes SET valor=$1 WHERE chave='saldo_caixa'", [ns.toString()]);
    await query("INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior,operador_id) VALUES ('entrada','venda',$1,$2,'venda',$3,$4,$5,$6)",
      [descricao || 'Venda', totalFinal, vendaId, sa, ns, req.user.id]);
    res.json({ id: vendaId, total: totalFinal });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CONFIG ──
router.get('/config', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM configuracoes');
    const obj = {};
    rows.forEach(r => obj[r.chave] = r.valor);
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/config', async (req, res) => {
  try {
    for (const [k, v] of Object.entries(req.body)) {
      await query('INSERT INTO configuracoes (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor=$2, updated_at=NOW()', [k, v]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DASHBOARD ──
router.get('/dashboard', async (req, res) => {
  try {
    const cfg = await get("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'");
    const saldo = parseFloat(cfg?.valor || 0);
    const socios = parseInt((await get("SELECT COUNT(*) as c FROM socios WHERE status='ativo'")).c);
    const receitaMes = parseFloat((await get(`SELECT COALESCE(SUM(valor),0) as t FROM caixa WHERE tipo='entrada' AND DATE_TRUNC('month',data_movimentacao)=DATE_TRUNC('month',NOW())`)).t);
    const despesasMes = parseFloat((await get(`SELECT COALESCE(SUM(valor),0) as t FROM caixa WHERE tipo='saida' AND DATE_TRUNC('month',data_movimentacao)=DATE_TRUNC('month',NOW())`)).t);
    const contasVencer = parseInt((await get(`SELECT COUNT(*) as c FROM contas_pagar WHERE status='pendente' AND data_vencimento::date <= CURRENT_DATE + INTERVAL '7 days'`)).c);
    const eventosPróximos = parseInt((await get(`SELECT COUNT(*) as c FROM eventos WHERE status='ativo' AND data_evento >= CURRENT_DATE::text`)).c);
    const ingressosHoje = parseInt((await get(`SELECT COUNT(*) as c FROM ingressos WHERE status='pago' AND DATE(data_pagamento)=CURRENT_DATE`)).c);
    const ultimosMovimentos = await all('SELECT * FROM caixa ORDER BY data_movimentacao DESC LIMIT 5');
    const receitaAnual = [];
    const ano = new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
      const mes = m.toString().padStart(2, '0');
      const entrada = parseFloat((await get(`SELECT COALESCE(SUM(valor),0) as t FROM caixa WHERE tipo='entrada' AND TO_CHAR(data_movimentacao,'YYYY-MM')=$1`, [`${ano}-${mes}`])).t);
      const saida = parseFloat((await get(`SELECT COALESCE(SUM(valor),0) as t FROM caixa WHERE tipo='saida' AND TO_CHAR(data_movimentacao,'YYYY-MM')=$1`, [`${ano}-${mes}`])).t);
      receitaAnual.push({ mes, entrada, saida });
    }
    res.json({ saldo, socios, receitaMes, despesasMes, contasVencer, eventosPróximos, ingressosHoje, ultimosMovimentos, receitaAnual });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
