const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

// Helper: run a query
async function query(sql, params = []) {
  const client = getPool();
  const res = await client.query(sql, params);
  return res;
}

// Helper: get single row
async function get(sql, params = []) {
  const res = await query(sql, params);
  return res.rows[0] || null;
}

// Helper: get all rows
async function all(sql, params = []) {
  const res = await query(sql, params);
  return res.rows;
}

// Helper: run insert/update/delete, returns rowCount and insertId
async function run(sql, params = []) {
  const res = await query(sql, params);
  return { rowCount: res.rowCount, rows: res.rows };
}

async function initializeSchema() {
  const bcrypt = require('bcryptjs');

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      cargo TEXT DEFAULT 'diretor',
      ativo INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS socios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT,
      telefone TEXT,
      matricula TEXT UNIQUE,
      curso TEXT,
      plano TEXT DEFAULT 'mensal',
      valor_mensalidade NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'ativo',
      data_inicio TEXT,
      data_fim TEXT,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pagamentos_socios (
      id SERIAL PRIMARY KEY,
      socio_id INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
      valor NUMERIC NOT NULL,
      mes_referencia TEXT,
      ano_referencia INTEGER,
      status TEXT DEFAULT 'pendente',
      metodo_pagamento TEXT,
      data_vencimento TEXT,
      data_pagamento TIMESTAMP,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS eventos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      data_evento TEXT,
      local TEXT,
      capacidade INTEGER DEFAULT 0,
      valor_ingresso NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'ativo',
      imagem_url TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lotes_ingresso (
      id SERIAL PRIMARY KEY,
      evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      quantidade INTEGER DEFAULT 0,
      valor NUMERIC DEFAULT 0,
      data_inicio TEXT,
      data_fim TEXT,
      status TEXT DEFAULT 'ativo'
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ingressos (
      id SERIAL PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      evento_id INTEGER NOT NULL REFERENCES eventos(id),
      lote_id INTEGER REFERENCES lotes_ingresso(id),
      nome_comprador TEXT NOT NULL,
      email_comprador TEXT,
      telefone_comprador TEXT,
      nome_portador TEXT,
      email_portador TEXT,
      valor NUMERIC NOT NULL,
      status TEXT DEFAULT 'pendente',
      metodo_pagamento TEXT,
      data_compra TIMESTAMP DEFAULT NOW(),
      data_pagamento TIMESTAMP,
      transferido INTEGER DEFAULT 0,
      historico_transferencias TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      categoria TEXT,
      preco_custo NUMERIC DEFAULT 0,
      preco_venda NUMERIC DEFAULT 0,
      estoque INTEGER DEFAULT 0,
      estoque_minimo INTEGER DEFAULT 5,
      ativo INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vendas (
      id SERIAL PRIMARY KEY,
      tipo TEXT DEFAULT 'produto',
      descricao TEXT,
      valor_total NUMERIC DEFAULT 0,
      desconto NUMERIC DEFAULT 0,
      metodo_pagamento TEXT,
      status TEXT DEFAULT 'pago',
      operador_id INTEGER REFERENCES users(id),
      data_venda TIMESTAMP DEFAULT NOW(),
      observacoes TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS itens_venda (
      id SERIAL PRIMARY KEY,
      venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id),
      descricao TEXT,
      quantidade INTEGER DEFAULT 1,
      preco_unitario NUMERIC DEFAULT 0,
      subtotal NUMERIC DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS contas_pagar (
      id SERIAL PRIMARY KEY,
      descricao TEXT NOT NULL,
      fornecedor TEXT,
      categoria TEXT,
      valor NUMERIC NOT NULL,
      data_vencimento TEXT NOT NULL,
      data_pagamento TIMESTAMP,
      status TEXT DEFAULT 'pendente',
      metodo_pagamento TEXT,
      recorrente INTEGER DEFAULT 0,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS contas_receber (
      id SERIAL PRIMARY KEY,
      descricao TEXT NOT NULL,
      cliente TEXT,
      categoria TEXT,
      valor NUMERIC NOT NULL,
      data_vencimento TEXT NOT NULL,
      data_recebimento TIMESTAMP,
      status TEXT DEFAULT 'pendente',
      metodo_pagamento TEXT,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS caixa (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL,
      categoria TEXT,
      descricao TEXT NOT NULL,
      valor NUMERIC NOT NULL,
      referencia_tipo TEXT,
      referencia_id INTEGER,
      saldo_anterior NUMERIC DEFAULT 0,
      saldo_posterior NUMERIC DEFAULT 0,
      operador_id INTEGER REFERENCES users(id),
      data_movimentacao TIMESTAMP DEFAULT NOW(),
      observacoes TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Seed admin
  const admin = await get('SELECT id FROM users WHERE email = $1', ['admin@atletica.com']);
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    await query('INSERT INTO users (nome, email, senha, cargo) VALUES ($1, $2, $3, $4)',
      ['Administrador', 'admin@atletica.com', hash, 'admin']);
  }

  // Seed configs
  const configs = [
    ['nome_atletica', 'Atlética Universitária'],
    ['saldo_caixa', '0'],
    ['pix_chave', ''],
    ['pix_tipo', 'email'],
    ['cor_primaria', '#6c63ff'],
  ];
  for (const [k, v] of configs) {
    await query('INSERT INTO configuracoes (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO NOTHING', [k, v]);
  }

  console.log('✅ Schema inicializado');
}

module.exports = { query, get, all, run, initializeSchema };
