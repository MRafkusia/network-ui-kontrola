/* ===========================================================
   Kontrola — Infrastructure list page logic
   Shared helpers live in common.js (window.KCOMMON).
   Clicking a row opens the per-device detail page (same-tab navigation).
   =========================================================== */
(function () {
  const { DEVICES, TOOLS } = window.KONTROLA;
  const {
    has, NA, esc, orNA, fmtOr, fmtBytes, fmtUptime, fmtBps, fmtCompact, noData,
    stateBadge, statusDotColor, getFlag, aggregateByFlag, RANGES, getRange, setRangeVal, genTrend, drawChart, infoDot,
  } = window.KCOMMON;

  /* ===================== STATE ===================== */
  let savedLens = 'uplink';
  try { savedLens = localStorage.getItem('kontrola-lens') || 'uplink'; } catch (e) {}
  let state = { sortKey: 'name', sortDir: 1, search: '', perPage: 10, page: 1, quickFilter: null,
    lens: savedLens === 'downlink' ? 'downlink' : 'uplink', vendors: null };  // vendors: null = all selected

  const accessors = {
    name: d => (d.name || '').toLowerCase(),
    type: d => (d.type || '').toLowerCase(),
    ip: d => { const p = (d.ip || '').split('.').map(Number); return ((p[0] || 0) * 2 ** 24) + ((p[1] || 0) * 2 ** 16) + ((p[2] || 0) * 2 ** 8) + (p[3] || 0); },
    uptimeSec: d => has(d.uptimeSec) ? d.uptimeSec : -1,
    ports: d => { const a = aggregateByFlag(d, state.lens); return a ? a.up : -1; },
    rx: d => { const a = aggregateByFlag(d, state.lens); return a ? a.octIn : -1; },
    tx: d => { const a = aggregateByFlag(d, state.lens); return a ? a.octOut : -1; },
    oper: d => has(d.oper) ? d.oper : 99,
  };

  // devices that have at least one port flagged with the active lens role
  const lensParticipants = () => DEVICES.filter(d => aggregateByFlag(d, state.lens));

  // vendor list with per-vendor counts, scoped to the current lens participants
  function vendorList() {
    const m = new Map();
    lensParticipants().forEach(d => m.set(d.vendor, (m.get(d.vendor) || 0) + 1));
    return [...m.entries()].map(([vendor, count]) => ({ vendor, count }))
      .sort((a, b) => a.vendor.localeCompare(b.vendor));
  }
  // whole-page scope for the active lens: participating devices + summed port metrics
  function lensScope() {
    const role = state.lens;
    let devices = [], portsUp = 0, portsTotal = 0, octIn = 0, octOut = 0, errIn = 0, errOut = 0, errPorts = 0;
    DEVICES.forEach(d => {
      const a = aggregateByFlag(d, role);
      if (!a) return;
      devices.push(d);
      portsUp += a.up; portsTotal += a.total; octIn += a.octIn; octOut += a.octOut;
      a.ports.forEach(p => {
        const e = (p.errIn || 0) + (p.errOut || 0);
        errIn += p.errIn || 0; errOut += p.errOut || 0; if (e > 0) errPorts++;
      });
    });
    return { role, devices, portsUp, portsTotal, portsDown: portsTotal - portsUp, octIn, octOut, errIn, errOut, errPorts };
  }

  // quick filters that describe DEVICE-level status (not port-role metrics);
  // these should surface their devices even if the device has no ports in the active lens
  const DEVICE_LEVEL_QF = { down: 1, flapping: 1, muted: 1, monitored: 1, up: 1 };

  function filtered() {
    const q = state.search.trim().toLowerCase();
    const qf = state.quickFilter && QUICK[state.quickFilter];
    const deviceLevel = state.quickFilter && DEVICE_LEVEL_QF[state.quickFilter];
    let rows = DEVICES.filter(d => {
      // not part of this lens's monitoring group
      if (!deviceLevel && !aggregateByFlag(d, state.lens)) return false;
      if (state.vendors && !state.vendors.has(d.vendor)) return false;   // vendor filter
      if (qf && !qf.pred(d)) return false;
      if (!q) return true;
      return (d.name + ' ' + d.type + ' ' + d.ip + ' ' + d.location + ' ' + d.iface +
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

  /* ===================== SUMMARY METRIC CARDS (4×1) ===================== */

  // tiny sparkline rendered inside a rounded "capsule"
  function sparkPill(vals, color, fill) {
    const W = 240, H = 36, pad = 5;
    const min = Math.min(...vals), max = Math.max(...vals), rng = (max - min) || 1;
    const pts = vals.map((v, i) => [
      pad + (i / (vals.length - 1)) * (W - 2 * pad),
      H - pad - ((v - min) / rng) * (H - 2 * pad),
    ]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = fill
      ? `<path d="${d} L ${pts[pts.length - 1][0].toFixed(1)} ${H} L ${pts[0][0].toFixed(1)} ${H} Z" fill="${color}" opacity=".11"/>`
      : '';
    return `<div class="m-pill"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${area}<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  }

  function renderStats() {
    const G = window.KONTROLA.genSeries;
    const scope = lensScope();
    const role = scope.role;
    const cap = role === 'uplink' ? 'Uplink' : 'Downlink';
    const total = DEVICES.length;
    const inGroup = scope.devices.length;
    // device-level fleet counts still used by the Coverage card / downtime model
    const flapping = DEVICES.filter(d => d.oper === 3).length;
    const muted = DEVICES.filter(d => d.rx == null && d.tx == null).length;
    const monitored = total - muted;

    // ---- 1 · Availability of THIS role's links (port up-ratio over a 24h window) ----
    const downPorts = scope.portsDown;
    const winMin = 24 * 60;
    const downtimeMin = +(downPorts * 4.6 + flapping * 1.1).toFixed(1);
    const denom = Math.max(1, scope.portsTotal) * winMin;
    const sla = 100 - (downtimeMin / denom) * 100;
    const sla7 = 100 - (downtimeMin * 5.1) / (denom * 7) * 100;
    const slaOk = sla >= 99.90;

    // ---- 2 · Link errors on THIS role's ports (inbound + outbound) ----
    const errTotal = scope.errIn + scope.errOut;
    const errBad = errTotal > 4000;

    // ---- 3 · Coverage of this role group ----
    const coverage = total ? Math.round((inGroup / total) * 100) : 0;

    // ---- 4 · Throughput aggregated from the role's flagged, up ports ----
    const scale = role === 'uplink' ? 1 : 0.55;
    let inRate = 0; const siteRate = {};
    scope.devices.forEach(d => {
      if (!d.bandwidth) return;
      const util = ((d.spark && d.spark[d.spark.length - 1]) || 25) / 100;
      const r = d.bandwidth * util * 0.12 * scale;
      inRate += r;
      const site = (d.location || '').split('·')[0].trim();
      siteRate[site] = (siteRate[site] || 0) + r;
    });
    const outRate = inRate * (role === 'uplink' ? 0.82 : 0.93);
    const peak = inRate * 1.34;
    const topSite = (Object.entries(siteRate).sort((a, b) => b[1] - a[1])[0] || ['—'])[0];

    const cards = [
      // 1 — Link Availability (role-scoped)
      `<div class="card metric ${downPorts ? 'alert' : 'good'}">
        <div class="m-top"><span class="m-label">Availability${infoDot('Availability', 'Share of the active lens\u2019s ports that are operationally <b>up</b> over the last 24 hours, shown as an SLA against a 99.90% target.', 'Derived from each interface\u2019s operational status (<i>ifOperStatus</i>); downtime accrues while a flagged port reports down.')}</span><span class="m-badge">SLA · 24h</span></div>
        <div class="m-value">${sla.toFixed(2)}<span class="u">%</span></div>
        <div class="m-sub ${slaOk ? 'ok' : 'warn'}"><b>${scope.portsUp}/${scope.portsTotal}</b> ${role} ports up · target 99.90%</div>
        <div class="m-bottom">
          ${sparkPill(G(99.9, 0.12, 28).map(v => Math.min(100, v)), 'var(--good)', true)}
          <div class="m-foot">
            <button class="m-chip" data-filter="downports" title="Show devices with a down ${role} port"><b>${downPorts}</b> ports down</button>
            <span class="m-chip is-static" title="7-day rolling SLA">7d <b>${sla7.toFixed(2)}%</b></span>
          </div>
        </div>
      </div>`,

      // 2 — Link Errors (role-scoped)
      `<div class="card metric ${errBad ? 'warn' : 'good'}">
        <div class="m-top"><span class="m-label">Link Errors${infoDot('Link Errors', 'Total inbound + outbound packet errors on the active lens\u2019s ports — an early warning of a failing cable, SFP, or duplex mismatch <b>before</b> a link goes down.', 'Summed from each interface\u2019s error counters (<i>ifInErrors</i> + <i>ifOutErrors</i>) over 24h. Click <b>ports w/ errors</b> to list the affected devices.')}</span><span class="m-badge">In + Out · 24h</span></div>
        <div class="m-value">${fmtCompact(errTotal)}<span class="u">err</span></div>
        <div class="m-sub"><b>${fmtCompact(scope.errIn)}</b> in · <b>${fmtCompact(scope.errOut)}</b> out</div>
        <div class="m-bottom">
          ${sparkPill(G(errBad ? 60 : 18, errBad ? 16 : 6, 28), 'var(--orange)', true)}
          <div class="m-foot">
            <button class="m-chip" data-filter="errports" title="Show devices with errored ${role} ports"><b>${scope.errPorts}</b> ports w/ errors</button>
            <span class="m-chip is-static">of ${scope.portsTotal} ${role}</span>
          </div>
        </div>
      </div>`,

      // 3 — Coverage of the role group
      `<div class="card metric ${inGroup < total ? 'warn' : 'good'}">
        <div class="m-top"><span class="m-label">Coverage${infoDot('Coverage', 'How many devices have at least one port flagged with the active role, versus the whole fleet — your monitoring coverage for this lens.', 'Counts devices with ≥1 flagged port for the active lens. Open a device and set port roles to add it to this group.')}</span><span class="m-badge">Group vs Fleet</span></div>
        <div class="m-value">${inGroup}<span class="lbl">/ ${total} devices</span></div>
        <div class="m-sub"><b>${scope.portsTotal}</b> ports flagged as ${role}</div>
        <div class="m-bottom">
          <div class="m-barwrap"><span>In ${role} group</span><b>${coverage}%</b></div>
          <div class="m-bar"><span style="width:${coverage}%;background:var(--good)"></span></div>
          <div class="m-foot">
            <button class="m-chip" data-filter="monitored" title="Show monitored devices"><b>${monitored}</b> monitored</button>
            <button class="m-chip" data-filter="muted" title="Show devices not sending metrics"><b>${muted}</b> not reporting</button>
          </div>
        </div>
      </div>`,

      // 4 — Throughput (role-scoped)
      `<div class="card metric good">
        <div class="m-top"><span class="m-label">Throughput${infoDot('Throughput', 'Aggregate inbound and outbound traffic carried by the active lens\u2019s ports right now, with the 24h peak and the busiest site.', 'Per-port octet counters (<i>ifHCInOctets</i> / <i>ifHCOutOctets</i>) rated to bits per second and summed across the flagged ports.')}</span><span class="m-badge">Aggregate</span></div>
        <div class="m-value">${fmtBps(inRate)}<span class="lbl">in</span></div>
        <div class="m-value2">${fmtBps(outRate)}<span class="lbl">out</span></div>
        <div class="m-sub">Peak 24h: <b>${fmtBps(peak)}</b> · Top site: ${esc(topSite)}</div>
        <div class="m-bottom">
          ${sparkPill(G(42, 9, 28), 'var(--orange)', true)}
        </div>
      </div>`,
    ];

    const host = document.getElementById('stats');
    host.innerHTML = cards.join('');
    host.querySelectorAll('.m-chip[data-filter]').forEach(b => {
      b.addEventListener('click', () => applyQuickFilter(b.dataset.filter));
    });
  }

  /* ===================== QUICK FILTER (card → table) ===================== */
  const QUICK = {
    up:        { label: 'Devices up',            pred: d => d.oper === 1 },
    down:      { label: 'Devices down',          pred: d => d.oper === 2 || d.oper === 7 },
    flapping:  { label: 'Testing',               pred: d => d.oper === 3 },
    muted:     { label: 'Not reporting',          pred: d => d.rx == null && d.tx == null },
    monitored: { label: 'Monitored devices',     pred: d => !(d.rx == null && d.tx == null) },
    errports:  { label: 'Has link errors',        pred: d => { const a = aggregateByFlag(d, state.lens); return a && a.ports.some(p => (p.errIn || 0) + (p.errOut || 0) > 0); } },
    downports: { label: 'Has a down link',         pred: d => { const a = aggregateByFlag(d, state.lens); return a && a.up < a.total; } },
  };

  function applyQuickFilter(key) {
    state.quickFilter = state.quickFilter === key ? null : key;
    state.search = '';
    const sb = document.getElementById('search'); if (sb) sb.value = '';
    state.page = 1;
    renderFilterChip();
    syncStatusSeg();
    renderBody();
    const card = document.querySelector('.tablecard');
    if (card) window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 18, behavior: 'smooth' });
  }

  // Status segmented control (All / Up / Down) — drives the same quickFilter state
  function applyStatusFilter(status) {
    state.quickFilter = status === 'all' ? null : status;
    state.search = '';
    const sb = document.getElementById('search'); if (sb) sb.value = '';
    state.page = 1;
    renderFilterChip();
    syncStatusSeg();
    renderBody();
  }

  /* ===================== AGGREGATION LENS (uplink / downlink) ===================== */
  // The lens picks WHICH ports feed the table. Metrics aggregate only within one
  // role — never mixing uplink + downlink (that would double-count). No "All".
  function applyLens(lens) {
    if (lens !== 'uplink' && lens !== 'downlink') return;
    state.lens = lens;
    try { localStorage.setItem('kontrola-lens', lens); } catch (e) {}
    state.page = 1;
    topLinkPage = 0;
    syncLensSeg();
    updateScopeNote();
    updateTableSub();
    renderStats();      // summary cards follow the lens
    renderHead();
    renderVendorFilter(); // vendor list + counts follow the lens
    renderBody();        // device table follows the lens
    buildCharts();       // rebuild chart shells + legends (worst-device labels)
    renderCharts();      // overview charts follow the lens
  }

  /* ===================== VENDOR FILTER ===================== */
  function vendorBtnLabel() {
    const all = vendorList().length;
    const sel = state.vendors ? state.vendors.size : all;
    const badge = (state.vendors && sel < all) ? `<span class="vf-badge">${sel}</span>` : '';
    return `Vendor${badge}`;
  }
  function renderVendorFilter() {
    const btn = document.getElementById('vendor-btn');
    const pop = document.getElementById('vendor-pop');
    if (!btn || !pop) return;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="6" y="10" width="12" height="4" rx="1"/><rect x="9" y="16" width="6" height="4" rx="1"/></svg>${vendorBtnLabel()}<svg class="vf-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    btn.classList.toggle('has-filter', !!state.vendors);
    const list = vendorList();
    pop.innerHTML =
      `<div class="vf-head"><span>Filter by vendor</span>
        <div class="vf-acts"><button type="button" data-vf="all">All</button><button type="button" data-vf="none">None</button></div></div>
      <div class="vf-list">` +
      list.map(({ vendor, count }) => {
        const checked = !state.vendors || state.vendors.has(vendor);
        return `<label class="vf-row"><input type="checkbox" data-vendor="${esc(vendor)}" ${checked ? 'checked' : ''}>
          <span class="vf-name">${esc(vendor)}</span><span class="vf-count">${count}</span></label>`;
      }).join('') +
      `</div>`;
    pop.querySelectorAll('input[data-vendor]').forEach(cb => {
      cb.addEventListener('change', () => {
        const all = vendorList().map(v => v.vendor);
        const checked = [...pop.querySelectorAll('input[data-vendor]:checked')].map(c => c.dataset.vendor);
        state.vendors = (checked.length === all.length) ? null : new Set(checked);
        state.page = 1;
        renderVendorFilter(); pop.classList.add('open'); renderBody();
      });
    });
    pop.querySelectorAll('[data-vf]').forEach(b => {
      b.addEventListener('click', () => {
        state.vendors = b.dataset.vf === 'none' ? new Set() : null;
        state.page = 1;
        renderVendorFilter(); pop.classList.add('open'); renderBody();
      });
    });
  }
  function syncLensSeg() {
    document.querySelectorAll('#lens-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.lens === state.lens));
  }
  function updateScopeNote() {
    const el = document.getElementById('scope-note');
    if (!el) return;
    const n = lensParticipants().length;
    el.innerHTML = `Every metric, chart and device below is aggregated across each device's <b>${state.lens}</b> ports · <b>${n}</b> device${n === 1 ? '' : 's'} in scope`;
  }
  function updateTableSub() {
    const el = document.getElementById('table-sub');
    if (!el) return;
    const n = lensParticipants().length;
    el.innerHTML = `<b>${n}</b> device${n === 1 ? '' : 's'} in scope`;
  }

  function syncStatusSeg() {
    const seg = document.getElementById('status-seg');
    if (!seg) return;
    const active = state.quickFilter === 'up' ? 'up' : state.quickFilter === 'down' ? 'down' : (state.quickFilter ? '' : 'all');
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.status === active));
  }

  function renderFilterChip() {
    const el = document.getElementById('active-filter');
    if (!el) return;
    const q = state.quickFilter && QUICK[state.quickFilter];
    // Up / Down are already reflected in the status segmented control — showing a
    // duplicate "Filtered by…" chip is redundant, so suppress it for those.
    if (!q || state.quickFilter === 'up' || state.quickFilter === 'down') {
      el.hidden = true; el.innerHTML = ''; return;
    }
    const count = DEVICES.filter(q.pred).length;
    el.hidden = false;
    el.innerHTML = `
      <svg class="af-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
      <span class="af-label">${q.label}</span>
      <span class="af-count">${count}</span>
      <button id="clear-filter" aria-label="Clear filter" title="Clear filter">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>`;
    document.getElementById('clear-filter').addEventListener('click', () => {
      state.quickFilter = null; state.page = 1; renderFilterChip(); syncStatusSeg(); renderBody();
    });
  }

  /* ===================== TABLE ===================== */
  const COLS = [
    { key: 'name', label: 'Device', sort: true },
    { key: 'type', label: 'Type', sort: true },
    { key: 'ip', label: 'IP', sort: true },
    { key: 'uptimeSec', label: 'Uptime', sort: true },
    { key: 'ports', label: 'Interfaces', sort: true, num: true },
    { key: 'rx', label: 'Traffic In', sort: true, num: true },
    { key: 'tx', label: 'Traffic Out', sort: true, num: true },
    { key: 'oper', label: 'Status', sort: true },
  ];

  function portsCellAgg(a) {
    const up = a.up, tot = a.total;
    const cls = up === tot ? 'ok' : up === 0 ? 'bad' : 'warn';
    const pct = tot ? Math.round((up / tot) * 100) : 0;
    return `<span class="ports ${cls}" title="${up} of ${tot} ${state.lens} ports online">
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
      const participants = lensParticipants().length;
      if (state.quickFilter && DEVICE_LEVEL_QF[state.quickFilter]) {
        tb.innerHTML = `<tr><td colspan="${COLS.length}"><div class="empty">No devices match this filter.</div></td></tr>`;
      } else if (participants === 0) {
        tb.innerHTML = `<tr><td colspan="${COLS.length}">${noData('No data available — no ports are flagged as ' + state.lens + '. Open a device and set port roles to populate this view.')}</td></tr>`;
      } else {
        tb.innerHTML = `<tr><td colspan="${COLS.length}"><div class="empty">No devices match the current filters.</div></td></tr>`;
      }
    } else {
      tb.innerHTML = slice.map(d => {
        const a = aggregateByFlag(d, state.lens);   // null when device has no ports in this lens (e.g. a fully-down device shown via a status filter)
        const ifCell = a ? portsCellAgg(a) : '<span class="cell-dash">—</span>';
        const inCell = a ? fmtBytes(a.octIn) : '<span class="cell-dash">—</span>';
        const outCell = a ? fmtBytes(a.octOut) : '<span class="cell-dash">—</span>';
        return `<tr data-name="${esc(d.name)}" tabindex="0" title="Open ${esc(d.name)}">
          <td><div class="dev-name"><span class="dot" style="background:${statusDotColor(d)}"></span>
            <span class="meta"><b>${orNA(d.name)}</b></span></div></td>
          <td class="cell-type" title="${esc(d.type || '')}">${orNA(d.type)}</td>
          <td class="mono cell-ip">${orNA(d.ip)}</td>
          <td class="mono">${fmtOr(d.uptimeSec, fmtUptime)}</td>
          <td class="num">${ifCell}</td>
          <td class="num mono">${inCell}</td>
          <td class="num mono">${outCell}</td>
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

  /* ===================== NETWORK HEALTH OVERVIEW ===================== */
  // RTT & packet loss live on the per-device page (ICMP is device-level, not a
  // port-role metric). The overview keeps only the lens-driven traffic views.
  const METRICS = [
    // 1 — Throughput (in & out)
    { id: 'thr', type: 'line', title: 'Throughput', desc: 'Aggregate inbound / outbound traffic',
      what: 'Combined inbound (RX) and outbound (TX) traffic across every monitored interface in the fleet.',
      how: 'Polled from SNMP <i>ifHCInOctets</i> / <i>ifHCOutOctets</i> counters every 60s; the delta between samples is converted to bits per second.',
      fmtY: v => fmtBps(v), fmtVal: v => fmtBps(v),
      series: [
        { label: 'Inbound (RX)', color: 'var(--orange)', base: 6.2e9, jitter: 7e8, lo: 8e8, fill: true },
        { label: 'Outbound (TX)', color: '#2d6fd6', base: 4.0e9, jitter: 6e8, lo: 6e8 },
      ] },
    // 2 — Top Utilize Link (top 10 horizontal bars: device + port · max value)
    { id: 'toplink', type: 'bars', title: 'Top Utilize Link', desc: 'Top 10 links by peak utilization',
      what: 'The ten busiest interfaces in the active lens, ranked by peak utilization against link capacity — each bar is one device + port.',
      how: 'Per-interface octet counters (<i>ifHCInOctets</i> + <i>ifHCOutOctets</i>) are rated to bps and divided by the interface capacity (<i>ifSpeed</i>) to give % utilization.' },
  ];

  // build the ranked link list from per-interface counters vs link capacity
  // — restricted to ports flagged with the active lens role
  function topLinks(limit) {
    const role = state.lens;
    const links = [];
    DEVICES.forEach(d => {
      if (!d.interfaces || !d.bandwidth) return;
      d.interfaces.forEach(ifc => {
        if (!ifc.operUp) return;
        if (getFlag(d.name, ifc) !== role) return;   // only this role's links
        // load vs capacity → log score (octet counters are power-law distributed)
        const ratio = (ifc.octIn + ifc.octOut) / d.bandwidth;
        links.push({ dev: d.name, port: ifc.name, score: Math.log10(ratio + 1e-9) });
      });
    });
    if (!links.length) return [];
    links.sort((a, b) => b.score - a.score);
    const top = links.slice(0, limit);
    // map the top-N's own score range onto a believable utilization band (96→56%)
    const hi = top[0].score, lo = top[top.length - 1].score, span = (hi - lo) || 1;
    top.forEach(l => { l.pct = Math.round(96 - ((hi - l.score) / span) * 40); });
    return top;
  }

  let topLinkPage = 0; // Top Utilize Link: 0 = ranks 1–5, 1 = ranks 6–10
  function renderTopLinks(el, page) {
    const all = topLinks(10);
    if (!all.length) { el.innerHTML = noData(); return; }
    const per = 5, start = (page || 0) * per;
    const rows = all.slice(start, start + per);
    el.innerHTML = '<div class="barlist">' + rows.map((l, i) => {
      const cls = l.pct >= 85 ? 'hi' : l.pct >= 60 ? 'mid' : 'lo';
      return `<div class="barrow">
        <span class="brk">${start + i + 1}</span>
        <span class="blab" title="${esc(l.dev)} · ${esc(l.port)}"><b>${esc(l.dev)}</b><span>${esc(l.port)}</span></span>
        <span class="btrack"><span class="bfill ${cls}" style="width:${l.pct}%"></span></span>
        <span class="bval">${l.pct}%</span>
      </div>`;
    }).join('') + '</div>';
  }

  // per-metric multiplier so the charts visibly reflect the lens
  const lensFactor = id => ({
    thr:  state.lens === 'uplink' ? 1.00 : 0.55,
  }[id] || 1);

  function buildCharts() {
    const host = document.getElementById('charts');
    host.innerHTML = METRICS.map(m => {
      if (m.type === 'bars') {
        return `<div class="card chartcard barcard">
          <div class="chd">
            <div><h3>${m.title}${infoDot(m.title, m.what, m.how)}</h3><p class="chsub">${m.desc}</p></div>
            <div class="bar-seg" id="seg-${m.id}" role="tablist" aria-label="Rank range">
              <button class="bseg-btn active" data-pg="0">1–5</button>
              <button class="bseg-btn" data-pg="1">6–10</button>
            </div>
          </div>
          <div id="chart-${m.id}" class="barbody"></div>
        </div>`;
      }
      return `<div class="card chartcard">
        <div class="chd">
          <div><h3>${m.title}${infoDot(m.title, m.what, m.how)}</h3><p class="chsub">${m.desc}</p></div>
          <div class="now"><b id="now-${m.id}">—</b><span>now</span></div>
        </div>
        <div class="legend">
          ${m.series.map(s => `<i><b style="background:${s.color}${s.dashed ? ';opacity:.7' : ''}"></b>${s.label}</i>`).join('')}
        </div>
        <div id="chart-${m.id}"></div>
      </div>`;
    }).join('');

    // wire the Top Utilize Link page switch (1–5 / 6–10)
    const seg = document.getElementById('seg-toplink');
    if (seg) {
      seg.querySelectorAll('.bseg-btn').forEach(b => {
        b.addEventListener('click', () => {
          topLinkPage = +b.dataset.pg;
          seg.querySelectorAll('.bseg-btn').forEach(x => x.classList.toggle('active', x === b));
          renderTopLinks(document.getElementById('chart-toplink'), topLinkPage);
        });
      });
    }
  }

  function renderCharts() {
    const range = getRange();
    METRICS.forEach(m => {
      if (m.type === 'bars') { renderTopLinks(document.getElementById('chart-' + m.id), topLinkPage); return; }
      const r = RANGES[range];
      const f = lensFactor(m.id);
      const series = m.series.map(s => ({
        label: s.label, color: s.color, dashed: s.dashed, fill: s.fill,
        data: genTrend(s.base * f, s.jitter, r.n, s.lo != null ? s.lo * f : s.lo, s.hi),
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
    const { STATE } = window.KONTROLA;
    const rows = filtered();
    const headers = ['Device Name', 'Device Type', 'IANA Register', 'Uptime', 'Contact', 'Location', 'Services',
      'Aggregation Lens', 'Flagged Ports Up', 'Flagged Ports Total', 'Traffic In (bytes)', 'Traffic Out (bytes)', 'IP Address',
      'Administrative State', 'Operational State'];
    const lines = [headers.join(',')];
    rows.forEach(d => {
      const a = aggregateByFlag(d, state.lens) || { up: null, total: null, octIn: null, octOut: null };
      const cells = [d.name, d.type, d.iana, fmtUptime(d.uptimeSec), d.contact, d.location, d.services,
        state.lens, a.up, a.total, a.octIn, a.octOut, d.ip, STATE[d.admin], STATE[d.oper]];
      lines.push(cells.map(c => { const s = has(c) ? String(c) : 'N/A'; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kontrola-network-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ===================== PDF (print) ===================== */
  function exportPDF() {
    const { STATE } = window.KONTROLA;
    const rows = filtered();
    const now = new Date();
    const stamp = now.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const cap = state.lens === 'uplink' ? 'Uplink' : 'Downlink';
    // active-filter summary line
    const bits = [`${cap} lens`];
    if (state.vendors) bits.push(`Vendors: ${[...state.vendors].sort().join(', ') || 'none'}`);
    if (state.quickFilter && QUICK[state.quickFilter]) bits.push(QUICK[state.quickFilter].label);
    if (state.search.trim()) bits.push(`Search: "${state.search.trim()}"`);

    const body = rows.map(d => {
      const a = aggregateByFlag(d, state.lens);
      const ifc = a ? `${a.up}/${a.total}` : '—';
      const tin = a ? fmtBytes(a.octIn) : '—';
      const tout = a ? fmtBytes(a.octOut) : '—';
      const st = STATE[d.oper] || 'N/A';
      const stCls = d.oper === 1 ? 'up' : (d.oper === 2 || d.oper === 7) ? 'down' : 'warn';
      return `<tr>
        <td class="nm">${esc(d.name)}</td><td>${esc(d.type || '—')}</td>
        <td class="mono">${esc(d.ip || '—')}</td><td class="mono">${has(d.uptimeSec) ? fmtUptime(d.uptimeSec) : '—'}</td>
        <td class="r mono">${ifc}</td><td class="r mono">${tin}</td><td class="r mono">${tout}</td>
        <td><span class="st ${stCls}">${esc(st)}</span></td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kontrola — Device Report</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #241F20; margin: 32px; }
        .rh { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 3px solid #E25716; padding-bottom: 12px; margin-bottom: 4px; }
        .brand { font-size: 22px; font-weight: 800; color: #E25716; letter-spacing: -.01em; }
        .brand span { color: #241F20; }
        .rh .meta { text-align: right; font-size: 11px; color: #6c6766; line-height: 1.5; }
        h1 { font-size: 15px; margin: 16px 0 3px; }
        .sub { font-size: 11.5px; color: #6c6766; margin-bottom: 14px; }
        .sub b { color: #241F20; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        thead th { background: #E25716; color: #fff; text-align: left; font-size: 9.5px; letter-spacing: .04em;
          text-transform: uppercase; padding: 8px 9px; }
        thead th.r { text-align: right; }
        tbody td { padding: 7px 9px; border-bottom: 1px solid #ececec; }
        tbody tr:nth-child(even) { background: #faf8f7; }
        td.r { text-align: right; } td.nm { font-weight: 700; } .mono { font-variant-numeric: tabular-nums; }
        .st { font-size: 9.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; }
        .st.up { background: #e6f4ec; color: #1f8a4c; } .st.down { background: #fdeaea; color: #d23b3b; } .st.warn { background: #fdf0e3; color: #c8730f; }
        .ft { margin-top: 16px; font-size: 10px; color: #9a9594; text-align: center; }
        @media print { body { margin: 14mm; } thead { display: table-header-group; } }
      </style></head><body>
      <div class="rh"><div class="brand">‹ kontrola<span> / network</span></div>
        <div class="meta">Device Report · tristek<br>Generated ${stamp}</div></div>
      <h1>Device Inventory</h1>
      <div class="sub">${esc(bits.join('  ·  '))}  ·  <b>${rows.length}</b> device${rows.length === 1 ? '' : 's'}</div>
      <table><thead><tr>
        <th>Device</th><th>Type</th><th>IP</th><th>Uptime</th>
        <th class="r">Interfaces</th><th class="r">Traffic In</th><th class="r">Traffic Out</th><th>Status</th>
      </tr></thead><tbody>${body || '<tr><td colspan="8" style="text-align:center;padding:24px;color:#9a9594">No devices match the current filters.</td></tr>'}</tbody></table>
      <div class="ft">Kontrola Network Monitoring · ${cap} aggregation · Confidential</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to export the PDF.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
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
    syncLensSeg();
    updateScopeNote();
    updateTableSub();
    renderVendorFilter();
    renderBody();
    buildCharts();

    document.querySelectorAll('#range-seg .seg-btn').forEach(b => {
      b.addEventListener('click', () => setRange(b.dataset.range));
    });
    document.querySelectorAll('#range-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.range === getRange()));

    applyTheme(saved); // also triggers first renderCharts()

    document.getElementById('search').addEventListener('input', e => { state.search = e.target.value; state.quickFilter = null; renderFilterChip(); syncStatusSeg(); state.page = 1; renderBody(); });
    document.querySelectorAll('#status-seg .seg-btn').forEach(b => {
      b.addEventListener('click', () => applyStatusFilter(b.dataset.status));
    });
    document.querySelectorAll('#lens-seg .seg-btn').forEach(b => {
      b.addEventListener('click', () => applyLens(b.dataset.lens));
    });
    // vendor filter open/close
    const vbtn = document.getElementById('vendor-btn');
    const vpop = document.getElementById('vendor-pop');
    vbtn.addEventListener('click', e => { e.stopPropagation(); vpop.classList.toggle('open'); });
    vpop.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => vpop.classList.remove('open'));
    document.getElementById('perpage').addEventListener('change', e => { state.perPage = +e.target.value; state.page = 1; renderBody(); });
    // export dropdown (CSV / PDF)
    const exBtn = document.getElementById('export-btn');
    const exPop = document.getElementById('export-pop');
    exBtn.addEventListener('click', e => { e.stopPropagation(); exPop.classList.toggle('open'); });
    exPop.addEventListener('click', e => e.stopPropagation());
    exPop.querySelectorAll('[data-export]').forEach(b => {
      b.addEventListener('click', () => {
        exPop.classList.remove('open');
        if (b.dataset.export === 'csv') downloadCSV(); else exportPDF();
      });
    });
    document.addEventListener('click', () => exPop.classList.remove('open'));
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    window.addEventListener('resize', () => { clearTimeout(window.__rc); window.__rc = setTimeout(renderCharts, 200); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
