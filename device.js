/* ===========================================================
   Kontrola — per-device detail page
   Opened in a new tab from the Infrastructure list:
     device.html?d=<device name>
   Renders the interface metric table, traffic and SNMP detail.
   =========================================================== */
(function () {
  const { DEVICES, IFTYPE, STATE } = window.KONTROLA;
  const {
    has, NA, esc, orNA, fmtOr, noData, fmtBytes, fmtBps, fmtUptime, fmtCompact,
    stateBadge, RANGES, getRange, setRangeVal, genTrend, drawChart,
  } = window.KCOMMON;

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('kontrola-theme', t); } catch (e) {}
    const ic = document.getElementById('theme-ic');
    ic.innerHTML = t === 'dark'
      ? '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
      : '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
    if (currentDevice) renderTraffic(currentDevice);
  }

  /* ---------- which device? ---------- */
  const params = new URLSearchParams(location.search);
  const wanted = params.get('d');
  const currentDevice = DEVICES.find(d => d.name === wanted) || null;

  /* ===================== HERO ===================== */
  function portsHero(d) {
    if (!has(d.portsTotal)) return `<div class="hk">Ports</div><div class="hv">${NA}</div>`;
    const cls = d.portsUp === d.portsTotal ? 'ok' : d.portsUp === 0 ? 'bad' : 'warn';
    return `<div class="hk">Ports</div><div class="hv ${cls}">${d.portsUp}<small> / ${d.portsTotal}</small></div>`;
  }
  function renderHero(d) {
    document.title = `Kontrola · ${d.name}`;
    document.getElementById('crumb-name').textContent = d.name;
    const chip = (k, v) => `<div class="hchip"><div class="hk">${k}</div><div class="hv">${v}</div></div>`;
    document.getElementById('hero').innerHTML = `
      <span class="badge-lg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="7" rx="1.5"/><rect x="2" y="14" width="20" height="7" rx="1.5"/><path d="M6 6.5h.01M6 17.5h.01"/></svg>
      </span>
      <div class="htitle">
        <h1>${orNA(d.name)} ${stateBadge(d.oper)}</h1>
        <div class="htype">${orNA(d.type)} <span style="opacity:.4">·</span> ${orNA(d.location)}</div>
      </div>
      <div class="hero-chips">
        <div class="hchip">${portsHero(d)}</div>
        ${chip('Uptime', fmtOr(d.uptimeSec, fmtUptime))}
        ${chip('Bandwidth', fmtOr(d.bandwidth, fmtBps))}
        ${chip('Interface', has(d.iface) ? `<span style="font-size:15px">${esc(d.iface)}</span>` : NA)}
      </div>`;
  }

  /* ===================== INTERFACE METRIC TABLE ===================== */
  const IFCOLS = [
    { key: 'state', label: 'Status' },
    { key: 'index', label: 'Index', num: true },
    { key: 'name', label: 'Name' },
    { key: 'desc', label: 'Description' },
    { key: 'octIn', label: 'Octets In', num: true },
    { key: 'octOut', label: 'Octets Out', num: true },
    { key: 'errIn', label: 'Inbound Errors', num: true },
    { key: 'errOut', label: 'Outbound Errors', num: true },
  ];
  let ifSort = { key: 'index', dir: 1 }, ifSearch = '';
  const STATE_ORDER = { up: 0, down: 1, off: 2 };

  function ifBadge(s) {
    const label = s === 'up' ? 'UP' : s === 'down' ? 'DOWN' : 'OFF';
    return `<span class="if-badge ${s}">${label}</span>`;
  }
  function numCell(v, isErr) {
    if (!has(v)) return `<td class="num">${NA}</td>`;
    const txt = fmtCompact(v);
    if (v === 0) return `<td class="num zero">0</td>`;
    return `<td class="num${isErr ? ' err-hot' : ''}">${txt}</td>`;
  }

  function ifFiltered(d) {
    const q = ifSearch.trim().toLowerCase();
    let rows = d.interfaces.filter(it => !q ||
      (it.name + ' ' + it.desc + ' ' + it.state).toLowerCase().includes(q));
    const k = ifSort.key;
    rows = rows.slice().sort((a, b) => {
      let va = a[k], vb = b[k];
      if (k === 'state') { va = STATE_ORDER[va]; vb = STATE_ORDER[vb]; }
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return -1 * ifSort.dir;
      if (va > vb) return 1 * ifSort.dir;
      return 0;
    });
    return rows;
  }

  function renderIfHead() {
    const arrow = `<svg class="arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    document.getElementById('if-thead').innerHTML = '<tr>' + IFCOLS.map(c => {
      const sorted = ifSort.key === c.key;
      const dirArrow = sorted ? `<svg class="arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${ifSort.dir === 1 ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/></svg>` : arrow;
      return `<th class="${sorted ? 'sorted' : ''} ${c.num ? 'num' : ''}" data-key="${c.key}"><span class="th">${c.label}${dirArrow}</span></th>`;
    }).join('') + '</tr>';
    document.querySelectorAll('#if-thead th[data-key]').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.key;
        if (ifSort.key === k) ifSort.dir *= -1; else { ifSort.key = k; ifSort.dir = 1; }
        renderIfHead(); renderIfBody();
      });
    });
  }

  function renderIfBody() {
    const d = currentDevice;
    const tb = document.getElementById('if-tbody');
    const count = document.getElementById('if-count');

    // N/A scenario — device unreachable / no SNMP interface data
    if (!d.interfaces) {
      count.textContent = 'Interface data unavailable';
      tb.innerHTML = `<tr><td colspan="${IFCOLS.length}"><div class="iftable-empty">${noData('No interface data available — device unreachable')}</div></td></tr>`;
      return;
    }
    const rows = ifFiltered(d);
    const tot = d.interfaces.length;
    count.innerHTML = rows.length
      ? `Showing <b>1–${rows.length}</b> of <b>${tot}</b> interface${tot === 1 ? '' : 's'} on this device`
      : `No interfaces match your search · <b>${tot}</b> total`;

    if (!rows.length) {
      tb.innerHTML = `<tr><td colspan="${IFCOLS.length}"><div class="empty">No interfaces match your search.</div></td></tr>`;
      return;
    }
    tb.innerHTML = rows.map(it => `<tr>
      <td>${ifBadge(it.state)}</td>
      <td class="num idx">${it.index}</td>
      <td class="ifname">${esc(it.name)}</td>
      <td class="ifdesc">${esc(it.desc)}</td>
      ${numCell(it.octIn)}
      ${numCell(it.octOut)}
      ${numCell(it.errIn, true)}
      ${numCell(it.errOut, true)}
    </tr>`).join('');
  }

  /* ===================== TRAFFIC ===================== */
  function renderTraffic(d) {
    const host = document.getElementById('m-traffic');
    document.getElementById('m-range-lbl').textContent = RANGES[getRange()].label + ' view';
    if (!has(d.bandwidth)) {
      host.innerHTML = noData('No traffic data available');
      document.getElementById('mt-rx-now').innerHTML = NA;
      document.getElementById('mt-tx-now').innerHTML = NA;
      return;
    }
    const r = RANGES[getRange()];
    const util = genTrend(28, 16, r.n, 4, 92);
    const txUtil = util.map(v => Math.max(2, v * 0.78 + (Math.random() * 8 - 4)));
    const rxData = util.map(v => (v / 100) * d.bandwidth * 0.62);
    const txData = txUtil.map(v => (v / 100) * d.bandwidth * 0.5);
    drawChart(host, {
      range: getRange(), fmtY: v => fmtBps(v), fmtVal: v => fmtBps(v),
      series: [
        { label: 'RX (in)', color: 'var(--orange)', data: rxData, fill: true },
        { label: 'TX (out)', color: '#2d6fd6', data: txData },
      ],
    });
    document.getElementById('mt-rx-now').textContent = fmtBps(rxData[rxData.length - 1]);
    document.getElementById('mt-tx-now').textContent = fmtBps(txData[txData.length - 1]);
  }

  function setRange(range) {
    if (!RANGES[range]) return;
    setRangeVal(range);
    document.querySelectorAll('#range-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.range === range));
    renderTraffic(currentDevice);
  }

  /* ===================== SNMP INFO ===================== */
  function row(k, v, descCls) { return `<div class="snmp-row"><span class="k">${k}</span><span class="v ${descCls || ''}">${v}</span></div>`; }
  function rowFull(k, v) { return `<div class="snmp-row full"><span class="k">${k}</span><span class="v">${v}</span></div>`; }

  function renderInfo(d) {
    document.getElementById('m-body').innerHTML = `
      <div class="snmp-sec">Device</div>
      <div class="snmp-grid">
        ${row('Device Name', orNA(d.name))}
        ${row('Device Type', orNA(d.type))}
        ${row('IANA Register', has(d.iana) ? `<span class="mono">${esc(d.iana)}</span>` : NA)}
        ${row('Device Uptime', fmtOr(d.uptimeSec, fmtUptime))}
        ${row('Device Contact', orNA(d.contact))}
        ${row('Device Location', orNA(d.location))}
        ${row('Device Services', has(d.services) ? d.services : NA)}
        ${row('Ports Online', has(d.portsTotal) ? `${d.portsUp} / ${d.portsTotal}` : NA)}
      </div>

      <div class="snmp-sec">Primary Interface — ${orNA(d.iface)}</div>
      <div class="snmp-grid">
        ${row('Interface Name', has(d.iface) ? `<span class="mono">${esc(d.iface)}</span>` : NA)}
        ${row('Interface Type', has(d.ifType) ? `${d.ifType} · ${IFTYPE[d.ifType] || 'other'}` : NA)}
        ${row('MTU', has(d.mtu) ? `${d.mtu.toLocaleString()} bytes` : NA)}
        ${row('Bandwidth', fmtOr(d.bandwidth, fmtBps))}
        ${row('MAC Address', has(d.mac) ? `<span class="mono">${esc(d.mac)}</span>` : NA)}
        ${row('Administrative State', stateBadge(d.admin))}
        ${row('Operational State', stateBadge(d.oper))}
      </div>

      <div class="snmp-sec">Traffic counters (cumulative)</div>
      <div class="snmp-grid">
        ${row('RX (ifHCInOctets)', fmtOr(d.rx, fmtBytes))}
        ${row('TX (ifHCOutOctets)', fmtOr(d.tx, fmtBytes))}
        ${rowFull('RX bytes', has(d.rx) ? `<span class="mono">${d.rx.toLocaleString()}</span>` : NA)}
        ${rowFull('TX bytes', has(d.tx) ? `<span class="mono">${d.tx.toLocaleString()}</span>` : NA)}
        <div class="snmp-row full"><span class="k">Note</span><span class="v desc">Cumulative octet counters (ifHCInOctets / ifHCOutOctets) since the device booted.</span></div>
      </div>`;
  }

  /* ===================== NOT FOUND ===================== */
  function renderNotFound() {
    document.getElementById('crumb-name').textContent = 'Not found';
    document.getElementById('hero').innerHTML = `
      <div class="htitle">
        <h1>Device not found</h1>
        <div class="htype">No device named “${esc(wanted || '')}” exists in this dataset.</div>
      </div>`;
    document.getElementById('traffic-card').style.display = 'none';
    document.querySelector('.iftable').style.display = 'none';
    document.getElementById('m-body').closest('.card').style.display = 'none';
  }

  /* ===================== INIT ===================== */
  function init() {
    let saved = 'light';
    try { saved = localStorage.getItem('kontrola-theme') || 'light'; } catch (e) {}
    applyTheme(saved);
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    if (!currentDevice) { renderNotFound(); return; }

    renderHero(currentDevice);
    renderIfHead();
    renderIfBody();
    renderInfo(currentDevice);

    document.querySelectorAll('#range-seg .seg-btn').forEach(b => {
      b.addEventListener('click', () => setRange(b.dataset.range));
      b.classList.toggle('active', b.dataset.range === getRange());
    });
    renderTraffic(currentDevice);

    document.getElementById('if-search').addEventListener('input', e => { ifSearch = e.target.value; renderIfBody(); });
    window.addEventListener('resize', () => { clearTimeout(window.__rc); window.__rc = setTimeout(() => renderTraffic(currentDevice), 200); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
