const express = require('express');
const router = express.Router();
const { get, all, run, query } = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { status, busca } = req.query;
    let sql = 'SELECT * FROM socios WHERE 1=1';
    const params = [];
    let i = 1;
    if (status) { sql += ` AND status = $${i++}`; params.push(status); }
    if (busca) { sql += ` AND (nome ILIKE $${i} OR email ILIKE $${i+1} OR matricula ILIKE $${i+2})`; params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`); i+=3; }
    sql += ' ORDER BY nome';
    res.json(await all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const total = (await get('SELECT COUNT(*) as c FROM socios')).c;
    const ativos = (await get("SELECT COUNT(*) as c FROM socios WHERE status='ativo'")).c;
    const inativos = (await get("SELECT COUNT(*) as c FROM socios WHERE status='inativo'")).c;
    const receitaMes = (await get(`SELECT COALESCE(SUM(valor),0) as total FROM pagamentos_socios WHERE status='pago' AND DATE_TRUNC('month',data_pagamento)=DATE_TRUNC('month',NOW())`)).total;
    const receitaAno = (await get(`SELECT COALESCE(SUM(valor),0) as total FROM pagamentos_socios WHERE status='pago' AND DATE_TRUNC('year',data_pagamento)=DATE_TRUNC('year',NOW())`)).total;
    const porPlano = await all("SELECT plano, COUNT(*) as count FROM socios WHERE status='ativo' GROUP BY plano");
    res.json({ total, ativos, inativos, receitaMes, receitaAno, porPlano });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/relatorio/receitas', async (req, res) => {
  try {
    const ano = req.query.ano || new Date().getFullYear();
    const porMes = await all(`SELECT EXTRACT(MONTH FROM data_pagamento)::int as mes, COALESCE(SUM(valor),0) as total, COUNT(*) as quantidade FROM pagamentos_socios WHERE status='pago' AND EXTRACT(YEAR FROM data_pagamento)=$1 GROUP BY mes ORDER BY mes`, [ano]);
    res.json({ ano, porMes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const socio = await get('SELECT * FROM socios WHERE id=$1', [req.params.id]);
    if (!socio) return res.status(404).json({ error: 'Sócio não encontrado' });
    const pagamentos = await all('SELECT * FROM pagamentos_socios WHERE socio_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...socio, pagamentos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { nome, email, telefone, matricula, curso, plano, valor_mensalidade, data_inicio, data_fim, observacoes } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
    const r = await run('INSERT INTO socios (nome,email,telefone,matricula,curso,plano,valor_mensalidade,data_inicio,data_fim,observacoes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      [nome, email, telefone, matricula, curso, plano || 'mensal', valor_mensalidade || 0, data_inicio, data_fim, observacoes]);
    res.json({ id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { nome, email, telefone, matricula, curso, plano, valor_mensalidade, status, data_inicio, data_fim, observacoes } = req.body;
    await query('UPDATE socios SET nome=$1,email=$2,telefone=$3,matricula=$4,curso=$5,plano=$6,valor_mensalidade=$7,status=$8,data_inicio=$9,data_fim=$10,observacoes=$11,updated_at=NOW() WHERE id=$12',
      [nome, email, telefone, matricula, curso, plano, valor_mensalidade, status, data_inicio, data_fim, observacoes, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM socios WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/pagamentos', async (req, res) => {
  try {
    const { valor, mes_referencia, ano_referencia, metodo_pagamento, data_vencimento, observacoes } = req.body;
    const r = await run('INSERT INTO pagamentos_socios (socio_id,valor,mes_referencia,ano_referencia,metodo_pagamento,data_vencimento,status,observacoes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [req.params.id, valor, mes_referencia, ano_referencia, metodo_pagamento, data_vencimento, 'pendente', observacoes]);
    res.json({ id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/pagamentos/:pagId/pagar', async (req, res) => {
  try {
    const { metodo_pagamento } = req.body;
    await query("UPDATE pagamentos_socios SET status='pago', metodo_pagamento=$1, data_pagamento=NOW() WHERE id=$2", [metodo_pagamento || 'dinheiro', req.params.pagId]);
    const pag = await get('SELECT * FROM pagamentos_socios WHERE id=$1', [req.params.pagId]);
    if (pag) {
      const cfg = await get("SELECT valor FROM configuracoes WHERE chave='saldo_caixa'");
      const saldoAtual = parseFloat(cfg?.valor || 0);
      const novoSaldo = saldoAtual + parseFloat(pag.valor);
      await query("UPDATE configuracoes SET valor=$1 WHERE chave='saldo_caixa'", [novoSaldo.toString()]);
      await query("INSERT INTO caixa (tipo,categoria,descricao,valor,referencia_tipo,referencia_id,saldo_anterior,saldo_posterior) VALUES ('entrada','mensalidade',$1,$2,'pagamento_socio',$3,$4,$5)",
        [`Mensalidade sócio #${pag.socio_id}`, pag.valor, pag.id, saldoAtual, novoSaldo]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
