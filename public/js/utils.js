// Utils
function fmt(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}
function fmtDate(d) {
  if (!d) return '-';
  return new Date(d.replace(' ', 'T')).toLocaleDateString('pt-BR');
}
function fmtDateTime(d) {
  if (!d) return '-';
  return new Date(d.replace(' ', 'T')).toLocaleString('pt-BR');
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function openModal(title, bodyHTML, opts = {}) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.add('open');
  if (opts.onOpen) opts.onOpen();
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
}

function closeForcedModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function confirm(msg, cb) {
  openModal('Confirmar', `
    <p style="color:var(--text2);margin-bottom:20px">${msg}</p>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeForcedModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="closeForcedModal();(${cb.toString()})()">Confirmar</button>
    </div>
  `);
}

function statusBadge(s) {
  const map = {
    ativo: 'green', inativo: 'gray', pago: 'green', pendente: 'yellow',
    vencido: 'red', cancelado: 'gray', recebido: 'green',
    aberto: 'blue', fechado: 'gray'
  };
  return `<span class="badge badge-${map[s] || 'gray'}">${s}</span>`;
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
