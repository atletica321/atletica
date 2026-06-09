const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeSchema } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check (antes das rotas normais)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/socios', require('./src/routes/socios'));
app.use('/api/eventos', require('./src/routes/eventos'));
app.use('/api/financeiro', require('./src/routes/financeiro'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não configurada. Adicione um banco PostgreSQL no Railway.');
    }
    console.log('🔌 Conectando ao banco...');
    await initializeSchema();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🏆 Atlética Sistema rodando na porta ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Erro ao iniciar:', err.message);
    process.exit(1);
  }
}

start();
