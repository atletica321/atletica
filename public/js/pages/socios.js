async function renderSocios() {
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-primary" onclick="modalNovoSocio()">+ Novo Sócio</button>`;
  await loadSociosPage();
}

async function loadSociosPage(busca = '', status = '') {
  const params = new URLSearchParams();
  if (busca) params.set('busca', busca);
  if (status) params.set('status', status);
  const [socios, stats] = await Promise.all([
    API.get('/socios?' + params),
    API.get('/socios/stats')
  ]);

  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${stats.total}</div></div>
      <div class="stat-card green"><div class="stat-label">Ativos</div><div class="stat-value">${stats.ativos}</div></div>
      <div class="stat-card red"><div class="stat-label">Inativos</div><div class="stat-value">${stats.inativos}</div></div>
      <div class="stat-card green"><div class="stat-label">Receita do Mês</div><div class="stat-value">${fmt(stats.receitaMes)}</div></div>
      <div class="stat-card"><div class="stat-label">Receita do Ano</div><div class="stat-value">${fmt(stats.receitaAno)}</div></div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <input id="busca-socio" placeholder="🔍 Buscar por nome, email ou matrícula..." value="${busca}" oninput="loadSociosPage(this.value, document.getElementById('filtro-status-socio').value)">
        <select id="filtro-status-socio" onchange="loadSociosPage(document.getElementById('busca-socio').value, this.value)">
          <option value="">Todos os status</option>
          <option value="ativo" ${status==='ativo'?'selected':''}>Ativos</option>
          <option value="inativo" ${status==='inativo'?'selected':''}>Inativos</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="modalRelatorioSocios()">📊 Relatório</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>Matrícula</th><th>Curso</th><th>Plano</th><th>Mensalidade</th><th>Status</th><th>Início</th><th>Ações</th></tr></thead>
          <tbody>
            ${socios.map(s => `
              <tr>
                <td><strong>${s.nome}</strong><br><span style="font-size:12px;color:var(--text2)">${s.email || ''}</span></td>
                <td>${s.matricula || '-'}</td>
                <td>${s.curso || '-'}</td>
                <td><span class="badge badge-blue">${s.plano}</span></td>
                <td>${fmt(s.valor_mensalidade)}</td>
                <td>${statusBadge(s.status)}</td>
                <td>${fmtDate(s.data_inicio)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-ghost btn-sm" onclick="modalVerSocio(${s.id})">Ver</button>
                    <button class="btn btn-ghost btn-sm" onclick="modalEditarSocio(${s.id})">✏️</button>
                    <button class="btn btn-ghost btn-sm" onclick="confirmarExcluirSocio(${s.id},'${s.nome.replace(/'/g,"\\'")}')">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text3)">Nenhum sócio encontrado</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function modalNovoSocio(dados = {}) {
  openModal(dados.id ? 'Editar Sócio' : 'Novo Sócio', `
    <div class="form-row">
      <div class="form-group"><label>Nome *</label><input id="s-nome" value="${dados.nome||''}" placeholder="Nome completo"></div>
      <div class="form-group"><label>Matrícula</label><input id="s-matricula" value="${dados.matricula||''}" placeholder="12345678"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Email</label><input id="s-email" type="email" value="${dados.email||''}" placeholder="email@exemplo.com"></div>
      <div class="form-group"><label>Telefone</label><input id="s-tel" value="${dados.telefone||''}" placeholder="(11) 99999-9999"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Curso</label><input id="s-curso" value="${dados.curso||''}" placeholder="Engenharia, Direito..."></div>
      <div class="form-group"><label>Plano</label>
        <select id="s-plano">
          <option value="mensal" ${dados.plano==='mensal'?'selected':''}>Mensal</option>
          <option value="semestral" ${dados.plano==='semestral'?'selected':''}>Semestral</option>
          <option value="anual" ${dados.plano==='anual'?'selected':''}>Anual</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Valor Mensalidade (R$)</label><input id="s-valor" type="number" step="0.01" value="${dados.valor_mensalidade||''}" placeholder="0,00"></div>
      <div class="form-group"><label>Status</label>
        <select id="s-status">
          <option value="ativo" ${dados.status==='ativo'||!dados.id?'selected':''}>Ativo</option>
          <option value="inativo" ${dados.status==='inativo'?'selected':''}>Inativo</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Data Início</label><input id="s-inicio" type="date" value="${dados.data_inicio?.slice(0,10)||''}"></div>
      <div class="form-group"><label>Data Fim</label><input id="s-fim" type="date" value="${dados.data_fim?.slice(0,10)||''}"></div>
    </div>
    <div class="form-group"><label>Observações</label><textarea id="s-obs">${dados.observacoes||''}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarSocio(${dados.id||0})">Salvar</button>
    </div>
  `);
}

async function salvarSocio(id) {
  const body = {
    nome: document.getElementById('s-nome').value,
    matricula: document.getElementById('s-matricula').value,
    email: document.getElementById('s-email').value,
    telefone: document.getElementById('s-tel').value,
    curso: document.getElementById('s-curso').value,
    plano: document.getElementById('s-plano').value,
    valor_mensalidade: parseFloat(document.getElementById('s-valor').value) || 0,
    status: document.getElementById('s-status').value,
    data_inicio: document.getElementById('s-inicio').value,
    data_fim: document.getElementById('s-fim').value,
    observacoes: document.getElementById('s-obs').value
  };
  if (!body.nome) { toast('Nome é obrigatório', 'error'); return; }
  const res = id ? await API.put(`/socios/${id}`, body) : await API.post('/socios', body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast(id ? 'Sócio atualizado!' : 'Sócio criado!', 'success');
  closeForcedModal();
  await loadSociosPage();
}

async function modalEditarSocio(id) {
  const dados = await API.get(`/socios/${id}`);
  modalNovoSocio(dados);
}

async function modalVerSocio(id) {
  const dados = await API.get(`/socios/${id}`);
  const pags = dados.pagamentos || [];
  openModal(`Sócio: ${dados.nome}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div><span style="color:var(--text2);font-size:12px">Email</span><div>${dados.email || '-'}</div></div>
      <div><span style="color:var(--text2);font-size:12px">Telefone</span><div>${dados.telefone || '-'}</div></div>
      <div><span style="color:var(--text2);font-size:12px">Matrícula</span><div>${dados.matricula || '-'}</div></div>
      <div><span style="color:var(--text2);font-size:12px">Curso</span><div>${dados.curso || '-'}</div></div>
      <div><span style="color:var(--text2);font-size:12px">Plano</span><div>${dados.plano}</div></div>
      <div><span style="color:var(--text2);font-size:12px">Mensalidade</span><div>${fmt(dados.valor_mensalidade)}</div></div>
      <div><span style="color:var(--text2);font-size:12px">Status</span><div>${statusBadge(dados.status)}</div></div>
      <div><span style="color:var(--text2);font-size:12px">Início</span><div>${fmtDate(dados.data_inicio)}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <strong>Pagamentos</strong>
      <button class="btn btn-primary btn-sm" onclick="modalRegistrarPagamento(${dados.id})">+ Registrar Pagamento</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Mês/Ano</th><th>Valor</th><th>Status</th><th>Pagamento</th><th></th></tr></thead>
        <tbody>
          ${pags.map(p => `
            <tr>
              <td>${p.mes_referencia || '-'}/${p.ano_referencia || '-'}</td>
              <td>${fmt(p.valor)}</td>
              <td>${statusBadge(p.status)}</td>
              <td>${fmtDate(p.data_pagamento)}</td>
              <td>${p.status === 'pendente' ? `<button class="btn btn-success btn-sm" onclick="confirmarPagamentoSocio(${p.id})">✓ Pagar</button>` : ''}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:16px">Nenhum pagamento</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
}

function modalRegistrarPagamento(socioId) {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  openModal('Registrar Pagamento', `
    <div class="form-row">
      <div class="form-group"><label>Mês Referência</label>
        <select id="p-mes">
          ${MESES_FULL.map((m, i) => `<option value="${i+1}" ${i+1===mesAtual?'selected':''}>${m}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Ano</label><input id="p-ano" type="number" value="${anoAtual}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Valor (R$)</label><input id="p-valor" type="number" step="0.01" placeholder="0,00"></div>
      <div class="form-group"><label>Vencimento</label><input id="p-venc" type="date"></div>
    </div>
    <div class="form-group"><label>Observações</label><textarea id="p-obs"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarPagamentoSocio(${socioId})">Salvar</button>
    </div>
  `);
}

async function salvarPagamentoSocio(socioId) {
  const body = {
    valor: parseFloat(document.getElementById('p-valor').value),
    mes_referencia: document.getElementById('p-mes').value,
    ano_referencia: parseInt(document.getElementById('p-ano').value),
    data_vencimento: document.getElementById('p-venc').value,
    observacoes: document.getElementById('p-obs').value
  };
  const res = await API.post(`/socios/${socioId}/pagamentos`, body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Pagamento registrado!', 'success');
  closeForcedModal();
  modalVerSocio(socioId);
}

async function confirmarPagamentoSocio(pagId) {
  const res = await API.put(`/socios/pagamentos/${pagId}/pagar`, { metodo_pagamento: 'dinheiro' });
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Pagamento confirmado! Caixa atualizado.', 'success');
  closeForcedModal();
  await loadSociosPage();
}

function confirmarExcluirSocio(id, nome) {
  confirm(`Deseja remover o sócio "${nome}"?`, async () => {
    await API.del(`/socios/${id}`);
    toast('Sócio removido', 'info');
    await loadSociosPage();
  });
}

async function modalRelatorioSocios() {
  const ano = new Date().getFullYear();
  const rel = await API.get(`/socios/relatorio/receitas?ano=${ano}`);
  const totalAno = rel.porMes?.reduce((s, m) => s + m.total, 0) || 0;
  openModal(`📊 Relatório de Sócios ${ano}`, `
    <div style="margin-bottom:16px">
      <div class="stat-card green" style="margin-bottom:12px">
        <div class="stat-label">Total Arrecadado em ${ano}</div>
        <div class="stat-value">${fmt(totalAno)}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Mês</th><th>Quantidade</th><th>Total</th></tr></thead>
      <tbody>
        ${(rel.porMes || []).map(m => `
          <tr><td>${MESES_FULL[parseInt(m.mes)-1]}</td><td>${m.quantidade}</td><td>${fmt(m.total)}</td></tr>
        `).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text3)">Sem dados</td></tr>'}
      </tbody>
    </table>
  `);
}
