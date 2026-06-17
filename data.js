/* ===========================================================
   Kontrola — dummy infrastructure dataset
   Fields modelled on the SNMP sheet provided.
   =========================================================== */

// Tools that can monitor a device (data sources / integrations)
const TOOLS = {
  zabbix:    'Zabbix',
  datadog:   'Datadog',
  librenms:  'LibreNMS',
  smokeping: 'Smokeping',
};

// ifType lookup (IANAifType)
const IFTYPE = {
  6: 'ethernetCsmacd', 1: 'other', 209: 'ieee8023adLag',
  135: 'l2vlan', 53: 'propVirtual', 131: 'tunnel', 24: 'softwareLoopback',
};
// Administrative / Operational state lookup
const STATE = { 1: 'up', 2: 'down', 3: 'testing', 4: 'unknown', 5: 'dormant', 6: 'notPresent', 7: 'lowerLayerDown' };

// helper to build a believable 24-point sparkline
function genSeries(base, jitter, n) {
  const a = []; let v = base;
  for (let i = 0; i < n; i++) { v += (Math.random() - 0.48) * jitter; v = Math.max(0, Math.min(100, v)); a.push(+v.toFixed(1)); }
  return a;
}

const DEVICES = [
  { name:'MikroTik', type:'RouterOS C52iG-5HaxD2HaxD', iana:'iso.3.6.1.4.1.14988.1', uptimeSec:1758313, contact:'noc@tristek.id', location:'DC Jakarta · Rack A1', services:78, iface:'ether1', rx:441929235, tx:53661877, ifType:6, mtu:1500, bandwidth:1000000000, mac:'78:9A:18:E6:91:69', admin:1, oper:1, sources:['zabbix','librenms','smokeping'], cpu:18, mem:42, disk:31 },
  { name:'Core-SW-01', type:'Cisco Catalyst 9300-48P', iana:'iso.3.6.1.4.1.9.1.2494', uptimeSec:9123440, contact:'noc@tristek.id', location:'DC Jakarta · Rack A2', services:72, iface:'GigabitEthernet1/0/1', rx:8841092334, tx:7732910882, ifType:6, mtu:9000, bandwidth:10000000000, mac:'00:1A:2B:3C:4D:5E', admin:1, oper:1, sources:['zabbix','datadog'], cpu:34, mem:58, disk:44 },
  { name:'Edge-FW-01', type:'Fortinet FortiGate 200F', iana:'iso.3.6.1.4.1.12356.101', uptimeSec:4502211, contact:'security@tristek.id', location:'DC Jakarta · Rack B1', services:64, iface:'wan1', rx:23410982334, tx:19922110782, ifType:6, mtu:1500, bandwidth:1000000000, mac:'90:6C:AC:11:22:33', admin:1, oper:1, sources:['zabbix','datadog','smokeping'], cpu:52, mem:67, disk:39 },
  { name:'DB-Node-03', type:'Dell PowerEdge R650', iana:'iso.3.6.1.4.1.674.10892.5', uptimeSec:6602190, contact:'dba@tristek.id', location:'DC Surabaya · Rack C2', services:72, iface:'eno1', rx:120349881234, tx:98221330871, ifType:6, mtu:1500, bandwidth:25000000000, mac:'F4:8E:38:AA:BB:CC', admin:1, oper:1, sources:['datadog','librenms'], cpu:71, mem:84, disk:62 },
  { name:'AP-Lobby-02', type:'Ubiquiti UniFi U6-Pro', iana:'iso.3.6.1.4.1.41112', uptimeSec:332190, contact:'it@tristek.id', location:'HQ Jakarta · Lobby', services:6, iface:'ath0', rx:9923440123, tx:14409912334, ifType:6, mtu:1500, bandwidth:1000000000, mac:'68:D7:9A:44:55:66', admin:1, oper:1, sources:['librenms'], cpu:12, mem:29, disk:18 },
  { name:'Edge-RT-02', type:'Juniper MX204', iana:'iso.3.6.1.4.1.2636.1.1.1.2', uptimeSec:15403220, contact:'noc@tristek.id', location:'DC Jakarta · Rack B2', services:78, iface:'xe-0/0/2', rx:884412093312, tx:773291088234, ifType:6, mtu:9192, bandwidth:100000000000, mac:'3C:61:04:DD:EE:11', admin:1, oper:1, sources:['zabbix','librenms','smokeping'], cpu:41, mem:53, disk:48 },
  { name:'Web-LB-01', type:'F5 BIG-IP i2800', iana:'iso.3.6.1.4.1.3375.2', uptimeSec:2209111, contact:'web@tristek.id', location:'DC Jakarta · Rack A3', services:72, iface:'1.1', rx:33410982334, tx:41922110782, ifType:6, mtu:1500, bandwidth:10000000000, mac:'00:23:E9:77:88:99', admin:1, oper:1, sources:['datadog','smokeping'], cpu:28, mem:46, disk:33 },
  { name:'Cam-NVR-01', type:'Hikvision DS-9664NI', iana:'iso.3.6.1.4.1.39165', uptimeSec:null, contact:'security@tristek.id', location:'HQ Jakarta · Rack S1', services:14, iface:'eth0', rx:null, tx:null, ifType:6, mtu:1500, bandwidth:null, mac:'C0:56:E3:AB:CD:01', admin:1, oper:2, sources:['librenms','smokeping'], cpu:9, mem:22, disk:91 },
  { name:'App-Node-07', type:'HPE ProLiant DL380 Gen11', iana:'iso.3.6.1.4.1.232', uptimeSec:5102330, contact:'app@tristek.id', location:'DC Surabaya · Rack C1', services:72, iface:'ens192', rx:67340988123, tx:55221130872, ifType:6, mtu:1500, bandwidth:25000000000, mac:'48:DF:37:12:34:56', admin:1, oper:1, sources:['datadog','zabbix'], cpu:63, mem:77, disk:55 },
  { name:'Dist-SW-04', type:'Aruba CX 6300M', iana:'iso.3.6.1.4.1.47196', uptimeSec:7720112, contact:'noc@tristek.id', location:'HQ Jakarta · Rack N2', services:72, iface:'1/1/1', rx:5541092334, tx:4732910882, ifType:209, mtu:9000, bandwidth:10000000000, mac:'94:F1:28:65:43:21', admin:1, oper:1, sources:['zabbix','librenms'], cpu:23, mem:38, disk:27 },
  { name:'VPN-GW-01', type:'pfSense Netgate 6100', iana:'iso.3.6.1.4.1.12325', uptimeSec:1209340, contact:'security@tristek.id', location:'DC Jakarta · Rack B3', services:78, iface:'igb0', rx:8841092334, tx:6732910882, ifType:6, mtu:1500, bandwidth:1000000000, mac:'00:08:A2:0E:1F:2A', admin:1, oper:1, sources:['zabbix','smokeping'], cpu:31, mem:44, disk:36 },
  { name:'Mail-Node-02', type:'Dell PowerEdge R750', iana:'iso.3.6.1.4.1.674.10892.5', uptimeSec:3320990, contact:'mail@tristek.id', location:'DC Surabaya · Rack C3', services:72, iface:'eno2', rx:23410982334, tx:31922110782, ifType:6, mtu:1500, bandwidth:10000000000, mac:'D0:94:66:33:44:55', admin:1, oper:1, sources:['datadog','librenms'], cpu:46, mem:61, disk:49 },
  { name:'Bckp-Node-01', type:'Synology RS4021xs+', iana:'iso.3.6.1.4.1.6574', uptimeSec:10209340, contact:'it@tristek.id', location:'DC Surabaya · Rack D1', services:14, iface:'bond0', rx:341929235123, tx:13661877234, ifType:209, mtu:9000, bandwidth:10000000000, mac:'00:11:32:AA:01:02', admin:1, oper:1, sources:['librenms'], cpu:15, mem:33, disk:88 },
  { name:'Edge-RT-03', type:'MikroTik CCR2004-1G-12S+2XS', iana:'iso.3.6.1.4.1.14988.1', uptimeSec:6602190, contact:'noc@tristek.id', location:'DC Jakarta · Rack B1', services:78, iface:'sfp-sfpplus1', rx:184412093312, tx:173291088234, ifType:6, mtu:9000, bandwidth:10000000000, mac:'48:8F:5A:78:90:AB', admin:1, oper:3, sources:['zabbix','librenms','smokeping'], cpu:38, mem:49, disk:42 },
  { name:'Access-SW-09', type:'Cisco Catalyst 2960-X', iana:'iso.3.6.1.4.1.9.1.1208', uptimeSec:null, contact:null, location:'HQ Jakarta · Floor 3', services:72, iface:'FastEthernet0/9', rx:null, tx:null, ifType:6, mtu:null, bandwidth:100000000, mac:null, admin:2, oper:2, sources:['librenms'], cpu:8, mem:21, disk:14 },
  { name:'GPU-Node-01', type:'Supermicro AS-4125GS', iana:'iso.3.6.1.4.1.10876', uptimeSec:902330, contact:'ml@tristek.id', location:'DC Surabaya · Rack E1', services:72, iface:'ens6f0', rx:980340988123, tx:885221130872, ifType:6, mtu:9000, bandwidth:100000000000, mac:'AC:1F:6B:11:22:CC', admin:1, oper:1, sources:['datadog'], cpu:88, mem:91, disk:67 },
  { name:'Edge-FW-02', type:'Palo Alto PA-3410', iana:'iso.3.6.1.4.1.25461', uptimeSec:4012330, contact:'security@tristek.id', location:'DC Surabaya · Rack C4', services:64, iface:'ethernet1/1', rx:53410982334, tx:49922110782, ifType:6, mtu:1500, bandwidth:10000000000, mac:'00:1B:17:55:66:77', admin:1, oper:1, sources:['zabbix','datadog','smokeping'], cpu:49, mem:64, disk:41 },
  { name:'IoT-GW-05', type:'Advantech UNO-2484G', iana:'iso.3.6.1.4.1.10297', uptimeSec:null, contact:'ot@tristek.id', location:'Plant Bekasi · Line 2', services:6, iface:'eth1', rx:null, tx:null, ifType:6, mtu:1500, bandwidth:1000000000, mac:'00:0E:8C:90:AB:CD', admin:1, oper:null, sources:['librenms','smokeping'], cpu:6, mem:18, disk:23 },
  { name:'Stor-Node-02', type:'NetApp AFF A400', iana:'iso.3.6.1.4.1.789', uptimeSec:18409120, contact:'storage@tristek.id', location:'DC Jakarta · Rack F1', services:72, iface:'e0a', rx:441929235123, tx:336618772341, ifType:6, mtu:9000, bandwidth:25000000000, mac:'00:A0:98:32:10:FE', admin:1, oper:1, sources:['datadog','librenms'], cpu:27, mem:51, disk:59 },
  { name:'Access-SW-12', type:'Aruba 2930F', iana:'iso.3.6.1.4.1.11', uptimeSec:5209340, contact:'noc@tristek.id', location:'HQ Jakarta · Floor 5', services:72, iface:'1', rx:3410982334, tx:2922110782, ifType:6, mtu:1500, bandwidth:1000000000, mac:'B8:D4:E7:23:45:67', admin:1, oper:1, sources:['zabbix','librenms'], cpu:19, mem:35, disk:25 },
  { name:'DNS-Node-01', type:'VM · Ubuntu 24.04 LTS', iana:'iso.3.6.1.4.1.8072', uptimeSec:2902330, contact:'app@tristek.id', location:'DC Jakarta · vCluster-1', services:78, iface:'ens3', rx:8841092334, tx:7732910882, ifType:53, mtu:1500, bandwidth:1000000000, mac:'52:54:00:1A:2B:3C', admin:1, oper:1, sources:['datadog','zabbix'], cpu:14, mem:39, disk:28 },
  { name:'Edge-RT-04', type:'Juniper MX240', iana:'iso.3.6.1.4.1.2636.1.1.1.2', uptimeSec:21409120, contact:'noc@tristek.id', location:'DC Surabaya · Rack C1', services:78, iface:'ge-1/0/4', rx:584412093312, tx:473291088234, ifType:6, mtu:9192, bandwidth:40000000000, mac:'3C:61:04:11:22:44', admin:1, oper:1, sources:['zabbix','librenms','smokeping'], cpu:36, mem:47, disk:44 },
  { name:'Cam-NVR-02', type:'Dahua DHI-NVR5864', iana:'iso.3.6.1.4.1.1004849', uptimeSec:120110, contact:'security@tristek.id', location:'Plant Bekasi · Gate', services:14, iface:'eth0', rx:null, tx:null, ifType:6, mtu:1500, bandwidth:1000000000, mac:'C0:39:5A:DE:F0:12', admin:1, oper:7, sources:['librenms','smokeping'], cpu:11, mem:24, disk:79 },
  { name:'App-Node-11', type:'VM · RHEL 9', iana:'iso.3.6.1.4.1.8072', uptimeSec:1502330, contact:'app@tristek.id', location:'DC Jakarta · vCluster-2', services:78, iface:'ens3', rx:33410982334, tx:25221130872, ifType:53, mtu:1500, bandwidth:10000000000, mac:'52:54:00:9A:8B:7C', admin:1, oper:1, sources:['datadog'], cpu:57, mem:72, disk:51 },
  { name:'WiFi-Ctrl-01', type:'Ubiquiti UDM-Pro-Max', iana:'iso.3.6.1.4.1.41112', uptimeSec:4402330, contact:'it@tristek.id', location:'HQ Jakarta · Rack N1', services:78, iface:'eth8', rx:23410982334, tx:31922110782, ifType:6, mtu:1500, bandwidth:10000000000, mac:'68:D7:9A:01:02:03', admin:1, oper:1, sources:['librenms','zabbix'], cpu:22, mem:41, disk:30 },
];

// attach per-device sparkline (bandwidth utilisation %) for the table
DEVICES.forEach(d => {
  const hasTraffic = d.rx != null && d.tx != null && d.bandwidth;
  const utilBase = hasTraffic
    ? ((d.tx + d.rx) / d.bandwidth > 0.4 ? 55 : 20 + ((d.cpu || 0) / 3))
    : 20;
  d.spark = genSeries(Math.min(utilBase, 70), 14, 24);

  // stable management IP — subnet keyed on site, host octets seeded on MAC/name
  const loc = (d.location || '').toLowerCase();
  let net = 10;
  if (loc.includes('vcluster')) net = 50;
  else if (loc.includes('surabaya')) net = 20;
  else if (loc.includes('bekasi')) net = 40;
  else if (loc.startsWith('hq')) net = 30;
  const h = (d.mac || d.name || '').split('').reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0), 7);
  const sub = (h % 24) + 1;
  const host = ((h >>> 4) % 250) + 2;
  d.ip = '10.' + net + '.' + sub + '.' + host;

  // vendor — detected from the type string (the OS/model first token isn't always the brand)
  const t = (d.type || '').toLowerCase();
  const rules = [
    [/mikrotik|routeros|ccr\d/, 'MikroTik'], [/cisco|catalyst/, 'Cisco'],
    [/fortinet|fortigate/, 'Fortinet'], [/juniper|\bmx\d/, 'Juniper'],
    [/aruba/, 'Aruba'], [/ubiquiti|unifi/, 'Ubiquiti'], [/f5|big-ip/, 'F5'],
    [/palo alto|\bpa-\d/, 'Palo Alto'], [/pfsense|netgate/, 'Netgate'],
    [/\bhpe?\b|proliant/, 'HPE'], [/dell|poweredge/, 'Dell'],
    [/synology/, 'Synology'], [/supermicro/, 'Supermicro'], [/netapp/, 'NetApp'],
    [/hikvision/, 'Hikvision'], [/advantech/, 'Advantech'],
    [/vm\b|ubuntu|rhel|debian|centos/, 'Virtual'],
  ];
  const hit = rules.find(r => r[0].test(t));
  d.vendor = hit ? hit[1] : (d.type || '').split(/[ ·]/)[0] || 'Other';
});

/* ===========================================================
   Per-device INTERFACE / PORT generation
   Deterministic (seeded on device name) so the port count shown
   in the main table always matches the per-interface detail page,
   even though they render in separate page loads / tabs.
   =========================================================== */
function strSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rng(seedStr) {
  const r = mulberry32(strSeed(seedStr));
  return {
    f: r,
    range: (a, b) => a + Math.floor(r() * (b - a + 1)),
    pick: arr => arr[Math.floor(r() * arr.length)],
    chance: p => r() < p,
  };
}

// Total physical/logical port count, inferred from device class
function portTotalFor(d, rnd) {
  const t = (d.type + ' ' + d.name).toLowerCase();
  const explicit = t.match(/-(\d{2})p\b/);          // e.g. Catalyst 9300-48P
  if (explicit) return parseInt(explicit[1], 10);
  if (/catalyst|2960|cx 6300|2930|aruba 29|dist-sw|core-sw|access-sw/.test(t)) return rnd.pick([24, 48, 48]);
  if (/mx204|mx240|ccr|routeros|mikrotik|\brt-|edge-rt/.test(t)) return rnd.range(8, 20);
  if (/fortigate|palo alto|pfsense|fortinet|edge-fw|vpn-gw/.test(t)) return rnd.range(8, 16);
  if (/big-ip|\bf5\b|web-lb/.test(t)) return rnd.range(6, 10);
  if (/unifi|ubiquiti|udm|wifi|u6-pro|ap-lobby/.test(t)) return rnd.pick([2, 4]);
  if (/nvr|cam-/.test(t)) return rnd.pick([4, 8]);
  if (/vm ·|ubuntu|rhel|dns-node/.test(t)) return rnd.pick([1, 2]);
  if (/iot|advantech/.test(t)) return rnd.pick([2, 4]);
  if (/poweredge|proliant|supermicro|netapp|synology|node/.test(t)) return rnd.pick([2, 4, 4]);
  return rnd.range(4, 12);
}

// builds an incrementing port-name generator from the device's primary iface
function portNamer(base) {
  const m = String(base || '').match(/^(.*?)(\d+)$/);
  if (m) { const prefix = m[1], start = parseInt(m[2], 10); return i => prefix + (start + i); }
  return i => (base || 'port') + i;
}
function descFor(i, total) {
  if (i === 0) return 'Uplink / Core';
  if (i === 1 && total > 3) return 'Trunk · LACP bundle';
  if (i === total - 1 && total > 2) return 'Management';
  return 'Access · VLAN ' + (10 + (i % 40));
}

DEVICES.forEach(d => {
  // Unreachable / no-SNMP-data devices → interface table is unavailable (N/A scenario)
  if (d.rx == null && d.tx == null) { d.interfaces = null; d.portsTotal = null; d.portsUp = null; return; }

  const rnd = rng(d.name);
  const total = portTotalFor(d, rnd);
  const namer = portNamer(d.iface);
  const devUp = d.oper === 1;
  const ifs = [];

  for (let i = 0; i < total; i++) {
    const adminUp = i === 0 ? true : rnd.chance(0.86);
    const operUp = (i === 0 && devUp) ? true : adminUp && (devUp ? rnd.chance(0.9) : rnd.chance(0.32));
    const state = !adminUp ? 'off' : operUp ? 'up' : 'down';

    let octIn = 0, octOut = 0, errIn = 0, errOut = 0;
    if (operUp) {
      const boost = i === 0 ? 0.7 : 0;                          // uplink carries more
      octIn = Math.round(Math.pow(10, 4 + rnd.f() * 5.4 + boost));
      octOut = Math.round(octIn * (0.4 + rnd.f() * 0.7));
      errIn = rnd.chance(0.32) ? rnd.range(1, 4800) : 0;
      errOut = rnd.chance(0.14) ? rnd.range(1, 180) : 0;
    }
    const desc = descFor(i, total);
    ifs.push({
      index: i + 1,
      name: namer(i),
      desc,
      state, adminUp, operUp,
      octIn, octOut, errIn, errOut,
      // seed role flag from the port's purpose; user can override (persisted in localStorage)
      flag: /^uplink/i.test(desc) ? 'uplink'
          : /^trunk/i.test(desc) ? 'uplink'
          : /^access/i.test(desc) ? 'downlink'
          : 'unset',
    });
  }
  // guarantee a live uplink when the device itself is up
  if (devUp && !ifs.some(x => x.operUp)) {
    const f = ifs[0]; f.adminUp = true; f.operUp = true; f.state = 'up';
    f.octIn = Math.round(Math.pow(10, 7 + rnd.f())); f.octOut = Math.round(f.octIn * 0.6);
  }

  d.interfaces = ifs;
  d.portsTotal = ifs.length;
  d.portsUp = ifs.filter(x => x.operUp).length;
});

// Inject real uplink failures so the Uplink lens shows down / degraded links:
//  'all' = every uplink port down  → device is critically DOWN (oper 2)
//  'one' = a single uplink down     → device stays UP but uplink is DEGRADED (e.g. 1/2)
const UPLINK_FAULT = {
  'Web-LB-01': 'all', 'Dist-SW-04': 'all', 'Mail-Node-02': 'all',
  'Edge-RT-02': 'one', 'Core-SW-01': 'one',
};
DEVICES.forEach(d => {
  const mode = UPLINK_FAULT[d.name];
  if (!mode || !d.interfaces) return;
  const ups = d.interfaces.filter(it => it.flag === 'uplink');
  if (!ups.length) return;
  const toDown = mode === 'all' ? ups : ups.slice(0, 1);
  toDown.forEach(p => { p.adminUp = true; p.operUp = false; p.state = 'down'; p.octIn = 0; p.octOut = 0; p.errIn = 0; p.errOut = 0; });
  if (mode === 'all') {
    d.oper = 2;   // uplink lost → device unreachable from the core
  } else {
    // degraded: one uplink down, but keep the rest UP so the device stays reachable
    ups.slice(1).forEach(p => {
      p.adminUp = true; p.operUp = true; p.state = 'up';
      if (!p.octIn) { p.octIn = Math.round(Math.pow(10, 7 + Math.random())); p.octOut = Math.round(p.octIn * 0.6); }
    });
  }
  d.portsUp = d.interfaces.filter(x => x.operUp).length;
});

window.KONTROLA = { DEVICES, TOOLS, IFTYPE, STATE, genSeries };
