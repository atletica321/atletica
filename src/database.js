const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.PG_URL || process.env.DATABASE_URL;
    
    console.log('🔧 Configurando pool com URL:', connectionString.replace(/:\/\/.*@/, '://***@'));

    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 10,
      ssl: { rejectUnauthorized: false },
    });

    pool.on('error', (err) => {
      console.error('Pool error:', err.message);
    });
  }
  return pool;
}

async function query(sql, params = []) {
  try {
    return await getPool().query(sql, params);
  } catch (err) {
    console.error('Query error:', err.message, '\nSQL:', sql.slice(0, 120));
    throw err;
  }
}

async function get(sql, params = []) {
  const res = await query(sql, params);
  return res.rows[0] || null;
}

async function all(sql, params = []) {
  const res = await query(sql, params);
  return res.rows;
}

async function run(sql, params = []) {
  const res = await query(sql, params);
  return { rowCount: res.rowCount, rows: res.rows };
}

async function initializeSchema() {
  const bcrypt = require('bcryptjs');

  await query('SELECT 1');
  console.log('✅ Conexão OK');

  const tablesSql = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, nome TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL, cargo TEXT DEFAULT 'diretor', ativo INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS socios (
      id SERIAL PRIMARY KEY, nome TEXT NOT NULL, email TEXT, telefone TEXT,
      matricula TEXT, curso TEXT, plano TEXT DEFAULT 'mensal',
      valor_mensalidade NUMERIC DEFAULT 0, status TEXT DEFAULT 'ativo',
      data_inicio TEXT, data_fim TEXT, observacoes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS pagamentos_socios (
      id SERIAL PRIMARY KEY, socio_id INTEGER NOT NULL, valor NUMERIC NOT NULL,
      mes_referencia TEXT, ano_referencia INTEGER, status TEXT DEFAULT 'pendente',
      metodo_pagamento TEXT, data_vencimento TEXT, data_pagamento TIMESTAMPTZ,
      observacoes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS eventos (
      id SERIAL PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT, data_evento TEXT,
      local TEXT, capacidade INTEGER DEFAULT 0, valor_ingresso NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'ativo', imagem_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS lotes_ingresso (
      id SERIAL PRIMARY KEY, evento_id INTEGER NOT NULL, nome TEXT NOT NULL,
      quantidade INTEGER DEFAULT 0, valor NUMERIC DEFAULT 0,
      data_inicio TEXT, data_fim TEXT, status TEXT DEFAULT 'ativo'
    )`,
    `CREATE TABLE IF NOT EXISTS ingressos (
      id SERIAL PRIMARY KEY, codigo TEXT UNIQUE NOT NULL, evento_id INTEGER NOT NULL,
      lote_id INTEGER, nome_comprador TEXT NOT NULL, email_comprador TEXT,
      telefone_comprador TEXT, nome_portador TEXT, email_portador TEXT,
      valor NUMERIC NOT NULL, status TEXT DEFAULT 'pendente', metodo_pagamento TEXT,
      data_compra TIMESTAMPTZ DEFAULT NOW(), data_pagamento TIMESTAMPTZ,
      transferido INTEGER DEFAULT 0, historico_transferencias TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT, categoria TEXT,
      preco_custo NUMERIC DEFAULT 0, preco_venda NUMERIC DEFAULT 0,
      estoque INTEGER DEFAULT 0, estoque_minimo INTEGER DEFAULT 5, ativo INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS vendas (
      id SERIAL PRIMARY KEY, tipo TEXT DEFAULT 'produto', descricao TEXT,
      valor_total NUMERIC DEFAULT 0, desconto NUMERIC DEFAULT 0,
      metodo_pagamento TEXT, status TEXT DEFAULT 'pago', operador_id INTEGER,
      data_venda TIMESTAMPTZ DEFAULT NOW(), observacoes TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS itens_venda (
      id SERIAL PRIMARY KEY, venda_id INTEGER NOT NULL, produto_id INTEGER,
      descricao TEXT, quantidade INTEGER DEFAULT 1,
      preco_unitario NUMERIC DEFAULT 0, subtotal NUMERIC DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS contas_pagar (
      id SERIAL PRIMARY KEY, descricao TEXT NOT NULL, fornecedor TEXT, categoria TEXT,
      valor NUMERIC NOT NULL, data_vencimento TEXT NOT NULL, data_pagamento TIMESTAMPTZ,
      status TEXT DEFAULT 'pendente', metodo_pagamento TEXT, recorrente INTEGER DEFAULT 0,
      observacoes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS contas_receber (
      id SERIAL PRIMARY KEY, descricao TEXT NOT NULL, cliente TEXT, categoria TEXT,
      valor NUMERIC NOT NULL, data_vencimento TEXT NOT NULL, data_recebimento TIMESTAMPTZ,
      status TEXT DEFAULT 'pendente', metodo_pagamento TEXT, observacoes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS caixa (
      id SERIAL PRIMARY KEY, tipo TEXT NOT NULL, categoria TEXT, descricao TEXT NOT NULL,
      valor NUMERIC NOT NULL, referencia_tipo TEXT, referencia_id INTEGER,
      saldo_anterior NUMERIC DEFAULT 0, saldo_posterior NUMERIC DEFAULT 0,
      operador_id INTEGER, data_movimentacao TIMESTAMPTZ DEFAULT NOW(), observacoes TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY, valor TEXT, updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];

  for (const sql of tablesSql) {
    await query(sql);
  }
  console.log('✅ Tabelas OK');

  const admin = await get('SELECT id FROM users WHERE email = $1', ['admin@atletica.com']);
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    await query('INSERT INTO users (nome, email, senha, cargo) VALUES ($1,$2,$3,$4)',
      ['Administrador', 'admin@atletica.com', hash, 'admin']);
    console.log('✅ Admin criado: admin@atletica.com / admin123');
  } else {
    console.log('✅ Admin já existe');
  }

  for (const [k, v] of [
    ['nome_atletica', 'Atlética Universitária'],
    ['saldo_caixa', '0'],
    ['pix_chave', ''],
    ['pix_tipo', 'email'],
    ['cor_primaria', '#6c63ff'],
  ]) {
    await query('INSERT INTO configuracoes (chave,valor) VALUES ($1,$2) ON CONFLICT (chave) DO NOTHING', [k, v]);
  }

  console.log('🚀 Schema pronto!');
}

module.exports = { query, get, all, run, initializeSchema };
