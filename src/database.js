const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/atletica.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  const database = db;

  // Users / Directors
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      cargo TEXT DEFAULT 'diretor',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Members (Socios)
  database.exec(`
    CREATE TABLE IF NOT EXISTS socios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT,
      telefone TEXT,
      matricula TEXT UNIQUE,
      curso TEXT,
      plano TEXT DEFAULT 'mensal',
      valor_mensalidade REAL DEFAULT 0,
      status TEXT DEFAULT 'ativo',
      data_inicio TEXT,
      data_fim TEXT,
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Pagamentos de socios
  database.exec(`
    CREATE TABLE IF NOT EXISTS pagamentos_socios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      socio_id INTEGER NOT NULL,
      valor REAL NOT NULL,
      mes_referencia TEXT,
      ano_referencia INTEGER,
      status TEXT DEFAULT 'pendente',
      metodo_pagamento TEXT,
      pix_txid TEXT,
      pix_qrcode TEXT,
      data_vencimento TEXT,
      data_pagamento TEXT,
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (socio_id) REFERENCES socios(id)
    );
  `);

  // Eventos / Festas
  database.exec(`
    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      data_evento TEXT,
      local TEXT,
      capacidade INTEGER DEFAULT 0,
      valor_ingresso REAL DEFAULT 0,
      status TEXT DEFAULT 'ativo',
      imagem_url TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Lotes de ingressos
  database.exec(`
    CREATE TABLE IF NOT EXISTS lotes_ingresso (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      quantidade INTEGER DEFAULT 0,
      valor REAL DEFAULT 0,
      data_inicio TEXT,
      data_fim TEXT,
      status TEXT DEFAULT 'ativo',
      FOREIGN KEY (evento_id) REFERENCES eventos(id)
    );
  `);

  // Ingressos
  database.exec(`
    CREATE TABLE IF NOT EXISTS ingressos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      evento_id INTEGER NOT NULL,
      lote_id INTEGER,
      nome_comprador TEXT NOT NULL,
      email_comprador TEXT,
      telefone_comprador TEXT,
      nome_portador TEXT,
      email_portador TEXT,
      valor REAL NOT NULL,
      status TEXT DEFAULT 'pendente',
      metodo_pagamento TEXT,
      pix_txid TEXT,
      pix_qrcode TEXT,
      data_compra TEXT DEFAULT (datetime('now','localtime')),
      data_pagamento TEXT,
      transferido INTEGER DEFAULT 0,
      historico_transferencias TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      FOREIGN KEY (lote_id) REFERENCES lotes_ingresso(id)
    );
  `);

  // Produtos (loja / bar)
  database.exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      categoria TEXT,
      preco_custo REAL DEFAULT 0,
      preco_venda REAL DEFAULT 0,
      estoque INTEGER DEFAULT 0,
      estoque_minimo INTEGER DEFAULT 5,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Vendas
  database.exec(`
    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT DEFAULT 'produto',
      descricao TEXT,
      valor_total REAL DEFAULT 0,
      desconto REAL DEFAULT 0,
      metodo_pagamento TEXT,
      status TEXT DEFAULT 'pendente',
      pix_txid TEXT,
      pix_qrcode TEXT,
      operador_id INTEGER,
      data_venda TEXT DEFAULT (datetime('now','localtime')),
      observacoes TEXT,
      FOREIGN KEY (operador_id) REFERENCES users(id)
    );
  `);

  // Itens de venda
  database.exec(`
    CREATE TABLE IF NOT EXISTS itens_venda (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      produto_id INTEGER,
      descricao TEXT,
      quantidade INTEGER DEFAULT 1,
      preco_unitario REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      FOREIGN KEY (venda_id) REFERENCES vendas(id),
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    );
  `);

  // Contas a pagar
  database.exec(`
    CREATE TABLE IF NOT EXISTS contas_pagar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descricao TEXT NOT NULL,
      fornecedor TEXT,
      categoria TEXT,
      valor REAL NOT NULL,
      data_vencimento TEXT NOT NULL,
      data_pagamento TEXT,
      status TEXT DEFAULT 'pendente',
      metodo_pagamento TEXT,
      comprovante TEXT,
      recorrente INTEGER DEFAULT 0,
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Contas a receber
  database.exec(`
    CREATE TABLE IF NOT EXISTS contas_receber (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descricao TEXT NOT NULL,
      cliente TEXT,
      categoria TEXT,
      valor REAL NOT NULL,
      data_vencimento TEXT NOT NULL,
      data_recebimento TEXT,
      status TEXT DEFAULT 'pendente',
      metodo_pagamento TEXT,
      pix_txid TEXT,
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Caixa - movimentações
  database.exec(`
    CREATE TABLE IF NOT EXISTS caixa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      categoria TEXT,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      referencia_tipo TEXT,
      referencia_id INTEGER,
      saldo_anterior REAL DEFAULT 0,
      saldo_posterior REAL DEFAULT 0,
      operador_id INTEGER,
      data_movimentacao TEXT DEFAULT (datetime('now','localtime')),
      observacoes TEXT,
      FOREIGN KEY (operador_id) REFERENCES users(id)
    );
  `);

  // Configurações
  database.exec(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Seed admin user if not exists
  const adminExists = database.prepare('SELECT id FROM users WHERE email = ?').get('admin@atletica.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    database.prepare(`
      INSERT INTO users (nome, email, senha, cargo) VALUES (?, ?, ?, ?)
    `).run('Administrador', 'admin@atletica.com', hash, 'admin');
  }

  // Seed config
  const configs = [
    ['nome_atletica', 'Atlética Universitária'],
    ['saldo_caixa', '0'],
    ['pix_chave', ''],
    ['pix_tipo', 'email'],
    ['cor_primaria', '#1a1a2e'],
  ];
  const insertConfig = database.prepare('INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)');
  configs.forEach(([k, v]) => insertConfig.run(k, v));
}

module.exports = { getDb };
