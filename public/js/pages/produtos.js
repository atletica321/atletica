async function renderProdutos() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-ghost" onclick="loadProdutosPage('produtos')">📦 Produtos</button>
    <button class="btn btn-primary" onclick="loadProdutosPage('venda')">🛒 Nova Venda</button>
  `;
  await loadProdutosPage('produtos');
}

async function loadProdutosPage(tab = 'produtos') {
  window._prodTab = tab;
  const [produtos, vendas] = await Promise.all([
    API.get('/financeiro/produtos'),
    API.get('/financeiro/vendas')
  ]);

  const totalVendasHoje = vendas.filter(v => v.data_venda?.slice(0,10) === new Date().toISOString().slice(0,10)).reduce((s, v) => s + v.valor_total, 0);
  const estoqueBaixo = produtos.filter(p => p.estoque <= p.estoque_minimo).length;

  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      <div class="stat-card"><div class="stat-label">Produtos Ativos</div><div class="stat-value">${produtos.length}</div></div>
      <div class="stat-card yellow"><div class="stat-label">Estoque Baixo</div><div class="stat-value">${estoqueBaixo}</div></div>
      <div class="stat-card green"><div class="stat-label">Vendas Hoje</div><div class="stat-value">${fmt(totalVendasHoje)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Vendas</div><div class="stat-value">${vendas.length}</div></div>
    </div>

    <div class="tabs">
      <div class="tab ${tab==='produtos'?'active':''}" onclick="loadProdutosPage('produtos')">Estoque</div>
      <div class="tab ${tab==='venda'?'active':''}" onclick="loadProdutosPage('venda')">Nova Venda</div>
      <div class="tab ${tab==='historico'?'active':''}" onclick="loadProdutosPage('historico')">Histórico</div>
    </div>

    <div id="tab-content">
      ${tab === 'produtos' ? renderEstoque(produtos) : ''}
      ${tab === 'venda' ? renderNovaVenda(produtos) : ''}
      ${tab === 'historico' ? renderHistoricoVendas(vendas) : ''}
    </div>
  `;
}

function renderEstoque(produtos) {
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Produtos em Estoque</span>
        <button class="btn btn-primary btn-sm" onclick="modalNovoProduto()">+ Produto</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Margem</th><th>Estoque</th><th>Ações</th></tr></thead>
          <tbody>
            ${produtos.map(p => {
              const margem = p.preco_custo > 0 ? ((p.preco_venda - p.preco_custo) / p.preco_custo * 100).toFixed(0) : '-';
              const estoqueClass = p.estoque <= p.estoque_minimo ? 'red' : 'green';
              return `
                <tr>
                  <td><strong>${p.nome}</strong><br><span style="font-size:12px;color:var(--text2)">${p.descricao||''}</span></td>
                  <td>${p.categoria||'-'}</td>
                  <td>${fmt(p.preco_custo)}</td>
                  <td>${fmt(p.preco_venda)}</td>
                  <td>${margem !== '-' ? `<span class="badge badge-${parseInt(margem)>20?'green':'yellow'}">${margem}%</span>` : '-'}</td>
                  <td>
                    <span class="badge badge-${estoqueClass}">${p.estoque} un</span>
                    ${p.estoque <= p.estoque_minimo ? '<span style="color:var(--yellow);font-size:11px;margin-left:4px">⚠️ Baixo</span>' : ''}
                  </td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-ghost btn-sm" onclick="modalEditarProduto(${p.id})">✏️</button>
                      <button class="btn btn-ghost btn-sm" onclick="excluirProduto(${p.id},'${p.nome.replace(/'/g,"\\'")}')">🗑️</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">Nenhum produto</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderNovaVenda(produtos) {
  return `
    <div class="card">
      <div class="card-header"><span class="card-title">🛒 Nova Venda</span></div>
      <div id="itens-venda" style="margin-bottom:16px">
        <div class="item-venda" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end">
          <div class="form-group" style="margin:0"><label>Produto</label>
            <select class="prod-sel" onchange="atualizarPreco(this)">
              <option value="">Selecionar produto...</option>
              ${produtos.map(p => `<option value="${p.id}" data-preco="${p.preco_venda}">${p.nome} (${fmt(p.preco_venda)})</option>`).join('')}
              <option value="manual">— Produto manual —</option>
            </select>
          </div>
          <div class="form-group" style="margin:0"><label>Qtd</label><input type="number" class="qtd-inp" value="1" min="1" onchange="calcularTotal()"></div>
          <div class="form-group" style="margin:0"><label>Preço Unit.</label><input type="number" class="preco-inp" step="0.01" placeholder="0,00" onchange="calcularTotal()"></div>
          <button class="btn btn-ghost btn-sm" onclick="removerItem(this)" style="margin-bottom:0">✕</button>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="adicionarItem(${JSON.stringify(produtos).replace(/"/g,'&quot;')})">+ Adicionar item</button>
      <hr style="border-color:var(--border);margin:16px 0">
      <div class="form-row">
        <div class="form-group"><label>Desconto (R$)</label><input id="v-desc" type="number" step="0.01" value="0" onchange="calcularTotal()"></div>
        <div class="form-group"><label>Forma de Pagamento</label>
          <select id="v-pagto">
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Observações</label><input id="v-obs" placeholder="Opcional"></div>
      <div style="background:var(--bg2);border-radius:8px;padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px">
          <span style="color:var(--text2)">Subtotal:</span><span id="v-subtotal">R$ 0,00</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px">
          <span style="color:var(--text2)">Desconto:</span><span style="color:var(--red)" id="v-desc-display">R$ 0,00</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700">
          <span>Total:</span><span id="v-total" style="color:var(--green)">R$ 0,00</span>
        </div>
      </div>
      <button class="btn btn-primary btn-full" onclick="finalizarVenda(${JSON.stringify(produtos).replace(/"/g,'&quot;')})">✅ Finalizar Venda</button>
    </div>
  `;
}

function atualizarPreco(sel) {
  const preco = sel.options[sel.selectedIndex]?.dataset?.preco || '';
  const row = sel.closest('.item-venda');
  row.querySelector('.preco-inp').value = preco;
  calcularTotal();
}

function adicionarItem(produtos) {
  const container = document.getElementById('itens-venda');
  const div = document.createElement('div');
  div.className = 'item-venda';
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end';
  div.innerHTML = `
    <div class="form-group" style="margin:0"><label>Produto</label>
      <select class="prod-sel" onchange="atualizarPreco(this)">
        <option value="">Selecionar...</option>
        ${produtos.map(p => `<option value="${p.id}" data-preco="${p.preco_venda}">${p.nome} (${fmt(p.preco_venda)})</option>`).join('')}
        <option value="manual">— Manual —</option>
      </select>
    </div>
    <div class="form-group" style="margin:0"><label>Qtd</label><input type="number" class="qtd-inp" value="1" min="1" onchange="calcularTotal()"></div>
    <div class="form-group" style="margin:0"><label>Preço</label><input type="number" class="preco-inp" step="0.01" placeholder="0,00" onchange="calcularTotal()"></div>
    <button class="btn btn-ghost btn-sm" onclick="removerItem(this)">✕</button>
  `;
  container.appendChild(div);
}

function removerItem(btn) {
  btn.closest('.item-venda').remove();
  calcularTotal();
}

function calcularTotal() {
  let subtotal = 0;
  document.querySelectorAll('.item-venda').forEach(row => {
    const qtd = parseFloat(row.querySelector('.qtd-inp')?.value) || 0;
    const preco = parseFloat(row.querySelector('.preco-inp')?.value) || 0;
    subtotal += qtd * preco;
  });
  const desc = parseFloat(document.getElementById('v-desc')?.value) || 0;
  const total = subtotal - desc;
  if (document.getElementById('v-subtotal')) document.getElementById('v-subtotal').textContent = fmt(subtotal);
  if (document.getElementById('v-desc-display')) document.getElementById('v-desc-display').textContent = fmt(desc);
  if (document.getElementById('v-total')) document.getElementById('v-total').textContent = fmt(total);
}

async function finalizarVenda(produtos) {
  const itens = [];
  document.querySelectorAll('.item-venda').forEach(row => {
    const sel = row.querySelector('.prod-sel');
    const qtd = parseInt(row.querySelector('.qtd-inp')?.value) || 1;
    const preco = parseFloat(row.querySelector('.preco-inp')?.value) || 0;
    const prodId = sel?.value && sel.value !== 'manual' ? parseInt(sel.value) : null;
    const nomeProd = sel?.options[sel.selectedIndex]?.text || 'Produto';
    if (preco > 0) itens.push({ produto_id: prodId, descricao: nomeProd, quantidade: qtd, preco_unitario: preco });
  });
  if (!itens.length) { toast('Adicione pelo menos um item', 'error'); return; }
  const body = {
    itens,
    desconto: parseFloat(document.getElementById('v-desc')?.value) || 0,
    metodo_pagamento: document.getElementById('v-pagto')?.value,
    observacoes: document.getElementById('v-obs')?.value
  };
  const res = await API.post('/financeiro/vendas', body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast(`Venda realizada! Total: ${fmt(res.total)}`, 'success');
  await loadProdutosPage('historico');
}

function renderHistoricoVendas(vendas) {
  return `
    <div class="card">
      <div class="card-header"><span class="card-title">Histórico de Vendas</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Pagamento</th><th>Total</th><th>Operador</th></tr></thead>
          <tbody>
            ${vendas.map(v => `
              <tr>
                <td>${fmtDateTime(v.data_venda)}</td>
                <td>${v.descricao || '-'}</td>
                <td>${v.metodo_pagamento || '-'}</td>
                <td style="font-weight:600;color:var(--green)">${fmt(v.valor_total)}</td>
                <td>${v.operador_nome || '-'}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:40px">Nenhuma venda</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function modalNovoProduto(dados = {}) {
  openModal(dados.id ? 'Editar Produto' : 'Novo Produto', `
    <div class="form-group"><label>Nome *</label><input id="pr-nome" value="${dados.nome||''}" placeholder="Nome do produto"></div>
    <div class="form-row">
      <div class="form-group"><label>Categoria</label>
        <select id="pr-cat">
          <option value="">Sem categoria</option>
          <option value="bebida" ${dados.categoria==='bebida'?'selected':''}>Bebida</option>
          <option value="alimento" ${dados.categoria==='alimento'?'selected':''}>Alimento</option>
          <option value="vestuario" ${dados.categoria==='vestuario'?'selected':''}>Vestuário</option>
          <option value="acessorio" ${dados.categoria==='acessorio'?'selected':''}>Acessório</option>
          <option value="outros" ${dados.categoria==='outros'?'selected':''}>Outros</option>
        </select>
      </div>
      <div class="form-group"><label>Estoque Mínimo</label><input id="pr-emin" type="number" value="${dados.estoque_minimo||5}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Preço de Custo (R$)</label><input id="pr-custo" type="number" step="0.01" value="${dados.preco_custo||''}"></div>
      <div class="form-group"><label>Preço de Venda (R$)</label><input id="pr-venda" type="number" step="0.01" value="${dados.preco_venda||''}"></div>
    </div>
    <div class="form-group"><label>Estoque Atual</label><input id="pr-est" type="number" value="${dados.estoque||0}"></div>
    <div class="form-group"><label>Descrição</label><textarea id="pr-desc">${dados.descricao||''}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarProduto(${dados.id||0})">Salvar</button>
    </div>
  `);
}

async function salvarProduto(id) {
  const body = {
    nome: document.getElementById('pr-nome').value,
    categoria: document.getElementById('pr-cat').value,
    preco_custo: parseFloat(document.getElementById('pr-custo').value) || 0,
    preco_venda: parseFloat(document.getElementById('pr-venda').value) || 0,
    estoque: parseInt(document.getElementById('pr-est').value) || 0,
    estoque_minimo: parseInt(document.getElementById('pr-emin').value) || 5,
    descricao: document.getElementById('pr-desc').value,
    ativo: 1
  };
  if (!body.nome) { toast('Nome obrigatório', 'error'); return; }
  const res = id ? await API.put(`/financeiro/produtos/${id}`, body) : await API.post('/financeiro/produtos', body);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Produto salvo!', 'success');
  closeForcedModal();
  await loadProdutosPage('produtos');
}

async function modalEditarProduto(id) {
  const produtos = await API.get('/financeiro/produtos');
  const p = produtos.find(x => x.id === id);
  if (p) modalNovoProduto(p);
}

function excluirProduto(id, nome) {
  confirm(`Remover o produto "${nome}"?`, async () => {
    await API.del(`/financeiro/produtos/${id}`);
    toast('Produto removido', 'info');
    await loadProdutosPage('produtos');
  });
}
