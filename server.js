const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check simples — responde antes mesmo do banco estar pronto
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

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
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não definida.');
    console.error('   No Railway: adicione o serviço PostgreSQL e referencie DATABASE_URL nas variáveis.');
    process.exit(1);
  }

  // Sobe o HTTP primeiro — healthcheck já responde
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏆 Servidor HTTP na porta ${PORT}`);
  });

  // Inicializa banco em paralelo (com retry)
  let tentativas = 0;
  while (tentativas < 10) {
    try {
      const { initializeSchema } = require('./src/database');
      console.log(`🔌 Conectando ao banco (tentativa ${tentativas + 1})...`);
      await initializeSchema();
      console.log('✅ Banco pronto!');
      break;
    } catch (err) {
      tentativas++;
      console.error(`⚠️  Erro no banco (tentativa ${tentativas}): ${err.message}`);
      if (tentativas >= 10) {
        console.error('❌ Não foi possível conectar ao banco após 10 tentativas.');
        process.exit(1);
      }
      // Espera 3s antes de tentar novamente
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

start();
