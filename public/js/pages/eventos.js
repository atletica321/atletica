async function renderEventos() {
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-primary" onclick="modalNovoEvento()">+ Novo Evento</button>`;
  await loadEventosPage();
}

async function loadEventosPage() {
  const eventos = await API.get('/eventos');
  document.getElementById('page-content').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px" id="eventos-grid">
      ${eventos.map(e => `
        <div class="card" style="padding:0;overflow:hidden">
          <div style="background:linear-gradient(135deg,var(--primary),var(--accent));padding:20px;position:relative">
            <div style="font-size:12px;opacity:0.8;margin-bottom:4px">${fmtDate(e.data_evento)}</div>
            <div style="font-family:var(--font-display);font-size:18px;font-weight:700">${e.nome}</div>
            <div style="font-size:12px;opacity:0.8;margin-top:4px">${e.local || ''}</div>
            <div style="position:absolute;top:14px;right:14px">${statusBadge(e.status)}</div>
          </div>
          <div style="padding:16px">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;text-align:center">
              <div>
                <div style="font-size:20px;font-weight:700;font-family:var(--font-display)">${e.ingressos_vendidos}</div>
                <div style="font-size:11px;color:var(--text2)">Vendidos</div>
              </div>
              <div>
                <div style="font-size:20px;font-weight:700;font-family:var(--font-display)">${e.capacidade}</div>
                <div style="font-size:11px;color:var(--text2)">Capacidade</div>
              </div>
              <div>
                <div style="font-size:20px;font-weight:700;font-family:var(--font-display)">${fmt(e.valor_ingresso)}</div>
                <div style="font-size:11px;color:var(--text2)">Ingresso</div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" style="flex:1" onclick="modalGerenciarEvento(${e.id})">🎟️ Ingressos</button>
              <button class="btn btn-ghost btn-sm" onclick="modalEditarEvento(${e.id})">✏️</button>
              <button class="btn btn-ghost btn-sm" onclick="confirmarCancelarEvento(${e.id},'${e.nome.replace(/'/g,"\\'")}')">🗑️</button>
            </div>
          </div>
        </div>
      `).join('') || '<div class="empty-state"><div class="empty-icon">🎉</div><p>Nenhum evento cadastrado</p></div>'}
    </div>
  `;
}

function modalNovoEvento(dados = {}) {
  openModal(dados.id ? 'Editar Evento' : 'Novo Evento', `
    <div class="form-group"><label>Nome do Evento *</label><input id="ev-nome" value="${dados.nome||''}" placeholder="Ex: Balada de Agosto"></div>
    <div class="form-group"><label>Descrição</label><textarea id="ev-desc">${dados.descricao||''}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Data do Evento</label><input id="ev-data" type="datetime-local" value="${dados.data_evento?.slice(0,16)||''}"></div>
      <div class="form-group"><label>Local</label><input id="ev-local" value="${dados.local||''}" placeholder="Nome do local"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Capacidade</label><input id="ev-cap" type="number" value="${dados.capacidade||''}" placeholder="0 = ilimitado"></div>
      <div class="form-group"><label>Valor do Ingresso (R$)</label><input id="ev-valor" type="number" step="0.01" value="${dados.valor_ingresso||''}" placeholder="0,00"></div>
    </div>
    ${dados.id ? `<div class="form-group"><label>Status</label>
      <select id="ev-status">
        <option value="ativo" ${dados.status==='ativo'?'selected':''}>Ativo</option>
        <option value="encerrado" ${dados.status==='encerrado'?'selected':''}>Encerrado</option>
        <option value="cancelado" ${dados.status==='cancelado'?'selected':''}>Cancelado</option>
      </select></div>` : ''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEvento(${dados.id||0})">Salvar</button>
    </div>
  `);
}

async function salvarEvento(id) {
  const body = {
    nome: document.getElementById('ev-nome').value,
    descricao: document.getElementById('ev-desc').value,
    data_evento: document.getElementById('ev-data').value,
    local: document.getElementById('ev-local').value,
    capacidade: parseInt(document.getElementById('ev-cap').value) || 0,
    valor_ingresso: parseFloat(document.getElementById('ev-valor').value) || 0,
    status: document.getElementById('ev-status')?.value || 'ativo'
  };
  if (!body.nome) { toast('Nome obrigatório', 'error'); return; }
  const res = id ? await API.put(`/eventos/${id}`, body) : await API.post('/eventos', body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast(id ? 'Evento atualizado!' : 'Evento criado!', 'success');
  closeForcedModal();
  await loadEventosPage();
}

async function modalEditarEvento(id) {
  const eventos = await API.get('/eventos');
  const ev = eventos.find(e => e.id === id);
  if (ev) modalNovoEvento(ev);
}

async function modalGerenciarEvento(eventoId) {
  const [ingressos, stats, lotes] = await Promise.all([
    API.get(`/eventos/${eventoId}/ingressos`),
    API.get(`/eventos/${eventoId}/stats`),
    API.get(`/eventos/${eventoId}/lotes`)
  ]);
  const eventos = await API.get('/eventos');
  const ev = eventos.find(e => e.id === eventoId);

  openModal(`🎟️ ${ev?.nome} — Ingressos`, `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
      <div style="background:var(--bg2);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--primary)">${stats.total}</div>
        <div style="font-size:11px;color:var(--text2)">Total</div>
      </div>
      <div style="background:var(--bg2);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--green)">${stats.pagos}</div>
        <div style="font-size:11px;color:var(--text2)">Pagos</div>
      </div>
      <div style="background:var(--bg2);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--yellow)">${stats.pendentes}</div>
        <div style="font-size:11px;color:var(--text2)">Pendentes</div>
      </div>
      <div style="background:var(--bg2);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--green)">${fmt(stats.receita)}</div>
        <div style="font-size:11px;color:var(--text2)">Receita</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button class="btn btn-primary btn-sm" onclick="modalVenderIngresso(${eventoId})">+ Vender Ingresso</button>
      <button class="btn btn-ghost btn-sm" onclick="modalGerenciarLotes(${eventoId})">📦 Lotes</button>
    </div>
    <div class="table-wrap" style="max-height:300px;overflow-y:auto">
      <table>
        <thead><tr><th>Código</th><th>Comprador</th><th>Portador</th><th>Lote</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${ingressos.map(i => `
            <tr>
              <td style="font-size:11px;font-family:monospace">${i.codigo}</td>
              <td>${i.nome_comprador}<br><span style="font-size:11px;color:var(--text2)">${i.email_comprador||''}</span></td>
              <td>${i.nome_portador !== i.nome_comprador ? `<span style="color:var(--yellow)">${i.nome_portador}</span>` : '-'}
                ${i.transferido ? '<span class="badge badge-yellow" style="font-size:10px;margin-left:4px">Transferido</span>' : ''}</td>
              <td>${i.lote_nome || '-'}</td>
              <td>${fmt(i.valor)}</td>
              <td>${statusBadge(i.status)}</td>
              <td>
                <div style="display:flex;gap:4px">
                  ${i.status === 'pendente' ? `<button class="btn btn-success btn-sm" onclick="confirmarPgtoIngresso(${i.id},${eventoId})">✓</button>` : ''}
                  ${i.status === 'pago' ? `<button class="btn btn-ghost btn-sm" onclick="modalTransferirIngresso(${i.id},${eventoId},'${i.codigo}')">↔️</button>` : ''}
                </div>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">Nenhum ingresso vendido</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
}

function modalVenderIngresso(eventoId) {
  openModal('Vender Ingresso', `
    <div class="form-group"><label>Nome do Comprador *</label><input id="ing-nome" placeholder="Nome completo"></div>
    <div class="form-row">
      <div class="form-group"><label>Email</label><input id="ing-email" type="email" placeholder="email@..."></div>
      <div class="form-group"><label>Telefone</label><input id="ing-tel" placeholder="(11) 99999..."></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Quantidade</label><input id="ing-qtd" type="number" value="1" min="1"></div>
      <div class="form-group"><label>Pagamento</label>
        <select id="ing-pagto">
          <option value="dinheiro">Dinheiro (pago na hora)</option>
          <option value="pix">PIX</option>
          <option value="debito">Débito</option>
          <option value="credito">Crédito</option>
          <option value="pendente">Pendente</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarVendaIngresso(${eventoId})">Vender</button>
    </div>
  `);
}

async function confirmarVendaIngresso(eventoId) {
  const body = {
    nome_comprador: document.getElementById('ing-nome').value,
    email_comprador: document.getElementById('ing-email').value,
    telefone_comprador: document.getElementById('ing-tel').value,
    quantidade: parseInt(document.getElementById('ing-qtd').value) || 1,
    metodo_pagamento: document.getElementById('ing-pagto').value
  };
  if (!body.nome_comprador) { toast('Nome obrigatório', 'error'); return; }
  const res = await API.post(`/eventos/${eventoId}/ingressos`, body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast(`${res.ingressos.length} ingresso(s) vendido(s)!`, 'success');
  closeForcedModal();
  modalGerenciarEvento(eventoId);
}

async function confirmarPgtoIngresso(ingressoId, eventoId) {
  const res = await API.put(`/eventos/ingressos/${ingressoId}/pagar`, {});
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Pagamento confirmado!', 'success');
  modalGerenciarEvento(eventoId);
}

function modalTransferirIngresso(ingressoId, eventoId, codigo) {
  openModal(`↔️ Transferir Ingresso ${codigo}`, `
    <p style="color:var(--text2);margin-bottom:16px">Informe os dados do novo portador do ingresso.</p>
    <div class="form-group"><label>Nome do Novo Portador *</label><input id="t-nome" placeholder="Nome completo"></div>
    <div class="form-group"><label>Email do Novo Portador</label><input id="t-email" type="email" placeholder="email@..."></div>
    <div class="form-group"><label>Motivo (opcional)</label><input id="t-motivo" placeholder="Ex: Venda, presente..."></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarTransferencia(${ingressoId},${eventoId})">Transferir</button>
    </div>
  `);
}

async function confirmarTransferencia(ingressoId, eventoId) {
  const body = {
    nome_novo_portador: document.getElementById('t-nome').value,
    email_novo_portador: document.getElementById('t-email').value,
    motivo: document.getElementById('t-motivo').value
  };
  if (!body.nome_novo_portador) { toast('Nome obrigatório', 'error'); return; }
  const res = await API.post(`/eventos/ingressos/${ingressoId}/transferir`, body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Ingresso transferido!', 'success');
  closeForcedModal();
  modalGerenciarEvento(eventoId);
}

async function modalGerenciarLotes(eventoId) {
  const lotes = await API.get(`/eventos/${eventoId}/lotes`);
  openModal('📦 Gerenciar Lotes', `
    <div style="margin-bottom:16px">
      <button class="btn btn-primary btn-sm" onclick="modalNovoLote(${eventoId})">+ Novo Lote</button>
    </div>
    <table>
      <thead><tr><th>Lote</th><th>Quantidade</th><th>Valor</th><th>Período</th><th>Status</th></tr></thead>
      <tbody>
        ${lotes.map(l => `
          <tr>
            <td>${l.nome}</td>
            <td>${l.quantidade}</td>
            <td>${fmt(l.valor)}</td>
            <td>${fmtDate(l.data_inicio)} - ${fmtDate(l.data_fim)}</td>
            <td>${statusBadge(l.status)}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:16px">Nenhum lote</td></tr>'}
      </tbody>
    </table>
  `);
}

function modalNovoLote(eventoId) {
  openModal('Novo Lote', `
    <div class="form-group"><label>Nome do Lote</label><input id="l-nome" placeholder="Ex: 1º Lote, Pista..."></div>
    <div class="form-row">
      <div class="form-group"><label>Quantidade</label><input id="l-qtd" type="number" placeholder="100"></div>
      <div class="form-group"><label>Valor (R$)</label><input id="l-val" type="number" step="0.01" placeholder="0,00"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Data Início</label><input id="l-ini" type="date"></div>
      <div class="form-group"><label>Data Fim</label><input id="l-fim" type="date"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarLote(${eventoId})">Salvar</button>
    </div>
  `);
}

async function salvarLote(eventoId) {
  const body = {
    nome: document.getElementById('l-nome').value,
    quantidade: parseInt(document.getElementById('l-qtd').value) || 0,
    valor: parseFloat(document.getElementById('l-val').value) || 0,
    data_inicio: document.getElementById('l-ini').value,
    data_fim: document.getElementById('l-fim').value
  };
  const res = await API.post(`/eventos/${eventoId}/lotes`, body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Lote criado!', 'success');
  closeForcedModal();
  modalGerenciarLotes(eventoId);
}

function confirmarCancelarEvento(id, nome) {
  confirm(`Cancelar o evento "${nome}"?`, async () => {
    await API.del(`/eventos/${id}`);
    toast('Evento cancelado', 'info');
    await loadEventosPage();
  });
}
