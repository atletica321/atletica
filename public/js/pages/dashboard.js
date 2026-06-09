async function renderDashboard() {
  document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Carregando dashboard...</p></div>`;
  const data = await API.get('/financeiro/dashboard');
  if (!data) return;

  const saldoColor = data.saldo >= 0 ? 'green' : 'red';
  const lucroMes = (data.receitaMes || 0) - (data.despesasMes || 0);

  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card ${saldoColor}">
        <div class="stat-label">Saldo em Caixa</div>
        <div class="stat-value">${fmt(data.saldo)}</div>
        <div class="stat-sub">Saldo atual</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Receita do Mês</div>
        <div class="stat-value">${fmt(data.receitaMes)}</div>
        <div class="stat-sub">Entradas no mês</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Despesas do Mês</div>
        <div class="stat-value">${fmt(data.despesasMes)}</div>
        <div class="stat-sub">Saídas no mês</div>
      </div>
      <div class="stat-card ${lucroMes >= 0 ? 'green' : 'red'}">
        <div class="stat-label">Resultado do Mês</div>
        <div class="stat-value">${fmt(lucroMes)}</div>
        <div class="stat-sub">${lucroMes >= 0 ? 'Superávit' : 'Déficit'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Sócios Ativos</div>
        <div class="stat-value">${data.socios}</div>
        <div class="stat-sub">Membros ativos</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-label">Contas a Vencer</div>
        <div class="stat-value">${data.contasVencer}</div>
        <div class="stat-sub">Próximos 7 dias</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-label">Eventos Ativos</div>
        <div class="stat-value">${data.eventosPróximos}</div>
        <div class="stat-sub">Eventos futuros</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ingressos Hoje</div>
        <div class="stat-value">${data.ingressosHoje}</div>
        <div class="stat-sub">Pagos hoje</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px" class="dash-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title">📊 Fluxo Anual (${new Date().getFullYear()})</span>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:8px;font-size:11px;color:var(--text2)">
          <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--primary);border-radius:2px;display:inline-block"></span>Entradas</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--accent);border-radius:2px;display:inline-block"></span>Saídas</span>
        </div>
        <div class="chart-bar-wrap" id="chart-anual"></div>
        <div style="display:flex;gap:0;margin-top:4px" id="chart-labels"></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">🕓 Últimas Movimentações</span>
          <button class="btn btn-ghost btn-sm" onclick="navigate('caixa')">Ver todas</button>
        </div>
        <div class="table-wrap">
          <table>
            <tbody>
              ${(data.ultimosMovimentos || []).map(m => `
                <tr>
                  <td>${m.tipo === 'entrada' ? '⬆️' : '⬇️'}</td>
                  <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.descricao}</td>
                  <td style="color:${m.tipo === 'entrada' ? 'var(--green)' : 'var(--red)'}; font-weight:600">
                    ${m.tipo === 'entrada' ? '+' : '-'}${fmt(m.valor)}
                  </td>
                  <td style="color:var(--text3);font-size:12px">${fmtDate(m.data_movimentacao)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">Nenhuma movimentação</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Render chart
  const maxVal = Math.max(...(data.receitaAnual || []).map(m => Math.max(m.entrada, m.saida)), 1);
  const chartEl = document.getElementById('chart-anual');
  const labelsEl = document.getElementById('chart-labels');
  if (chartEl && data.receitaAnual) {
    chartEl.innerHTML = data.receitaAnual.map((m, i) => `
      <div class="chart-bar-col">
        <div class="chart-bar" style="height:${Math.round((m.entrada / maxVal) * 100)}%" title="Entrada: ${fmt(m.entrada)}"></div>
        <div class="chart-bar saida" style="height:${Math.round((m.saida / maxVal) * 100)}%" title="Saída: ${fmt(m.saida)}"></div>
      </div>
    `).join('');
    labelsEl.innerHTML = data.receitaAnual.map(m => `<div style="flex:1;text-align:center;font-size:10px;color:var(--text3)">${MESES[parseInt(m.mes) - 1]}</div>`).join('');
  }

  // Responsive dash grid
  if (window.innerWidth < 768) {
    const g = document.querySelector('.dash-grid');
    if (g) g.style.gridTemplateColumns = '1fr';
  }
}
