const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB on startup
getDb();

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/socios', require('./src/routes/socios'));
app.use('/api/eventos', require('./src/routes/eventos'));
app.use('/api/financeiro', require('./src/routes/financeiro'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🏆 Atlética Sistema rodando na porta ${PORT}`);
});
