# ⚡ Atlética — Sistema de Gestão

## Deploy no Railway (passo a passo)

### 1. Criar o projeto no Railway

1. Acesse [railway.app](https://railway.app) e crie um projeto novo
2. Clique em **"Add Service" → "Database" → "PostgreSQL"**
3. Clique em **"Add Service" → "GitHub Repo"** (ou "Empty Service")

### 2. Subir o código

```bash
# Na pasta do projeto:
git init
git add .
git commit -m "deploy"

npm install -g @railway/cli
railway login
railway link   # selecione o projeto criado
railway up
```

### 3. Configurar variável de ambiente

No painel do Railway, no seu serviço Node.js:
- Vá em **Variables**
- Clique em **"Add Variable Reference"** e selecione `DATABASE_URL` do serviço PostgreSQL
- Adicione também:
  ```
  JWT_SECRET=uma-chave-secreta-forte-aqui
  NODE_ENV=production
  ```

### 4. Acessar o sistema

Após o deploy, o Railway fornecerá uma URL pública.

- **Email:** `admin@atletica.com`
- **Senha:** `admin123`

> ⚠️ Troque a senha padrão imediatamente em **Configurações**!

---

## Funcionalidades

- 📊 Dashboard com gráfico anual
- 👥 Sócios + mensalidades + relatórios
- 🎟️ Eventos, lotes de ingressos, transferência de ingresso
- 💰 Caixa completo com histórico
- 📋 Contas a pagar e receber
- 🛒 Produtos, estoque e PDV
- 🔐 Gestão de usuários (admin)
- ⚙️ Configurações (PIX, nome, senha)

## Stack
- **Backend:** Node.js + Express
- **Banco:** PostgreSQL (Railway)
- **Frontend:** HTML/CSS/JS vanilla (SPA)
- **Auth:** JWT
