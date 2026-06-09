const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check — responde imediatamente, sem depender do banco
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth',       require('./src/routes/auth'));
app.use('/api/socios',     require('./src/routes/socios'));
app.use('/api/eventos',    require('./src/routes/eventos'));
app.use('/api/financeiro', require('./src/routes/financeiro'));

app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

async function connectWithRetry(maxTentativas = 15, intervaloMs = 4000) {
  const { initializeSchema } = require('./src/database');
  for (let i = 1; i <= maxTentativas; i++) {
    try {
      console.log(`🔌 Conectando ao PostgreSQL (tentativa ${i}/${maxTentativas})...`);
      await initializeSchema();
      return; // sucesso
    } catch (err) {
      console.error(`⚠️  Tentativa ${i} falhou: ${err.message}`);
      if (i === maxTentativas) {
        console.error('❌ Não foi possível conectar ao banco. Encerrando.');
        process.exit(1);
      }
      console.log(`   Aguardando ${intervaloMs / 1000}s antes de tentar novamente...`);
      await new Promise(r => setTimeout(r, intervaloMs));
    }
  }
}

async function start() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não definida.');
    console.error('   Railway: adicione o serviço PostgreSQL e vincule DATABASE_URL nas variáveis do serviço Node.');
    process.exit(1);
  }

  console.log(`🏆 Iniciando servidor na porta ${PORT}...`);
  console.log(`🔗 DATABASE_URL: ${process.env.DATABASE_URL.replace(/:\/\/.*@/, '://***@')}`);

  // 1. Sobe HTTP primeiro (healthcheck já funciona)
  await new Promise((resolve) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ HTTP ouvindo na porta ${PORT}`);
      resolve();
    });
  });

  // 2. Conecta ao banco com retry
  await connectWithRetry();

  console.log('🚀 Sistema completamente pronto!');
}

start();
