async function renderCaixa() {
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-primary" onclick="modalLancamentoCaixa()">+ Lançamento</button>`;
  await loadCaixaPage();
}

async function loadCaixaPage(filtros = {}) {
  const params = new URLSearchParams(filtros);
  const [data, resumo] = await Promise.all([
    API.get('/financeiro/caixa?' + params),
    API.get('/financeiro/caixa/resumo')
  ]);

  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card ${resumo.saldo >= 0 ? 'green' : 'red'}">
        <div class="stat-label">Saldo Atual</div>
        <div class="stat-value">${fmt(resumo.saldo)}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Entradas Hoje</div>
        <div class="stat-value">${fmt(resumo.hoje?.entradas)}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Saídas Hoje</div>
        <div class="stat-value">${fmt(resumo.hoje?.saidas)}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Entradas do Mês</div>
        <div class="stat-value">${fmt(resumo.mes?.entradas)}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Saídas do Mês</div>
        <div class="stat-value">${fmt(resumo.mes?.saidas)}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Movimentações</span>
      </div>
      <div class="filter-bar">
        <input type="date" id="f-inicio" value="${filtros.inicio||''}" onchange="filtrarCaixa()">
        <input type="date" id="f-fim" value="${filtros.fim||''}" onchange="filtrarCaixa()">
        <select id="f-tipo" onchange="filtrarCaixa()">
          <option value="">Todos os tipos</option>
          <option value="entrada" ${filtros.tipo==='entrada'?'selected':''}>Entradas</option>
          <option value="saida" ${filtros.tipo==='saida'?'selected':''}>Saídas</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('f-inicio').value='';document.getElementById('f-fim').value='';document.getElementById('f-tipo').value='';filtrarCaixa()">Limpar</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Saldo Após</th><th>Data</th><th>Operador</th></tr></thead>
          <tbody>
            ${(data.movimentos || []).map(m => `
              <tr>
                <td>${m.tipo === 'entrada'
                  ? '<span class="badge badge-green">⬆ Entrada</span>'
                  : '<span class="badge badge-red">⬇ Saída</span>'}
                </td>
                <td><span class="badge badge-blue">${m.categoria || '-'}</span></td>
                <td>${m.descricao}</td>
                <td style="font-weight:600;color:${m.tipo==='entrada'?'var(--green)':'var(--red)'}">
                  ${m.tipo==='entrada' ? '+' : '-'}${fmt(m.valor)}
                </td>
                <td>${fmt(m.saldo_posterior)}</td>
                <td>${fmtDateTime(m.data_movimentacao)}</td>
                <td>${m.operador_nome || '-'}</td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">Nenhuma movimentação</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function filtrarCaixa() {
  const filtros = {};
  const inicio = document.getElementById('f-inicio')?.value;
  const fim = document.getElementById('f-fim')?.value;
  const tipo = document.getElementById('f-tipo')?.value;
  if (inicio) filtros.inicio = inicio;
  if (fim) filtros.fim = fim;
  if (tipo) filtros.tipo = tipo;
  loadCaixaPage(filtros);
}

function modalLancamentoCaixa() {
  openModal('Lançamento Manual', `
    <div class="form-group"><label>Tipo *</label>
      <select id="lc-tipo">
        <option value="entrada">Entrada</option>
        <option value="saida">Saída</option>
      </select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Categoria</label>
        <select id="lc-cat">
          <option value="outros">Outros</option>
          <option value="mensalidade">Mensalidade</option>
          <option value="ingressos">Ingressos</option>
          <option value="venda">Venda</option>
          <option value="patrocinio">Patrocínio</option>
          <option value="conta_pagar">Conta a Pagar</option>
          <option value="investimento">Investimento</option>
          <option value="devolucao">Devolução</option>
        </select>
      </div>
      <div class="form-group"><label>Valor (R$) *</label><input id="lc-valor" type="number" step="0.01" placeholder="0,00"></div>
    </div>
    <div class="form-group"><label>Descrição *</label><input id="lc-desc" placeholder="Descreva a movimentação"></div>
    <div class="form-group"><label>Observações</label><textarea id="lc-obs"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarLancamento()">Lançar</button>
    </div>
  `);
}

async function salvarLancamento() {
  const body = {
    tipo: document.getElementById('lc-tipo').value,
    categoria: document.getElementById('lc-cat').value,
    descricao: document.getElementById('lc-desc').value,
    valor: parseFloat(document.getElementById('lc-valor').value),
    observacoes: document.getElementById('lc-obs').value
  };
  if (!body.descricao || !body.valor) { toast('Preencha descrição e valor', 'error'); return; }
  const res = await API.post('/financeiro/caixa', body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Lançamento realizado!', 'success');
  closeForcedModal();
  await loadCaixaPage();
}
