/* ===========================================================
   Kontrola — Infrastructure list page logic
   Shared helpers live in common.js (window.KCOMMON).
   Clicking a row opens the per-device detail page (same-tab navigation).
   =========================================================== */
(function () {
  const { DEVICES, TOOLS } = window.KONTROLA;
  const {
    has, NA, esc, orNA, fmtOr, fmtBytes, fmtUptime, fmtBps,
    stateBadge, statusDotColor, RANGES, getRange, setRangeVal, genTrend, drawChart, infoDot,
  } = window.KCOMMON;

  /* ===================== STATE ===================== */
  let state = { sortKey: 'name', sortDir: 1, search: '', perPage: 10, page: 1 };

  const accessors = {
    name: d => (d.name || '').toLowerCase(),
    type: d => (d.type || '').toLowerCase(),
    location: d => (d.location || '').toLowerCase(),
    uptimeSec: d => has(d.uptimeSec) ? d.uptimeSec : -1,
    ports: d => has(d.portsUp) ? d.portsUp : -1,
    rx: d => has(d.rx) ? d.rx : -1,
    tx: d => has(d.tx) ? d.tx : -1,
    oper: d => has(d.oper) ? d.oper : 99,
  };

  function filtered() {
    const q = state.search.trim().toLowerCase();
    let rows = DEVICES.filter(d => {
      if (!q) return true;
      return (d.name + ' ' + d.type + ' ' + d.location + ' ' + d.mac + ' ' + d.iface +
        ' ' + d.sources.map(s => TOOLS[s]).join(' ')).toLowerCase().includes(q);
    });
    const acc = accessors[state.sortKey] || accessors.name;
    rows.sort((a, b) => {
      const va = acc(a), vb = acc(b);
      if (va < vb) return -1 * state.sortDir;
      if (va > vb) return 1 * state.sortDir;
      return 0;
    });
    return rows;
  }

  /* ===================== SUMMARY CARDS ===================== */
  function renderStats() {
    const total = DEVICES.length;
    const up = DEVICES.filter(d => d.oper === 1).length;
    const down = DEVICES.filter(d => d.oper === 2 || d.oper === 7).length;
    const testing = total - up - down;
    const totRx = DEVICES.reduce((s, d) => s + (has(d.rx) ? d.rx : 0), 0);
    const totTx = DEVICES.reduce((s, d) => s + (has(d.tx) ? d.tx : 0), 0);
    const avail = total ? ((up / total) * 100).toFixed(1) : null;
    const portsUp = DEVICES.reduce((s, d) => s + (has(d.portsUp) ? d.portsUp : 0), 0);
    const portsTot = DEVICES.reduce((s, d) => s + (has(d.portsTotal) ? d.portsTotal : 0), 0);

    const I = {
      server: '<path d="M3 4h18v6H3zM3 14h18v6H3z"/><circle cx="7" cy="7" r=".5"/><circle cx="7" cy="17" r=".5"/>',
      up: '<path d="M20 6 9 17l-5-5"/>',
      down: '<path d="M18 6 6 18M6 6l12 12"/>',
      port: '<rect x="3" y="9" width="18" height="6" rx="1"/><path d="M7 9V7M12 9V7M17 9V7M7 17v-2M12 17v-2M17 17v-2"/>',
      dl: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/>',
    };
    const card = (label, value, sub, icon, icClass = '') => `
      <div class="card stat">
        <div class="top">
          <span class="label">${label}</span>
          <span class="ic ${icClass}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span>
        </div>
        <div class="value">${value}</div>
        <div class="sub">${sub}</div>
      </div>`;

    document.getElementById('stats').innerHTML =
      card('Total Devices', total, `Across 4 sites · <span class="delta up">${avail != null ? avail + '% availability' : 'N/A'}</span>`, I.server) +
      card('Devices Up', up, `<span class="delta up">▲ Operational</span> · ${testing} testing`, I.up, 'green') +
      card('Devices Down', down, down ? `<span class="delta down">▼ Needs attention</span>` : 'All clear', I.down, 'red') +
      card('Ports Online', portsTot ? `${portsUp}<small> / ${portsTot}</small>` : NA, `Live interfaces across the fleet`, I.port) +
      card('Total RX / TX', fmtOr(totRx + totTx, fmtBytes), `RX ${fmtOr(totRx, fmtBytes)} · TX ${fmtOr(totTx, fmtBytes)}`, I.dl);
  }

  /* ===================== TABLE ===================== */
  const COLS = [
    { key: 'name', label: 'Device', sort: true },
    { key: 'type', label: 'Type', sort: true },
    { key: 'location', label: 'Location', sort: true },
    { key: 'uptimeSec', label: 'Uptime', sort: true },
    { key: 'ports', label: 'Ports', sort: true, num: true },
    { key: 'rx', label: 'RX', sort: true, num: true },
    { key: 'tx', label: 'TX', sort: true, num: true },
    { key: 'oper', label: 'Status', sort: true },
  ];

  function portsCell(d) {
    if (!has(d.portsTotal)) return NA;
    const up = d.portsUp, tot = d.portsTotal;
    const cls = up === tot ? 'ok' : up === 0 ? 'bad' : 'warn';
    const pct = tot ? Math.round((up / tot) * 100) : 0;
    return `<span class="ports ${cls}" title="${up} of ${tot} ports online">
      <span class="ports-num"><b>${up}</b><span class="sep">/</span>${tot}</span>
      <span class="ports-bar"><span style="width:${pct}%"></span></span></span>`;
  }

  function renderHead() {
    const arrow = `<svg class="arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    document.getElementById('thead').innerHTML = '<tr>' + COLS.map(c => {
      const sorted = state.sortKey === c.key;
      const dirArrow = sorted ? `<svg class="arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${state.sortDir === 1 ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/></svg>` : arrow;
      return `<th class="${c.sort ? '' : 'no-sort'} ${sorted ? 'sorted' : ''} ${c.num ? 'num' : ''}" ${c.sort ? `data-key="${c.key}"` : ''}>
        <span class="th">${c.label}${c.sort ? dirArrow : ''}</span></th>`;
    }).join('') + '</tr>';

    document.querySelectorAll('#thead th[data-key]').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.key;
        if (state.sortKey === k) state.sortDir *= -1;
        else { state.sortKey = k; state.sortDir = 1; }
        state.page = 1;
        renderHead(); renderBody();
      });
    });
  }

  function openDevice(name) {
    // Navigate in the same tab — a real page transition (not the old modal).
    // (Opening a brand-new browser tab loses the preview's auth context.)
    location.href = 'device.html?d=' + encodeURIComponent(name);
  }

  function renderBody() {
    const rows = filtered();
    const totalPages = Math.max(1, Math.ceil(rows.length / state.perPage));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * state.perPage;
    const slice = rows.slice(start, start + state.perPage);
    const tb = document.getElementById('tbody');

    if (!slice.length) {
      tb.innerHTML = `<tr><td colspan="${COLS.length}"><div class="empty">No infrastructure matches your search.</div></td></tr>`;
    } else {
      tb.innerHTML = slice.map(d => {
        return `<tr data-name="${esc(d.name)}" tabindex="0" title="Open ${esc(d.name)}">
          <td><div class="dev-name"><span class="dot" style="background:${statusDotColor(d)}"></span>
            <span class="meta"><b>${orNA(d.name)}</b><span>${orNA(d.iface)} · ${orNA(d.mac)}</span></span></div></td>
          <td class="cell-type" title="${esc(d.type || '')}">${orNA(d.type)}</td>
          <td class="cell-loc" title="${esc(d.location || '')}">${orNA(d.location)}</td>
          <td class="mono">${fmtOr(d.uptimeSec, fmtUptime)}</td>
          <td class="num">${portsCell(d)}</td>
          <td class="num mono">${fmtOr(d.rx, fmtBytes)}</td>
          <td class="num mono">${fmtOr(d.tx, fmtBytes)}</td>
          <td>${stateBadge(d.oper)}</td>
        </tr>`;
      }).join('');
      tb.querySelectorAll('tr[data-name]').forEach(tr => {
        tr.addEventListener('click', () => openDevice(tr.dataset.name));
        tr.addEventListener('keydown', e => { if (e.key === 'Enter') openDevice(tr.dataset.name); });
      });
    }
    renderPager(rows.length, totalPages, start, slice.length);
  }

  function renderPager(total, totalPages, start, count) {
    const info = document.getElementById('pager-info');
    info.innerHTML = total ? `Showing <b>${start + 1}–${start + count}</b> of <b>${total}</b> devices` : 'No devices';

    const mk = (label, page, opts = {}) => `<button class="pgbtn ${opts.active ? 'active' : ''}" ${opts.disabled ? 'disabled' : ''} data-page="${page}">${label}</button>`;
    const prev = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
    const next = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

    let html = mk(prev, state.page - 1, { disabled: state.page === 1 });
    const win = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - state.page) <= 1) win.push(p);
      else if (win[win.length - 1] !== '…') win.push('…');
    }
    win.forEach(p => { html += p === '…' ? `<span class="pgbtn" style="border:none;background:none;cursor:default">…</span>` : mk(p, p, { active: p === state.page }); });
    html += mk(next, state.page + 1, { disabled: state.page === totalPages });

    const pages = document.getElementById('pager-pages');
    pages.innerHTML = html;
    pages.querySelectorAll('.pgbtn[data-page]').forEach(b => {
      b.addEventListener('click', () => { const p = +b.dataset.page; if (p >= 1 && p <= totalPages) { state.page = p; renderBody(); } });
    });
  }

  /* ===================== NETWORK METRICS ===================== */
  const METRICS = [
    { id: 'thr', title: 'Throughput', desc: 'Aggregate inbound / outbound traffic',
      what: 'Combined inbound (RX) and outbound (TX) traffic across every monitored interface in the fleet.',
      how: 'Polled from SNMP <i>ifHCInOctets</i> / <i>ifHCOutOctets</i> counters every 60s; the delta between samples is converted to bits per second.',
      fmtY: v => fmtBps(v), fmtVal: v => fmtBps(v),
      series: [
        { label: 'Inbound (RX)', color: 'var(--orange)', base: 6.2e9, jitter: 7e8, lo: 8e8, fill: true },
        { label: 'Outbound (TX)', color: '#2d6fd6', base: 4.0e9, jitter: 6e8, lo: 6e8 },
      ] },
    { id: 'rtt', title: 'Latency (RTT)', desc: 'Round-trip time · ICMP probes',
      what: 'Round-trip time between the Kontrola pollers and each device \u2014 the fleet average and the slowest path.',
      how: 'Measured with periodic ICMP echo (ping) probes; round-trip times are averaged per polling interval.',
      fmtY: v => v.toFixed(0) + 'ms', fmtVal: v => v.toFixed(1) + ' ms',
      series: [
        { label: 'Average', color: 'var(--orange)', base: 12, jitter: 3, lo: 2, fill: true },
        { label: 'Worst path', color: 'var(--gray)', base: 34, jitter: 7, lo: 8, dashed: true },
      ] },
    { id: 'loss', title: 'Packet Loss', desc: 'Dropped probes across links', yMax: 8,
      what: 'Share of probe packets that never returned \u2014 a proxy for link reliability.',
      how: 'Derived from the same ICMP probe batches as latency: lost replies \u00f7 probes sent, per interval.',
      fmtY: v => v.toFixed(1) + '%', fmtVal: v => v.toFixed(2) + ' %',
      series: [
        { label: 'Average', color: 'var(--orange)', base: 0.4, jitter: 0.35, lo: 0, fill: true },
        { label: 'Worst link', color: 'var(--gray)', base: 2.1, jitter: 0.9, lo: 0, dashed: true },
      ] },
    { id: 'jit', title: 'Jitter', desc: 'Latency variation',
      what: 'Variation in latency between consecutive probes \u2014 high jitter degrades voice and video.',
      how: 'Computed as the mean deviation of ICMP round-trip times within each polling interval.',
      fmtY: v => v.toFixed(1) + 'ms', fmtVal: v => v.toFixed(2) + ' ms',
      series: [
        { label: 'Average', color: 'var(--orange)', base: 1.8, jitter: 0.6, lo: 0, fill: true },
        { label: 'Worst path', color: 'var(--gray)', base: 6, jitter: 1.7, lo: 0, dashed: true },
      ] },
    { id: 'err', title: 'Interface Errors', desc: 'Errors & discards per minute',
      what: 'Frame errors and discarded packets observed on monitored interfaces, rated per minute.',
      how: 'Read from SNMP <i>ifInErrors</i> / <i>ifOutErrors</i> and <i>ifInDiscards</i> / <i>ifOutDiscards</i> counters.',
      fmtY: v => v.toFixed(0), fmtVal: v => v.toFixed(0) + '/min',
      series: [
        { label: 'Errors/min', color: 'var(--orange)', base: 3, jitter: 2, lo: 0, fill: true },
        { label: 'Discards/min', color: '#2d6fd6', base: 9, jitter: 4, lo: 0 },
      ] },
    { id: 'load', title: 'Device Load', desc: 'CPU & memory · fleet average', yMax: 100,
      what: 'CPU and memory utilization, averaged across all reporting devices in the fleet.',
      how: 'Sampled via SNMP host-resource and vendor MIBs (e.g. <i>hrProcessorLoad</i> and memory OIDs) each interval.',
      fmtY: v => v.toFixed(0) + '%', fmtVal: v => v.toFixed(0) + ' %',
      series: [
        { label: 'CPU avg', color: 'var(--orange)', base: 38, jitter: 9, lo: 2, hi: 100, fill: true },
        { label: 'Memory avg', color: 'var(--gray)', base: 58, jitter: 7, lo: 5, hi: 100, dashed: true },
      ] },
  ];

  function buildCharts() {
    const host = document.getElementById('charts');
    host.innerHTML = METRICS.map(m => `
      <div class="card chartcard">
        <div class="chd">
          <div><h3>${m.title}${infoDot(m.title, m.what, m.how)}</h3><p class="chsub">${m.desc}</p></div>
          <div class="now"><b id="now-${m.id}">—</b><span>now</span></div>
        </div>
        <div class="legend">
          ${m.series.map(s => `<i><b style="background:${s.color}${s.dashed ? ';opacity:.7' : ''}"></b>${s.label}</i>`).join('')}
        </div>
        <div id="chart-${m.id}"></div>
      </div>`).join('');
  }

  function renderCharts() {
    const range = getRange();
    const r = RANGES[range];
    METRICS.forEach(m => {
      const series = m.series.map(s => ({
        label: s.label, color: s.color, dashed: s.dashed, fill: s.fill,
        data: genTrend(s.base, s.jitter, r.n, s.lo, s.hi),
      }));
      drawChart(document.getElementById('chart-' + m.id), {
        series, range, yMax: m.yMax, fmtY: m.fmtY, fmtVal: m.fmtVal,
      });
      const last = series[0].data[series[0].data.length - 1];
      document.getElementById('now-' + m.id).innerHTML = has(last) ? m.fmtVal(last).replace(/\s/g, '') : NA;
    });
  }

  function setRange(range) {
    if (!RANGES[range]) return;
    setRangeVal(range);
    document.querySelectorAll('#range-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.range === range));
    renderCharts();
  }

  /* ===================== CSV ===================== */
  function downloadCSV() {
    const { IFTYPE, STATE } = window.KONTROLA;
    const rows = filtered();
    const headers = ['Device Name', 'Device Type', 'IANA Register', 'Uptime', 'Contact', 'Location', 'Services',
      'Interface', 'Interface Type', 'MTU', 'Bandwidth (bps)', 'Ports Up', 'Ports Total', 'RX (bytes)', 'TX (bytes)', 'MAC Address',
      'Administrative State', 'Operational State'];
    const lines = [headers.join(',')];
    rows.forEach(d => {
      const cells = [d.name, d.type, d.iana, fmtUptime(d.uptimeSec), d.contact, d.location, d.services,
        d.iface, has(d.ifType) ? `${d.ifType} ${IFTYPE[d.ifType] || 'other'}` : null, d.mtu, d.bandwidth,
        d.portsUp, d.portsTotal, d.rx, d.tx, d.mac, STATE[d.admin], STATE[d.oper]];
      lines.push(cells.map(c => { const s = has(c) ? String(c) : 'N/A'; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kontrola-network-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ===================== THEME ===================== */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('kontrola-theme', t); } catch (e) {}
    const ic = document.getElementById('theme-ic');
    ic.innerHTML = t === 'dark'
      ? '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
      : '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
    renderCharts();
  }

  /* ===================== INIT ===================== */
  function init() {
    let saved = 'light';
    try { saved = localStorage.getItem('kontrola-theme') || 'light'; } catch (e) {}

    renderStats();
    renderHead();
    renderBody();
    buildCharts();

    document.querySelectorAll('#range-seg .seg-btn').forEach(b => {
      b.addEventListener('click', () => setRange(b.dataset.range));
    });
    document.querySelectorAll('#range-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.range === getRange()));

    applyTheme(saved); // also triggers first renderCharts()

    document.getElementById('search').addEventListener('input', e => { state.search = e.target.value; state.page = 1; renderBody(); });
    document.getElementById('perpage').addEventListener('change', e => { state.perPage = +e.target.value; state.page = 1; renderBody(); });
    document.getElementById('btn-csv').addEventListener('click', downloadCSV);
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    window.addEventListener('resize', () => { clearTimeout(window.__rc); window.__rc = setTimeout(renderCharts, 200); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
