/* ===========================================================
   Kontrola — shared helpers (used by both the Infrastructure
   list page and the per-device detail page)
   Load order: data.js → common.js → (app.js | device.js)
   =========================================================== */
(function () {
  const { STATE } = window.KONTROLA;

  /* ---------- missing-data helpers ---------- */
  function has(v) {
    return v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v));
  }
  const NA = '<span class="na" title="No data available">N/A</span>';
  const esc = (str) => String(str).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const orNA = (v) => has(v) ? esc(v) : NA;
  const fmtOr = (v, fmt) => { if (!has(v)) return NA; const r = fmt(v); return has(r) ? r : NA; };
  function noData(label) {
    return `<div class="nodata"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l3-3 3 2.5 4-5.5" opacity=".5"/><line x1="4" y1="4" x2="20" y2="20"/></svg><span>${label || 'No data available'}</span></div>`;
  }

  /* ---------- metric info affordance ----------
     Small "i" button next to a chart title. On hover/focus it reveals a
     popover explaining WHAT the metric is and HOW the data is collected. */
  function infoDot(title, what, how) {
    const ic = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.7" r="1.05" fill="currentColor" stroke="none"/></svg>';
    return `<span class="metric-info" tabindex="0" role="button" aria-label="About ${esc(title)}">${ic}` +
      `<span class="metric-info-pop" role="tooltip"><b>${esc(title)}</b>` +
      `<span class="mi-what">${what}</span>` +
      `<span class="mi-how"><b>How it's measured</b>${how}</span></span></span>`;
  }

  /* ---------- formatting (null-safe: return null when no value) ---------- */
  function fmtBytes(n) {
    if (!has(n)) return null;
    if (n === 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(n) / Math.log(1024));
    const v = n / Math.pow(1024, i);
    return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + u[i];
  }
  function fmtBps(n) {
    if (!has(n)) return null;
    if (n === 0) return '0 bps';
    const u = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    const i = Math.floor(Math.log(n) / Math.log(1000));
    const v = n / Math.pow(1000, i);
    const s = v >= 100 ? v.toFixed(0) : (Number.isInteger(v) ? String(v) : v.toFixed(1));
    return s + ' ' + u[i];
  }
  function fmtUptime(s) {
    if (!has(s)) return null;
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }
  // compact SI count: 1760000000 → "1.76G", 208000 → "208k", 4470 → "4.47k"
  function fmtCompact(n) {
    if (!has(n)) return null;
    n = Math.round(n);
    if (Math.abs(n) < 1000) return String(n);
    const u = ['', 'k', 'M', 'G', 'T', 'P'];
    const i = Math.min(u.length - 1, Math.floor(Math.log10(Math.abs(n)) / 3));
    const v = n / Math.pow(1000, i);
    const s = v >= 100 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, '');
    return s + u[i];
  }

  /* ---------- status badges ---------- */
  function stateBadge(code) {
    if (!has(code)) return '<span class="badge st-na"><span class="bdot"></span>N/A</span>';
    const label = STATE[code] || 'unknown';
    let cls = 'st-test';
    if (code === 1) cls = 'st-up';
    else if (code === 2 || code === 7) cls = 'st-down';
    return `<span class="badge ${cls}"><span class="bdot"></span>${label}</span>`;
  }
  function statusDotColor(d) {
    if (!has(d.oper)) return 'var(--text-faint)';
    if (d.oper === 1) return 'var(--good)';
    if (d.oper === 2 || d.oper === 7) return 'var(--bad)';
    return 'var(--warn)';
  }

  /* ---------- port role flagging (uplink / downlink / unset) ----------
     STATUS (up/down/testing) is operational, comes from the device, read-only.
     FLAG is a user annotation of each port's ROLE. The two are orthogonal.
     Flags persist in localStorage; a stored value (incl. 'unset') overrides the seed. */
  const FLAG_KEY = 'kontrola-port-flags';
  function loadFlags() { try { return JSON.parse(localStorage.getItem(FLAG_KEY) || '{}'); } catch (e) { return {}; } }
  function saveFlags(o) { try { localStorage.setItem(FLAG_KEY, JSON.stringify(o)); } catch (e) {} }
  const flagKeyOf = (devName, ifName) => devName + '\u241F' + ifName;
  function getFlag(devName, ifc) {
    const o = loadFlags(); const k = flagKeyOf(devName, ifc.name);
    return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : (ifc.flag || 'unset');
  }
  function setFlag(devName, ifName, val) {
    const o = loadFlags(); o[flagKeyOf(devName, ifName)] = val; saveFlags(o);
  }
  // Aggregate the traffic/up-count of a device's ports that carry a given role.
  // Returns null when the device has no ports flagged with that role (→ excluded from the lens).
  function aggregateByFlag(d, role) {
    if (!d || !d.interfaces) return null;
    const ports = d.interfaces.filter(it => getFlag(d.name, it) === role);
    if (!ports.length) return null;
    let up = 0, octIn = 0, octOut = 0;
    ports.forEach(p => { if (p.operUp) { up++; octIn += p.octIn || 0; octOut += p.octOut || 0; } });
    return { total: ports.length, up, octIn, octOut, ports };
  }
  function flagCounts(d) {
    const c = { uplink: { up: 0, total: 0 }, downlink: { up: 0, total: 0 }, unset: 0 };
    if (!d || !d.interfaces) return c;
    d.interfaces.forEach(it => {
      const f = getFlag(d.name, it);
      if (f === 'uplink' || f === 'downlink') { c[f].total++; if (it.operUp) c[f].up++; }
      else c.unset++;
    });
    return c;
  }

  /* ===================== TIME RANGES ===================== */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pad2 = x => String(x).padStart(2, '0');
  const RANGES = {
    hourly:  { label: 'Hourly',  n: 60, spanMs: 60 * 60 * 1000,
               fmt: t => `${pad2(t.getHours())}:${pad2(t.getMinutes())}`,
               tip: t => `${pad2(t.getHours())}:${pad2(t.getMinutes())}` },
    weekly:  { label: 'Weekly',  n: 84, spanMs: 7 * 24 * 3600 * 1000,
               fmt: t => DOW[t.getDay()],
               tip: t => `${DOW[t.getDay()]} ${pad2(t.getHours())}:00` },
    monthly: { label: 'Monthly', n: 90, spanMs: 30 * 24 * 3600 * 1000,
               fmt: t => `${MON[t.getMonth()]} ${t.getDate()}`,
               tip: t => `${MON[t.getMonth()]} ${t.getDate()}` },
  };
  let CURRENT = 'hourly';
  try { CURRENT = localStorage.getItem('kontrola-range') || 'hourly'; } catch (e) {}
  const getRange = () => RANGES[CURRENT] ? CURRENT : 'hourly';
  function setRangeVal(r) { if (!RANGES[r]) return; CURRENT = r; try { localStorage.setItem('kontrola-range', r); } catch (e) {} }

  function timeAt(range, i, n) {
    const r = RANGES[range];
    return new Date(Date.now() - (n - 1 - i) * (r.spanMs / (n - 1)));
  }
  function genTrend(base, jitter, n, lo, hi) {
    const a = []; let v = base;
    for (let i = 0; i < n; i++) {
      v += (Math.random() - 0.5) * jitter;
      if (lo != null) v = Math.max(lo, v);
      if (hi != null) v = Math.min(hi, v);
      a.push(v);
    }
    return a;
  }

  /* ===================== UNIFIED CHART ===================== */
  // cfg: { series:[{label,color,data,dashed,fill}], range, yMax, fmtY, fmtVal }
  function drawChart(el, cfg) {
    const hasData = cfg.series && cfg.series.length &&
      cfg.series.some(s => Array.isArray(s.data) && s.data.length && s.data.some(has));
    if (!hasData) { el.innerHTML = noData(); return; }
    const H = 172, padL = 6, padR = 6, padT = 14, padB = 30;
    const W = Math.max(280, Math.round(el.clientWidth || el.getBoundingClientRect().width || 600));
    const range = cfg.range || getRange();
    const r = RANGES[range];
    const n = cfg.series[0].data.length;
    const allVals = cfg.series.reduce((a, s) => a.concat(s.data), []);
    const niceCeil = (v) => {
      if (!(v > 0)) return 1;
      const pow = Math.pow(10, Math.floor(Math.log10(v)));
      const f = v / pow;
      const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 8 ? 8 : 10;
      return nf * pow;
    };
    const yMax = (cfg.yMax != null ? cfg.yMax : niceCeil(Math.max(...allVals, 1) * 1.05)) || 1;
    const xfor = i => padL + (i / (n - 1)) * (W - padL - padR);
    const yfor = v => padT + (1 - v / yMax) * (H - padT - padB);
    const fmtY = cfg.fmtY || (v => Math.round(v));
    const fmtVal = cfg.fmtVal || (v => Math.round(v));

    let grid = '';
    for (let g = 0; g <= 4; g++) {
      const v = yMax * g / 4, y = yfor(v);
      grid += `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="var(--grid-line)" stroke-width="1"/>`;
      grid += `<text x="${W - 2}" y="${(y - 3).toFixed(1)}" text-anchor="end" font-size="9" paint-order="stroke" stroke="var(--card-bg)" stroke-width="3" stroke-linejoin="round" fill="var(--text-faint)">${fmtY(v)}</text>`;
    }
    let xlabels = '';
    const TICKS = 6;
    for (let k = 0; k <= TICKS; k++) {
      const i = Math.round(k / TICKS * (n - 1));
      const x = xfor(i);
      const t = timeAt(range, i, n);
      const anchor = k === 0 ? 'start' : k === TICKS ? 'end' : 'middle';
      grid += `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${H - padB}" stroke="var(--grid-line)" stroke-width="1" opacity=".55"/>`;
      xlabels += `<text x="${x.toFixed(1)}" y="${H - 9}" text-anchor="${anchor}" font-size="9.5" fill="var(--text-faint)">${r.fmt(t)}</text>`;
    }

    let paths = '';
    cfg.series.forEach((s, si) => {
      const pts = s.data.map((v, i) => [xfor(i), yfor(v)]);
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      if (s.fill) {
        const area = line + ` L${xfor(n - 1).toFixed(1)} ${H - padB} L${padL} ${H - padB} Z`;
        const gid = 'g' + Math.random().toString(36).slice(2, 8);
        paths += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${s.color}" stop-opacity=".22"/>
          <stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>`;
        paths += `<path d="${area}" fill="url(#${gid})"/>`;
      }
      paths += `<path d="${line}" fill="none" stroke="${s.color}" stroke-width="${si === 0 ? 2.2 : 1.7}" stroke-linejoin="round" stroke-linecap="round" ${s.dashed ? 'stroke-dasharray="4 4" opacity=".75"' : ''}/>`;
    });

    const hover = `<g class="hov" style="opacity:0">
      <line x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--orange)" stroke-width="1" opacity=".55"/>
      ${cfg.series.map(s => `<circle r="3.5" fill="${s.color}" stroke="var(--card-bg)" stroke-width="1.5"/>`).join('')}
    </g>`;

    el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${grid}${paths}${hover}${xlabels}
      <rect x="0" y="0" width="${W}" height="${H}" fill="transparent" class="hit"/></svg>`;

    const svg = el.querySelector('svg');
    const hov = svg.querySelector('.hov');
    const circles = hov.querySelectorAll('circle');
    const vline = hov.querySelector('line');
    const tip = document.getElementById('chart-tip');
    if (!tip) return;

    svg.querySelector('.hit').addEventListener('mousemove', e => {
      const rect = svg.getBoundingClientRect();
      let i = Math.round(((e.clientX - rect.left) / rect.width) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      const x = xfor(i);
      vline.setAttribute('x1', x); vline.setAttribute('x2', x);
      circles.forEach((c, si) => { c.setAttribute('cx', x); c.setAttribute('cy', yfor(cfg.series[si].data[i])); });
      hov.style.opacity = 1;
      const t = timeAt(range, i, n);
      tip.innerHTML = `<div style="font-weight:700;margin-bottom:3px">${r.tip(t)}</div>` +
        cfg.series.map(s => `<div style="display:flex;gap:12px;justify-content:space-between"><span style="color:#bbb">${s.label}</span><b>${fmtVal(s.data[i])}</b></div>`).join('');
      tip.style.left = e.clientX + 'px';
      tip.style.top = (rect.top + yfor(cfg.series[0].data[i])) + 'px';
      tip.classList.add('show');
    });
    svg.querySelector('.hit').addEventListener('mouseleave', () => { hov.style.opacity = 0; tip.classList.remove('show'); });
  }

  window.KCOMMON = {
    has, NA, esc, orNA, fmtOr, noData, infoDot,
    fmtBytes, fmtBps, fmtUptime, fmtCompact,
    stateBadge, statusDotColor,
    getFlag, setFlag, aggregateByFlag, flagCounts,
    RANGES, getRange, setRangeVal, timeAt, genTrend, drawChart,
  };
})();
