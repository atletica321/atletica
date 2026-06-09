async function renderContas() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-danger" onclick="modalNovaContaPagar()">+ Conta a Pagar</button>
    <button class="btn btn-success" onclick="modalNovaContaReceber()">+ Conta a Receber</button>
  `;
  await loadContasPage();
}

async function loadContasPage(tab = 'pagar') {
  window._contasTab = tab;
  const [pagar, receber] = await Promise.all([
    API.get('/financeiro/pagar'),
    API.get('/financeiro/receber')
  ]);

  const totalPagar = pagar.filter(c => c.status === 'pendente').reduce((s, c) => s + c.valor, 0);
  const totalReceber = receber.filter(c => c.status === 'pendente').reduce((s, c) => s + c.valor, 0);
  const vencidas = pagar.filter(c => c.status === 'pendente' && c.data_vencimento < new Date().toISOString().slice(0,10)).length;

  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <div class="stat-card red">
        <div class="stat-label">Total a Pagar</div>
        <div class="stat-value">${fmt(totalPagar)}</div>
        <div class="stat-sub">${pagar.filter(c=>c.status==='pendente').length} contas pendentes</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Total a Receber</div>
        <div class="stat-value">${fmt(totalReceber)}</div>
        <div class="stat-sub">${receber.filter(c=>c.status==='pendente').length} contas pendentes</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-label">Contas Vencidas</div>
        <div class="stat-value">${vencidas}</div>
        <div class="stat-sub">A pagar em atraso</div>
      </div>
      <div class="stat-card ${totalReceber - totalPagar >= 0 ? 'green' : 'red'}">
        <div class="stat-label">Saldo Previsto</div>
        <div class="stat-value">${fmt(totalReceber - totalPagar)}</div>
        <div class="stat-sub">Receber - Pagar</div>
      </div>
    </div>

    <div class="tabs">
      <div class="tab ${tab==='pagar'?'active':''}" onclick="loadContasPage('pagar')">Contas a Pagar (${pagar.filter(c=>c.status==='pendente').length})</div>
      <div class="tab ${tab==='receber'?'active':''}" onclick="loadContasPage('receber')">Contas a Receber (${receber.filter(c=>c.status==='pendente').length})</div>
    </div>

    ${tab === 'pagar' ? renderTabelaPagar(pagar) : renderTabelaReceber(receber)}
  `;
}

function renderTabelaPagar(contas) {
  const hoje = new Date().toISOString().slice(0,10);
  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Descrição</th><th>Fornecedor</th><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${contas.map(c => `
              <tr style="${c.status==='pendente' && c.data_vencimento < hoje ? 'background:rgba(255,107,107,0.05)' : ''}">
                <td><strong>${c.descricao}</strong>${c.recorrente ? ' <span class="badge badge-blue" style="font-size:10px">Recorrente</span>' : ''}</td>
                <td>${c.fornecedor || '-'}</td>
                <td>${c.categoria || '-'}</td>
                <td style="font-weight:600;color:var(--red)">${fmt(c.valor)}</td>
                <td style="${c.status==='pendente' && c.data_vencimento < hoje ? 'color:var(--red);font-weight:600' : ''}">${fmtDate(c.data_vencimento)}</td>
                <td>${statusBadge(c.status)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    ${c.status==='pendente' ? `<button class="btn btn-success btn-sm" onclick="pagarConta(${c.id},'pagar')">✓ Pagar</button>` : ''}
                    <button class="btn btn-ghost btn-sm" onclick="editarContaPagar(${c.id})">✏️</button>
                    <button class="btn btn-ghost btn-sm" onclick="excluirConta(${c.id},'pagar','${c.descricao.replace(/'/g,"\\'")}')">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">Nenhuma conta</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTabelaReceber(contas) {
  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Descrição</th><th>Cliente</th><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${contas.map(c => `
              <tr>
                <td><strong>${c.descricao}</strong></td>
                <td>${c.cliente || '-'}</td>
                <td>${c.categoria || '-'}</td>
                <td style="font-weight:600;color:var(--green)">${fmt(c.valor)}</td>
                <td>${fmtDate(c.data_vencimento)}</td>
                <td>${statusBadge(c.status)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    ${c.status==='pendente' ? `<button class="btn btn-success btn-sm" onclick="receberConta(${c.id})">✓ Receber</button>` : ''}
                    <button class="btn btn-ghost btn-sm" onclick="excluirConta(${c.id},'receber','${c.descricao.replace(/'/g,"\\'")}')">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">Nenhuma conta</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function modalNovaContaPagar(dados = {}) {
  openModal(dados.id ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar', `
    <div class="form-group"><label>Descrição *</label><input id="cp-desc" value="${dados.descricao||''}" placeholder="Ex: Aluguel da sede"></div>
    <div class="form-row">
      <div class="form-group"><label>Fornecedor</label><input id="cp-forn" value="${dados.fornecedor||''}" placeholder="Nome do fornecedor"></div>
      <div class="form-group"><label>Categoria</label>
        <select id="cp-cat">
          <option value="">Sem categoria</option>
          <option value="aluguel" ${dados.categoria==='aluguel'?'selected':''}>Aluguel</option>
          <option value="fornecedor" ${dados.categoria==='fornecedor'?'selected':''}>Fornecedor</option>
          <option value="servicos" ${dados.categoria==='servicos'?'selected':''}>Serviços</option>
          <option value="marketing" ${dados.categoria==='marketing'?'selected':''}>Marketing</option>
          <option value="equipamentos" ${dados.categoria==='equipamentos'?'selected':''}>Equipamentos</option>
          <option value="outros" ${dados.categoria==='outros'?'selected':''}>Outros</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Valor (R$) *</label><input id="cp-valor" type="number" step="0.01" value="${dados.valor||''}" placeholder="0,00"></div>
      <div class="form-group"><label>Vencimento *</label><input id="cp-venc" type="date" value="${dados.data_vencimento?.slice(0,10)||''}"></div>
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="cp-rec" ${dados.recorrente?'checked':''}> <label for="cp-rec">Conta recorrente mensal</label>
    </div>
    <div class="form-group"><label>Observações</label><textarea id="cp-obs">${dados.observacoes||''}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarContaPagar(${dados.id||0})">Salvar</button>
    </div>
  `);
}

async function salvarContaPagar(id) {
  const body = {
    descricao: document.getElementById('cp-desc').value,
    fornecedor: document.getElementById('cp-forn').value,
    categoria: document.getElementById('cp-cat').value,
    valor: parseFloat(document.getElementById('cp-valor').value),
    data_vencimento: document.getElementById('cp-venc').value,
    recorrente: document.getElementById('cp-rec').checked,
    observacoes: document.getElementById('cp-obs').value,
    status: 'pendente'
  };
  if (!body.descricao || !body.valor || !body.data_vencimento) { toast('Preencha os campos obrigatórios', 'error'); return; }
  const res = id ? await API.put(`/financeiro/pagar/${id}`, body) : await API.post('/financeiro/pagar', body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Conta salva!', 'success');
  closeForcedModal();
  await loadContasPage('pagar');
}

async function editarContaPagar(id) {
  const contas = await API.get('/financeiro/pagar');
  const conta = contas.find(c => c.id === id);
  if (conta) modalNovaContaPagar(conta);
}

function modalNovaContaReceber(dados = {}) {
  openModal('Nova Conta a Receber', `
    <div class="form-group"><label>Descrição *</label><input id="cr-desc" value="${dados.descricao||''}" placeholder="Ex: Patrocínio empresa X"></div>
    <div class="form-row">
      <div class="form-group"><label>Cliente</label><input id="cr-cli" value="${dados.cliente||''}" placeholder="Nome do cliente"></div>
      <div class="form-group"><label>Categoria</label>
        <select id="cr-cat">
          <option value="">Sem categoria</option>
          <option value="patrocinio">Patrocínio</option>
          <option value="doacao">Doação</option>
          <option value="servicos">Serviços</option>
          <option value="outros">Outros</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Valor (R$) *</label><input id="cr-valor" type="number" step="0.01" placeholder="0,00"></div>
      <div class="form-group"><label>Vencimento *</label><input id="cr-venc" type="date"></div>
    </div>
    <div class="form-group"><label>Observações</label><textarea id="cr-obs"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarContaReceber()">Salvar</button>
    </div>
  `);
}

async function salvarContaReceber() {
  const body = {
    descricao: document.getElementById('cr-desc').value,
    cliente: document.getElementById('cr-cli').value,
    categoria: document.getElementById('cr-cat').value,
    valor: parseFloat(document.getElementById('cr-valor').value),
    data_vencimento: document.getElementById('cr-venc').value,
    observacoes: document.getElementById('cr-obs').value
  };
  if (!body.descricao || !body.valor || !body.data_vencimento) { toast('Preencha os campos obrigatórios', 'error'); return; }
  const res = await API.post('/financeiro/receber', body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Conta registrada!', 'success');
  closeForcedModal();
  await loadContasPage('receber');
}

async function pagarConta(id) {
  const res = await API.put(`/financeiro/pagar/${id}/pagar`, { metodo_pagamento: 'dinheiro' });
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Conta paga! Caixa atualizado.', 'success');
  await loadContasPage(window._contasTab || 'pagar');
}

async function receberConta(id) {
  const res = await API.put(`/financeiro/receber/${id}/receber`, { metodo_pagamento: 'dinheiro' });
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Recebimento confirmado! Caixa atualizado.', 'success');
  await loadContasPage('receber');
}

function excluirConta(id, tipo, desc) {
  confirm(`Excluir a conta "${desc}"?`, async () => {
    await API.del(`/financeiro/${tipo === 'pagar' ? 'pagar' : 'receber'}/${id}`);
    toast('Conta removida', 'info');
    await loadContasPage(window._contasTab || 'pagar');
  });
}
