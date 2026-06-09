const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth',       require('./src/routes/auth'));
app.use('/api/socios',     require('./src/routes/socios'));
app.use('/api/eventos',    require('./src/routes/eventos'));
app.use('/api/financeiro', require('./src/routes/financeiro'));

app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

async function start() {
  // Aceita PG_URL (manual) ou DATABASE_URL (referência Railway)
  const dbUrl = process.env.PG_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ Nenhuma variável de banco encontrada.');
    console.error('   Crie PG_URL ou DATABASE_URL no Railway com a connection string do PostgreSQL.');
    process.exit(1);
  }

  try {
    const u = new URL(dbUrl);
    console.log(`🔗 Banco: ${u.hostname}:${u.port} | user: ${u.username} | db: ${u.pathname.slice(1)}`);
  } catch(e) {}

  // HTTP primeiro — healthcheck já responde
  await new Promise(resolve =>
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ HTTP na porta ${PORT}`);
      resolve();
    })
  );

  // Banco com retry
  const { initializeSchema } = require('./src/database');
  for (let i = 1; i <= 15; i++) {
    try {
      console.log(`🔌 Tentativa ${i}/15...`);
      await initializeSchema();
      console.log('🎉 Sistema pronto!');
      return;
    } catch (err) {
      console.error(`⚠️  Tentativa ${i} falhou: ${err.message}`);
      if (i === 15) { console.error('❌ Falha definitiva.'); process.exit(1); }
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

start();
