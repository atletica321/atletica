# ⚡ Atlética — Sistema de Gestão

Sistema completo para gestão de atléticas universitárias.

## Funcionalidades

- **Dashboard** — Visão geral financeira com gráficos
- **Sócios** — Cadastro, mensalidades, relatórios de receita anual/mensal
- **Eventos & Ingressos** — Festas, lotes, venda e transferência de ingressos
- **Caixa** — Controle completo com histórico de movimentações
- **Contas a Pagar/Receber** — Gestão financeira completa
- **Produtos & Vendas** — Controle de estoque e PDV
- **Usuários** — Criação e gerenciamento de diretores (admin only)
- **Configurações** — PIX, nome da atlética, senha

## Deploy no Railway

### Pré-requisitos
- Conta no [Railway](https://railway.app)
- Git instalado

### Passo a passo

```bash
# 1. Inicialize git
git init
git add .
git commit -m "initial commit"

# 2. Instale a CLI do Railway
npm install -g @railway/cli

# 3. Login e deploy
railway login
railway init
railway up
```

### Variáveis de ambiente (opcionais)
No dashboard do Railway, em "Variables":
```
JWT_SECRET=sua-chave-secreta-muito-segura-aqui
DB_PATH=/app/data/atletica.db
```

### Volume persistente
O Railway cria automaticamente o volume `/app/data` para o banco SQLite.

## Acesso inicial

- **URL**: fornecida pelo Railway após o deploy
- **Email**: `admin@atletica.com`
- **Senha**: `admin123`

⚠️ **Troque a senha padrão imediatamente após o primeiro acesso em Configurações!**

## Desenvolvimento local

```bash
npm install
npm start
# Acesse: http://localhost:3000
```

## Stack
- **Backend**: Node.js + Express
- **Banco**: SQLite (better-sqlite3)
- **Frontend**: HTML/CSS/JS vanilla
- **Auth**: JWT
