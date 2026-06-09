// === USUÁRIOS ===
async function renderUsuarios() {
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-primary" onclick="modalNovoUsuario()">+ Novo Usuário</button>`;
  await loadUsuariosPage();
}

async function loadUsuariosPage() {
  const users = await API.get('/auth/users');
  document.getElementById('page-content').innerHTML = `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>Email</th><th>Cargo</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${u.nome[0].toUpperCase()}</div>
                    <strong>${u.nome}</strong>
                  </div>
                </td>
                <td>${u.email}</td>
                <td><span class="badge ${u.cargo==='admin'?'badge-blue':'badge-gray'}">${u.cargo === 'admin' ? '👑 Admin' : '🎯 Diretor'}</span></td>
                <td>${u.ativo ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-red">Inativo</span>'}</td>
                <td>${fmtDate(u.created_at)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-ghost btn-sm" onclick="modalEditarUsuario(${u.id},'${u.nome.replace(/'/g,"\\'")}','${u.email}','${u.cargo}',${u.ativo})">✏️ Editar</button>
                    ${u.id !== currentUser?.id ? `<button class="btn btn-ghost btn-sm" onclick="confirmarRemoverUsuario(${u.id},'${u.nome.replace(/'/g,"\\'")}')">🗑️</button>` : '<span style="font-size:12px;color:var(--text3);padding:6px 8px">Você</span>'}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function modalNovoUsuario() {
  openModal('Novo Usuário', `
    <div class="form-group"><label>Nome *</label><input id="u-nome" placeholder="Nome completo"></div>
    <div class="form-group"><label>Email *</label><input id="u-email" type="email" placeholder="email@atletica.com"></div>
    <div class="form-row">
      <div class="form-group"><label>Cargo</label>
        <select id="u-cargo">
          <option value="diretor">Diretor</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <div class="form-group"><label>Senha *</label><input id="u-senha" type="password" placeholder="Mínimo 6 caracteres"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarNovoUsuario()">Criar Usuário</button>
    </div>
  `);
}

async function salvarNovoUsuario() {
  const body = {
    nome: document.getElementById('u-nome').value,
    email: document.getElementById('u-email').value,
    cargo: document.getElementById('u-cargo').value,
    senha: document.getElementById('u-senha').value
  };
  if (!body.nome || !body.email || !body.senha) { toast('Preencha todos os campos', 'error'); return; }
  const res = await API.post('/auth/users', body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Usuário criado!', 'success');
  closeForcedModal();
  await loadUsuariosPage();
}

function modalEditarUsuario(id, nome, email, cargo, ativo) {
  openModal('Editar Usuário', `
    <div class="form-group"><label>Nome *</label><input id="ue-nome" value="${nome}"></div>
    <div class="form-group"><label>Email *</label><input id="ue-email" value="${email}"></div>
    <div class="form-row">
      <div class="form-group"><label>Cargo</label>
        <select id="ue-cargo">
          <option value="diretor" ${cargo==='diretor'?'selected':''}>Diretor</option>
          <option value="admin" ${cargo==='admin'?'selected':''}>Administrador</option>
        </select>
      </div>
      <div class="form-group"><label>Status</label>
        <select id="ue-ativo">
          <option value="1" ${ativo?'selected':''}>Ativo</option>
          <option value="0" ${!ativo?'selected':''}>Inativo</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label>Nova Senha <span style="color:var(--text3)">(deixe em branco para manter)</span></label>
      <input id="ue-senha" type="password" placeholder="Nova senha...">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEdicaoUsuario(${id})">Salvar</button>
    </div>
  `);
}

async function salvarEdicaoUsuario(id) {
  const body = {
    nome: document.getElementById('ue-nome').value,
    email: document.getElementById('ue-email').value,
    cargo: document.getElementById('ue-cargo').value,
    ativo: parseInt(document.getElementById('ue-ativo').value),
    senha: document.getElementById('ue-senha').value || undefined
  };
  const res = await API.put(`/auth/users/${id}`, body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Usuário atualizado!', 'success');
  closeForcedModal();
  await loadUsuariosPage();
}

function confirmarRemoverUsuario(id, nome) {
  confirm(`Desativar o usuário "${nome}"?`, async () => {
    const res = await API.del(`/auth/users/${id}`);
    if (res.error) { toast(res.error, 'error'); return; }
    toast('Usuário removido', 'info');
    await loadUsuariosPage();
  });
}

// === CONFIGURAÇÕES ===
async function renderConfiguracoes() {
  document.getElementById('topbar-actions').innerHTML = '';
  const cfg = await API.get('/financeiro/config');
  document.getElementById('page-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px" class="cfg-grid">
      <div class="card">
        <div class="card-header"><span class="card-title">⚡ Dados da Atlética</span></div>
        <div class="form-group"><label>Nome da Atlética</label><input id="cfg-nome" value="${cfg.nome_atletica||''}"></div>
        <div class="form-group"><label>Cor Principal</label><input id="cfg-cor" type="color" value="${cfg.cor_primaria||'#6c63ff'}"></div>
        <button class="btn btn-primary" onclick="salvarConfig()">Salvar</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">💳 Configuração PIX</span></div>
        <div class="form-group"><label>Tipo de Chave PIX</label>
          <select id="cfg-pix-tipo">
            <option value="email" ${cfg.pix_tipo==='email'?'selected':''}>Email</option>
            <option value="cpf" ${cfg.pix_tipo==='cpf'?'selected':''}>CPF</option>
            <option value="cnpj" ${cfg.pix_tipo==='cnpj'?'selected':''}>CNPJ</option>
            <option value="telefone" ${cfg.pix_tipo==='telefone'?'selected':''}>Telefone</option>
            <option value="aleatoria" ${cfg.pix_tipo==='aleatoria'?'selected':''}>Chave Aleatória</option>
          </select>
        </div>
        <div class="form-group"><label>Chave PIX</label><input id="cfg-pix" value="${cfg.pix_chave||''}" placeholder="Sua chave PIX"></div>
        <div class="form-group"><label>Nome do Recebedor</label><input id="cfg-pix-nome" value="${cfg.pix_nome||''}" placeholder="Nome que aparece no PIX"></div>
        <div class="form-group"><label>Cidade</label><input id="cfg-pix-cidade" value="${cfg.pix_cidade||''}" placeholder="São Paulo"></div>
        <button class="btn btn-primary" onclick="salvarConfigPix()">Salvar PIX</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🔒 Alterar Minha Senha</span></div>
        <div class="form-group"><label>Senha Atual</label><input id="cfg-senha-atual" type="password"></div>
        <div class="form-group"><label>Nova Senha</label><input id="cfg-nova-senha" type="password"></div>
        <div class="form-group"><label>Confirmar Nova Senha</label><input id="cfg-conf-senha" type="password"></div>
        <button class="btn btn-primary" onclick="alterarSenha()">Alterar Senha</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">ℹ️ Sobre o Sistema</span></div>
        <p style="color:var(--text2);line-height:1.6;margin-bottom:12px">
          Sistema completo de gestão para atléticas universitárias.<br>
          Versão 1.0.0
        </p>
        <div style="font-size:13px;color:var(--text3)">
          <div>🔐 Login: admin@atletica.com</div>
          <div>🔑 Senha padrão: admin123</div>
          <div style="margin-top:8px;color:var(--yellow)">⚠️ Altere a senha padrão após o primeiro acesso!</div>
        </div>
      </div>
    </div>
  `;
  if (window.innerWidth < 768) {
    document.querySelector('.cfg-grid').style.gridTemplateColumns = '1fr';
  }
}

async function salvarConfig() {
  const body = {
    nome_atletica: document.getElementById('cfg-nome').value,
    cor_primaria: document.getElementById('cfg-cor').value,
  };
  const res = await API.put('/financeiro/config', body);
  if (res.error) { toast(res.error, 'error'); return; }
  document.getElementById('atletica-nome').textContent = body.nome_atletica;
  document.title = body.nome_atletica + ' — Gestão';
  toast('Configurações salvas!', 'success');
}

async function salvarConfigPix() {
  const body = {
    pix_tipo: document.getElementById('cfg-pix-tipo').value,
    pix_chave: document.getElementById('cfg-pix').value,
    pix_nome: document.getElementById('cfg-pix-nome').value,
    pix_cidade: document.getElementById('cfg-pix-cidade').value,
  };
  const res = await API.put('/financeiro/config', body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Configuração PIX salva!', 'success');
}

async function alterarSenha() {
  const atual = document.getElementById('cfg-senha-atual').value;
  const nova = document.getElementById('cfg-nova-senha').value;
  const conf = document.getElementById('cfg-conf-senha').value;
  if (!atual || !nova) { toast('Preencha todos os campos', 'error'); return; }
  if (nova !== conf) { toast('As senhas não conferem', 'error'); return; }
  if (nova.length < 6) { toast('Senha deve ter ao menos 6 caracteres', 'error'); return; }
  const res = await API.put('/auth/change-password', { senha_atual: atual, nova_senha: nova });
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Senha alterada com sucesso!', 'success');
  document.getElementById('cfg-senha-atual').value = '';
  document.getElementById('cfg-nova-senha').value = '';
  document.getElementById('cfg-conf-senha').value = '';
}
