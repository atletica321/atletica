let currentUser = null;

async function doLogin() {
  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-senha').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!email || !senha) { errEl.textContent = 'Preencha email e senha'; errEl.style.display = 'block'; return; }
  const data = await API.post('/auth/login', { email, senha });
  if (data.error) { errEl.textContent = data.error; errEl.style.display = 'block'; return; }
  localStorage.setItem('token', data.token);
  currentUser = data.user;
  initApp();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') doLogin();
});

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

async function initApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  const me = await API.get('/auth/me');
  if (!me || me.error) { logout(); return; }
  currentUser = me;

  document.getElementById('user-name').textContent = me.nome;
  document.getElementById('user-role').textContent = me.cargo === 'admin' ? 'Administrador' : 'Diretor';
  document.getElementById('user-avatar').textContent = me.nome[0].toUpperCase();

  // Load atletica name
  const cfg = await API.get('/financeiro/config');
  if (cfg?.nome_atletica) {
    document.getElementById('atletica-nome').textContent = cfg.nome_atletica;
    document.title = cfg.nome_atletica + ' — Gestão';
  }

  // Hide user management for non-admins
  if (me.cargo !== 'admin') {
    document.getElementById('nav-usuarios').style.display = 'none';
  }

  navigate('dashboard');
}

function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const titles = {
    dashboard: 'Dashboard', socios: 'Sócios', eventos: 'Eventos & Ingressos',
    caixa: 'Caixa', contas: 'Contas', produtos: 'Produtos & Vendas',
    usuarios: 'Usuários', configuracoes: 'Configurações'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  document.getElementById('topbar-actions').innerHTML = '';

  const pages = { dashboard: renderDashboard, socios: renderSocios, eventos: renderEventos, caixa: renderCaixa, contas: renderContas, produtos: renderProdutos, usuarios: renderUsuarios, configuracoes: renderConfiguracoes };
  if (pages[page]) pages[page]();

  // Close sidebar on mobile
  if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Check existing session on load
window.addEventListener('load', () => {
  const token = localStorage.getItem('token');
  if (token) {
    initApp();
  }
});
