/* ===========================================================
   Kontrola — per-device detail page
   Opened in a new tab from the Infrastructure list:
     device.html?d=<device name>
   Renders the interface metric table, traffic and SNMP detail.
   =========================================================== */
(function () {
  const { DEVICES, STATE } = window.KONTROLA;
  const {
    has, NA, esc, orNA, fmtOr, noData, fmtBytes, fmtBps, fmtUptime, fmtCompact,
    stateBadge, getFlag, setFlag, flagCounts, RANGES, getRange, setRangeVal, genTrend, drawChart,
  } = window.KCOMMON;

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('kontrola-theme', t); } catch (e) {}
    const ic = document.getElementById('theme-ic');
    ic.innerHTML = t === 'dark'
      ? '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
      : '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
    if (currentDevice) renderGraphDetails(currentDevice);
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
        <div id="flag-summary" class="flag-summary" style="margin-top:12px"></div>
      </div>
      <div class="hero-chips">
        <div class="hchip">${portsHero(d)}</div>
        ${chip('Uptime', fmtOr(d.uptimeSec, fmtUptime))}
        ${chip('Bandwidth', fmtOr(d.bandwidth, fmtBps))}
        ${chip('IP Address', has(d.ip) ? `<span class="mono">${esc(d.ip)}</span>` : NA)}
      </div>`;
  }

  /* ===================== INTERFACE METRIC TABLE ===================== */
  const IFCOLS = [
    { key: 'state', label: 'Status' },
    { key: 'index', label: 'Index', num: true },
    { key: 'name', label: 'Name' },
    { key: 'desc', label: 'Description' },
    { key: 'flag', label: 'Role' },
    { key: 'octIn', label: 'Octets In', num: true },
    { key: 'octOut', label: 'Octets Out', num: true },
    { key: 'errIn', label: 'Inbound Errors', num: true },
    { key: 'errOut', label: 'Outbound Errors', num: true },
  ];
  let ifSort = { key: 'index', dir: 1 }, ifSearch = '', ifStatus = 'all';
  const STATE_ORDER = { up: 0, down: 1, off: 2 };
  const FLAG_ORDER = { uplink: 0, downlink: 1, unset: 2 };

  function ifBadge(s) {
    const label = s === 'up' ? 'UP' : s === 'down' ? 'DOWN' : 'OFF';
    return `<span class="if-badge ${s}">${label}</span>`;
  }
  // Role flag control — the user's mapping action. Three exclusive options.
  function flagControl(it) {
    const f = getFlag(currentDevice.name, it);
    const opt = (val, label) => `<button type="button" class="fl-btn${f === val ? ' active' : ''}" data-port="${esc(it.name)}" data-flag="${val}" title="Flag ${esc(it.name)} as ${label}">${label}</button>`;
    return `<div class="flag-seg" role="group" aria-label="Port role">${opt('uplink', 'Uplink')}${opt('downlink', 'Downlink')}${opt('unset', '—')}</div>`;
  }
  function numCell(v, isErr) {
    if (!has(v)) return `<td class="num">${NA}</td>`;
    const txt = fmtCompact(v);
    if (v === 0) return `<td class="num zero">0</td>`;
    return `<td class="num${isErr ? ' err-hot' : ''}">${txt}</td>`;
  }

  function ifStatusMatch(it) {
    if (ifStatus === 'up') return it.state === 'up';
    if (ifStatus === 'down') return it.state !== 'up';   // down + admin-disabled
    return true;
  }
  function ifFiltered(d) {
    const q = ifSearch.trim().toLowerCase();
    let rows = d.interfaces.filter(it => ifStatusMatch(it) && (!q ||
      (it.name + ' ' + it.desc + ' ' + it.state).toLowerCase().includes(q)));
    const k = ifSort.key;
    rows = rows.slice().sort((a, b) => {
      let va = a[k], vb = b[k];
      if (k === 'state') { va = STATE_ORDER[va]; vb = STATE_ORDER[vb]; }
      else if (k === 'flag') { va = FLAG_ORDER[getFlag(d.name, a)]; vb = FLAG_ORDER[getFlag(d.name, b)]; }
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

  // SNMP poll freshness — when did we last successfully receive data from this device?
  function syncInfo(d) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < (d.name || '').length; i++) { h ^= d.name.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = h >>> 0;
    if (d.rx == null && d.tx == null) return { fresh: false, label: 'No data received', tip: 'No successful SNMP poll — device unreachable' };
    const secs = 4 + (h % 52);
    return { fresh: true, label: `Synced ${secs}s ago`, tip: 'Last successful SNMP poll · 60s interval' };
  }
  function renderSync(d) {
    const el = document.getElementById('if-sync');
    if (!el) return;
    const s = syncInfo(d);
    el.className = 'sync-pill ' + (s.fresh ? 'fresh' : 'stale');
    el.title = s.tip;
    el.innerHTML = `<span class="sdot"></span>${s.label}`;
  }
  function applyIfStatus(status) {
    ifStatus = status;
    document.querySelectorAll('#if-status-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.status === status));
    renderIfBody();
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
    const filtering = ifStatus !== 'all' || ifSearch.trim();
    count.innerHTML = rows.length
      ? `Showing <b>${rows.length}</b>${filtering ? ` of <b>${tot}</b>` : ''} interface${(filtering ? rows.length : tot) === 1 ? '' : 's'}`
      : `No interfaces match · <b>${tot}</b> total`;

    if (!rows.length) {
      tb.innerHTML = `<tr><td colspan="${IFCOLS.length}"><div class="empty">No interfaces match the current filter.</div></td></tr>`;
      return;
    }
    tb.innerHTML = rows.map(it => `<tr>
      <td>${ifBadge(it.state)}</td>
      <td class="num idx">${it.index}</td>
      <td class="ifname">${esc(it.name)}</td>
      <td class="ifdesc">${esc(it.desc)}</td>
      <td>${flagControl(it)}</td>
      ${numCell(it.octIn)}
      ${numCell(it.octOut)}
      ${numCell(it.errIn, true)}
      ${numCell(it.errOut, true)}
    </tr>`).join('');

    tb.querySelectorAll('.fl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setFlag(currentDevice.name, btn.dataset.port, btn.dataset.flag);
        // update this row's control in place (avoid a re-sort jump), then the summary
        const grp = btn.closest('.flag-seg');
        grp.querySelectorAll('.fl-btn').forEach(x => x.classList.toggle('active', x === btn));
        renderFlagSummary();
      });
    });
  }

  function renderFlagSummary() {
    const el = document.getElementById('flag-summary');
    if (!el) return;
    if (!currentDevice.interfaces) { el.innerHTML = ''; return; }
    const c = flagCounts(currentDevice);
    el.innerHTML =
      `<span class="fl-pill uplink" title="Uplink ports online / flagged"><span class="fl-ar">↑</span>Uplink <b>${c.uplink.up}/${c.uplink.total}</b></span>` +
      `<span class="fl-pill downlink" title="Downlink ports online / flagged"><span class="fl-ar">↓</span>Downlink <b>${c.downlink.up}/${c.downlink.total}</b></span>` +
      `<span class="fl-pill unset" title="Ports not flagged — excluded from the Infrastructure overview">Unflagged <b>${c.unset}</b></span>`;
  }

  /* ===================== GRAPH DETAILS (device-wide, all ports) ===================== */
  function renderGraphDetails(d) {
    const lbl = document.getElementById('gd-range-lbl');
    if (lbl) lbl.textContent = RANGES[getRange()].label + ' view · aggregated across all interfaces';
    renderThroughput(d);
    renderPackets(d);
    renderHealth(d);
  }

  // aggregate capacity proxy across the device's interfaces
  function aggCapacity(d) {
    const ports = Math.max(1, d.portsUp || d.portsTotal || 1);
    return (d.bandwidth || 1e9) * Math.max(1, ports * 0.55);
  }

  function renderThroughput(d) {
    const host = document.getElementById('chart-thr');
    if (!host) return;
    if (!has(d.bandwidth) || !d.interfaces) {
      host.innerHTML = noData('No traffic data available');
      setNow('now-thr-rx', NA); setNow('now-thr-tx', NA); return;
    }
    const r = RANGES[getRange()], cap = aggCapacity(d);
    const util = genTrend(34, 17, r.n, 5, 94);
    const rx = util.map(v => (v / 100) * cap * 0.6);
    const tx = util.map(v => Math.max(0, (v * 0.8 + (Math.random() * 8 - 4)) / 100) * cap * 0.46);
    drawChart(host, {
      range: getRange(), fmtY: v => fmtBps(v), fmtVal: v => fmtBps(v),
      series: [
        { label: 'RX (in)', color: 'var(--orange)', data: rx, fill: true },
        { label: 'TX (out)', color: '#2d6fd6', data: tx },
      ],
    });
    setNow('now-thr-rx', fmtBps(rx[rx.length - 1]));
    setNow('now-thr-tx', fmtBps(tx[tx.length - 1]));
  }

  function renderPackets(d) {
    const host = document.getElementById('chart-pps');
    if (!host) return;
    if (!has(d.bandwidth) || !d.interfaces) {
      host.innerHTML = noData('No packet data available');
      setNow('now-pps-in', NA); setNow('now-pps-out', NA); return;
    }
    const r = RANGES[getRange()], cap = aggCapacity(d);
    const AVG_FRAME_BITS = 760 * 8;   // avg frame ~760 bytes → bits
    const util = genTrend(40, 18, r.n, 6, 96);
    // packets/s = bits per second ÷ average frame size (unicast + multicast + broadcast combined)
    const pin = util.map(v => (v / 100) * cap * 0.6 / AVG_FRAME_BITS);
    const pout = util.map(v => Math.max(0, (v * 0.82 + (Math.random() * 8 - 4)) / 100) * cap * 0.46 / AVG_FRAME_BITS);
    const pps = v => fmtCompact(Math.round(v)) + ' pps';
    drawChart(host, {
      range: getRange(), fmtY: v => fmtCompact(v), fmtVal: pps,
      series: [
        { label: 'In', color: 'var(--orange)', data: pin, fill: true },
        { label: 'Out', color: '#2d6fd6', data: pout },
      ],
    });
    setNow('now-pps-in', pps(pin[pin.length - 1]));
    setNow('now-pps-out', pps(pout[pout.length - 1]));
  }

  function renderHealth(d) {
    const host = document.getElementById('chart-health');
    if (!host) return;
    if (!d.interfaces) {
      host.innerHTML = noData('No interface data available');
      setNow('now-err', NA); setNow('now-dsc', NA); return;
    }
    const r = RANGES[getRange()];
    // does this device currently carry errors? (drives the baseline)
    const errored = d.interfaces.some(p => (p.errIn || 0) + (p.errOut || 0) > 0) || d.oper === 3;
    const eBase = errored ? 42 : 5, dBase = errored ? 28 : 3;
    const err = genTrend(eBase, eBase * 0.6, r.n, 0);
    const dsc = genTrend(dBase, dBase * 0.6, r.n, 0);
    const cnt = v => fmtCompact(Math.round(v));
    drawChart(host, {
      range: getRange(), fmtY: v => cnt(v), fmtVal: v => cnt(v) + ' /min',
      series: [
        { label: 'Errors', color: 'var(--bad)', data: err, fill: true },
        { label: 'Discards', color: 'var(--gray)', data: dsc },
      ],
    });
    setNow('now-err', cnt(err[err.length - 1]));
    setNow('now-dsc', cnt(dsc[dsc.length - 1]));
  }

  function setNow(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val; }

  function setRange(range) {
    if (!RANGES[range]) return;
    setRangeVal(range);
    document.querySelectorAll('#range-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.range === range));
    renderGraphDetails(currentDevice);
    renderLatency(currentDevice);
    renderLoss(currentDevice);
  }

  /* ===================== LATENCY & RELIABILITY (per-device ICMP) ===================== */
  function deviceRtt(d) {
    const loc = (d.location || '').toLowerCase();
    if (loc.includes('surabaya')) return 22;
    if (loc.includes('bekasi')) return 34;
    if (loc.includes('vcluster')) return 5;
    return 9;
  }
  function renderLatency(d) {
    const host = document.getElementById('chart-rtt');
    const now = document.getElementById('now-rtt');
    if (!host) return;
    if (!d.interfaces) { host.innerHTML = noData('No latency data — device unreachable'); if (now) now.innerHTML = NA; return; }
    const r = RANGES[getRange()];
    const base = deviceRtt(d);
    const data = genTrend(base, base * 0.28, r.n, 1, base * 3);
    drawChart(host, {
      range: getRange(), fmtY: v => v.toFixed(0) + 'ms', fmtVal: v => v.toFixed(1) + ' ms',
      series: [{ label: 'RTT', color: 'var(--orange)', data, fill: true }],
    });
    if (now) now.textContent = data[data.length - 1].toFixed(1) + 'ms';
  }
  function renderLoss(d) {
    const host = document.getElementById('chart-loss');
    const now = document.getElementById('now-loss');
    if (!host) return;
    if (!d.interfaces) { host.innerHTML = noData('No packet-loss data — device unreachable'); if (now) now.innerHTML = NA; return; }
    const r = RANGES[getRange()];
    const bad = d.oper === 3 || d.oper === 2 || d.oper === 7;
    const base = bad ? 2.4 : 0.25;
    const data = genTrend(base, bad ? 1.1 : 0.3, r.n, 0, 8);
    drawChart(host, {
      range: getRange(), yMax: bad ? 8 : 2, fmtY: v => v.toFixed(1) + '%', fmtVal: v => v.toFixed(2) + ' %',
      series: [{ label: 'Loss', color: 'var(--orange)', data, fill: true }],
    });
    if (now) now.textContent = data[data.length - 1].toFixed(2) + '%';
  }

  /* ===================== DESCRIPTION DETAILS ===================== */
  // description-grid tile + a synthetic "last seen" (no real telemetry timestamp in the dataset)
  function dcell(k, v) { return `<div class="desc-cell"><span class="dk">${k}</span><span class="dv">${v}</span></div>`; }
  function lastSeen(d) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < (d.name || '').length; i++) { h ^= d.name.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = h >>> 0;
    if (d.rx == null && d.tx == null) return ['2 days ago', '5 hours ago', '1 day ago', '8 hours ago'][h % 4];   // never reporting
    if (d.oper === 2 || d.oper === 7 || d.oper === 3) return ['14 min ago', '38 min ago', '1 hour ago'][h % 3];   // down / degraded but seen recently
    return ['Just now', '30 sec ago', '1 min ago', '2 min ago'][h % 4];                                          // healthy
  }

  function renderInfo(d) {
    document.getElementById('m-body').innerHTML = `
      <div class="snmp-sec">Description details</div>
      <div class="desc-grid">
        ${dcell('Type', orNA(d.type))}
        ${dcell('Vendor', orNA(d.vendor))}
        ${dcell('Uptime', fmtOr(d.uptimeSec, fmtUptime))}
        ${dcell('Contact', orNA(d.contact))}
        ${dcell('Name', orNA(d.name))}
        ${dcell('Location', orNA(d.location))}
        ${dcell('Services', has(d.services) ? d.services : NA)}
        ${dcell('Last Seen', lastSeen(d))}
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
    document.querySelectorAll('.gd-section, .dev-health, .iftable').forEach(el => { el.style.display = 'none'; });
    document.getElementById('m-body').closest('.card').style.display = 'none';
  }

  /* ===================== EXPORT (CSV / PDF) ===================== */
  const FLAG_LABEL = { uplink: 'Uplink', downlink: 'Downlink', unset: '—' };
  const csvCell = c => { const s = has(c) ? String(c) : 'N/A'; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

  function exportDeviceCSV() {
    const d = currentDevice;
    const rows = d.interfaces ? ifFiltered(d) : [];
    const headers = ['Device', 'IP', 'Vendor', 'If Index', 'Interface', 'Description', 'Role', 'Status',
      'Octets In', 'Octets Out', 'Errors In', 'Errors Out'];
    const lines = [headers.join(',')];
    rows.forEach(it => {
      lines.push([d.name, d.ip, d.vendor, it.index, it.name, it.desc, FLAG_LABEL[getFlag(d.name, it)],
        it.state, it.octIn, it.octOut, it.errIn, it.errOut].map(csvCell).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kontrola-${(d.name || 'device').replace(/[^\w-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportDevicePDF() {
    const d = currentDevice;
    const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const sync = syncInfo(d);
    const desc = [
      ['Type', d.type], ['Vendor', d.vendor], ['Uptime', has(d.uptimeSec) ? fmtUptime(d.uptimeSec) : '—'],
      ['Contact', d.contact], ['Name', d.name], ['Location', d.location],
      ['Services', has(d.services) ? d.services : '—'], ['Last Seen', lastSeen(d)],
    ].map(([k, v]) => `<div class="dc"><span class="k">${esc(k)}</span><span class="v">${esc(String(v == null ? '—' : v))}</span></div>`).join('');

    const ifRows = (d.interfaces || []).map(it => {
      const st = it.state, stCls = st === 'up' ? 'up' : st === 'off' ? 'off' : 'down';
      return `<tr>
        <td><span class="st ${stCls}">${esc(st.toUpperCase())}</span></td>
        <td class="r">${it.index}</td><td class="nm">${esc(it.name)}</td><td>${esc(it.desc)}</td>
        <td>${FLAG_LABEL[getFlag(d.name, it)]}</td>
        <td class="r mono">${fmtBytes(it.octIn)}</td><td class="r mono">${fmtBytes(it.octOut)}</td>
        <td class="r mono">${it.errIn}</td><td class="r mono">${it.errOut}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kontrola — ${esc(d.name)}</title>
      <style>
        *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#241F20;margin:32px}
        .rh{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:3px solid #E25716;padding-bottom:12px}
        .brand{font-size:22px;font-weight:800;color:#E25716} .brand span{color:#241F20}
        .rh .meta{text-align:right;font-size:11px;color:#6c6766;line-height:1.5}
        h1{font-size:17px;margin:16px 0 2px} .st-line{font-size:11.5px;color:#6c6766;margin-bottom:16px}
        .st-line b{color:#241F20}
        .desc{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
        .dc{border:1px solid #ececec;border-radius:8px;padding:9px 11px}
        .dc .k{display:block;font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:#9a9594;font-weight:700}
        .dc .v{display:block;font-size:12.5px;font-weight:700;margin-top:3px}
        h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#E25716;margin:0 0 8px}
        table{width:100%;border-collapse:collapse;font-size:10.5px}
        thead th{background:#E25716;color:#fff;text-align:left;font-size:9px;letter-spacing:.04em;text-transform:uppercase;padding:7px 8px}
        thead th.r{text-align:right}
        tbody td{padding:6px 8px;border-bottom:1px solid #ececec} td.r{text-align:right} td.nm{font-weight:700}
        .mono{font-variant-numeric:tabular-nums} tbody tr:nth-child(even){background:#faf8f7}
        .st{font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;text-transform:uppercase}
        .st.up{background:#e6f4ec;color:#1f8a4c}.st.down{background:#fdeaea;color:#d23b3b}.st.off{background:#f0eeee;color:#8a8f94}
        .ft{margin-top:16px;font-size:10px;color:#9a9594;text-align:center}
        @media print{body{margin:12mm}thead{display:table-header-group}}
      </style></head><body>
      <div class="rh"><div class="brand">‹ kontrola<span> / network</span></div>
        <div class="meta">Device Report · tristek<br>Generated ${now}</div></div>
      <h1>${esc(d.name)}</h1>
      <div class="st-line">${esc(d.type || '')} · ${esc(d.ip || '')} · Status <b>${esc((STATE[d.oper] || 'N/A'))}</b> · ${sync.fresh ? esc(sync.label) : 'No data received'}</div>
      <h2>Description details</h2>
      <div class="desc">${desc}</div>
      <h2>Interfaces (${(d.interfaces || []).length})</h2>
      <table><thead><tr>
        <th>Status</th><th class="r">#</th><th>Name</th><th>Description</th><th>Role</th>
        <th class="r">Octets In</th><th class="r">Octets Out</th><th class="r">Err In</th><th class="r">Err Out</th>
      </tr></thead><tbody>${ifRows || '<tr><td colspan="9" style="text-align:center;padding:22px;color:#9a9594">No interface data — device unreachable.</td></tr>'}</tbody></table>
      <div class="ft">Kontrola Network Monitoring · Confidential</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to export the PDF.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
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
    renderFlagSummary();
    renderInfo(currentDevice);

    document.querySelectorAll('#range-seg .seg-btn').forEach(b => {
      b.addEventListener('click', () => setRange(b.dataset.range));
      b.classList.toggle('active', b.dataset.range === getRange());
    });
    renderGraphDetails(currentDevice);
    renderLatency(currentDevice);
    renderLoss(currentDevice);

    document.getElementById('if-search').addEventListener('input', e => { ifSearch = e.target.value; renderIfBody(); });
    document.querySelectorAll('#if-status-seg .seg-btn').forEach(b => {
      b.addEventListener('click', () => applyIfStatus(b.dataset.status));
    });
    renderSync(currentDevice);
    // export dropdown (CSV / PDF) for this device
    const exBtn = document.getElementById('dev-export-btn');
    const exPop = document.getElementById('dev-export-pop');
    if (exBtn && exPop) {
      exBtn.addEventListener('click', e => { e.stopPropagation(); exPop.classList.toggle('open'); });
      exPop.addEventListener('click', e => e.stopPropagation());
      exPop.querySelectorAll('[data-export]').forEach(b => {
        b.addEventListener('click', () => {
          exPop.classList.remove('open');
          if (b.dataset.export === 'csv') exportDeviceCSV(); else exportDevicePDF();
        });
      });
      document.addEventListener('click', () => exPop.classList.remove('open'));
    }
    window.addEventListener('resize', () => { clearTimeout(window.__rc); window.__rc = setTimeout(() => { renderGraphDetails(currentDevice); renderLatency(currentDevice); renderLoss(currentDevice); }, 200); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
