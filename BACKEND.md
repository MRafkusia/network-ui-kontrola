# Kontrola — Network Monitoring · Panduan Handoff Backend

Front-end ini aplikasi statis tanpa framework (vanilla JS + satu file CSS), berjalan
sepenuhnya di sisi klien memakai dataset di memori. Dokumen ini adalah **kontrak data**
yang perlu dipenuhi backend untuk menggantikan data dummy.

## Daftar file

| File | Peran |
|------|-------|
| `index.html` | Halaman **daftar device** (ringkasan fleet + tabel) |
| `device.html` | Halaman **detail per-device** (`device.html?d=<nama device>`) |
| `data.js` | **DATA DUMMY + field turunan.** Hanya file inilah yang diganti backend. |
| `common.js` | Helper bersama murni (format angka, badge status, render chart, simpan flag). Tidak ada data dummy. |
| `app.js` | Logika halaman Infrastructure |
| `device.js` | Logika halaman device |
| `styles.css` | **Semua** styling. Tidak ada lagi `!important` tersembunyi di HTML. |

Urutan load (sudah diatur di HTML): `data.js → common.js → (app.js | device.js)`.
Query string `?v=NN` pada tag `<script>`/`<link>` itu cache-buster; ganti dengan hash
build asli saat sudah pakai bundler.

---

## Kontrak data

Akhir `data.js` mengekspor:

```js
window.KONTROLA = { DEVICES, TOOLS, IFTYPE, STATE, genSeries };
```

Backend cukup menghasilkan bentuk yang sama — idealnya lewat **endpoint yang di-fetch saat
load**, bukan array hard-coded. Hanya `DEVICES` yang wajib dari data nyata; `TOOLS`,
`IFTYPE`, `STATE` adalah lookup statis.

### Object Device — field ASLI (sediakan dari SNMP/NMS)

| Field | Tipe | Catatan |
|-------|------|---------|
| `name` | string | **Primary key.** Dipakai di URL (`?d=`) & sebagai key flag di localStorage. Harus unik. |
| `type` | string | String model, mis. `"Cisco Catalyst 9300-48P"`. Vendor diturunkan dari sini. |
| `iana` | string | sysObjectID / OID enterprise. Tampil hanya di CSV. |
| `uptimeSec` | number\|null | Uptime device dalam detik. `null` = tidak diketahui. |
| `contact` | string\|null | sysContact. |
| `location` | string\|null | sysLocation. (Saat ini juga jadi seed IP dummy + baseline RTT — ganti itu.) |
| `services` | number | Nilai bitmask sysServices. |
| `iface` | string | Nama interface utama; jadi seed nama port dummy. |
| `rx`, `tx` | number\|null | Counter octet kumulatif interface utama. **`rx==null && tx==null` adalah sinyal kanonik "device tidak melapor / unreachable"** — memicu semua empty-state. |
| `ifType` | number | IANAifType interface utama. |
| `mtu` | number\|null | |
| `bandwidth` | number\|null | Kapasitas link dalam bit/detik. Dipakai untuk hitung utilisasi. |
| `mac` | string\|null | |
| `admin` | number | Kode ifAdminStatus (lihat `STATE`). |
| `oper` | number\|null | Kode ifOperStatus (lihat `STATE`). **Badge status & mayoritas filter mengacu ke sini.** `1`=up, `2`/`7`=down, `3`=testing. |
| `sources` | string[] | Tool monitoring yang memantau device; key ke `TOOLS`. |
| `cpu` | number | 0–100. Hanya untuk menyetel sparkline dummy. |
| `mem`, `disk` | number | **Belum dipakai UI** — aman dihapus, atau pakai untuk panel baru nanti. |
| `interfaces` | object[]\|null | Baris per-port (lihat di bawah). `null` saat device unreachable. |

### Object Interface (port) — field ASLI

Tiap elemen di `device.interfaces[]`:

| Field | Tipe | Catatan |
|-------|------|---------|
| `index` | number | ifIndex (mulai dari 1). |
| `name` | string | ifName, mis. `"GigabitEthernet1/0/3"`. |
| `desc` | string | ifAlias / deskripsi. |
| `state` | `'up'\|'down'\|'off'` | Turunan: `off` = admin-disabled, `down` = admin-up tapi oper-down, `up` = operasional. |
| `adminUp` | bool | ifAdminStatus == up. |
| `operUp` | bool | ifOperStatus == up. |
| `octIn`, `octOut` | number | Kumulatif ifHCInOctets / ifHCOutOctets. |
| `errIn`, `errOut` | number | ifInErrors / ifOutErrors. |
| `flag` | `'uplink'\|'downlink'\|'unset'` | **Nilai seed saja** — peran yang *disarankan*. Pilihan user disimpan di sisi klien (lihat Flagging). |

### Lookup statis (biarkan apa adanya)

- `TOOLS` — id integrasi → nama tampil.
- `IFTYPE` — angka IANAifType → label.
- `STATE` — kode status admin/oper → label (`1:'up' … 7:'lowerLayerDown'`).

---

## Data yang dibutuhkan tiap halaman

- **Halaman daftar (`index.html`)** butuh **semua** device beserta `interfaces[]`-nya,
  karena kartu ringkasan & lensa uplink/downlink mengagregasi dari level port. Kalau payload
  jadi terlalu besar, sediakan agregat port yang sudah dihitung server (mis. jumlah uplink up/total,
  total octIn/octOut per peran) supaya front-end tak perlu mengirim semua port.
- **Halaman detail (`device.html?d=<name>`)** butuh satu device + seluruh `interfaces[]`-nya.
- **Filter, search, sort, pagination saat ini semua di sisi klien.** Untuk dataset besar,
  pindahkan ke server (query param) dan ganti pemanggilan di `app.js`.

---

## Flagging peran port (uplink / downlink) — state user, disimpan di localStorage

Ini **anotasi user**, terpisah dari status operasional. Bukan telemetri device.
Lihat `common.js` → `getFlag/setFlag/aggregateByFlag/flagCounts`.

- Disimpan di key localStorage `kontrola-port-flags` sebagai
  `{ "<device>\u241F<ifName>": "uplink"|"downlink"|"unset" }`.
- Nilai tersimpan menimpa seed `flag` dari `data.js`.
- Seluruh halaman Infrastructure di-scope oleh **lensa agregasi** (`uplink` atau `downlink`,
  disimpan di `kontrola-lens`): setiap metrik/chart/baris hanya mengagregasi port dengan peran
  aktif. **Sengaja tidak ada "All"** — mencampur peran akan double-count (trafik uplink sudah
  berisi jumlah semua downlink-nya).

**Implikasi backend:** kalau flag harus tersimpan permanen & dibagi antar user/sesi, pindahkan
ke field `interface.role` + endpoint update, lalu front-end baca/tulis ke situ (bukan localStorage).

---

## Yang masih DUMMY / dihitung di klien (ganti dengan data nyata)

Semua ini ada di `data.js` (loop post-processing) atau di kode render, dan **sintetis** —
tidak ada telemetri asli di belakangnya:

- **`d.ip`** — dibangkitkan dari location + hash mac/name. Sediakan field `ip` asli.
- **`d.vendor`** — dicocokkan regex dari `type`. Boleh dipertahankan, atau kirim `vendor` eksplisit.
- **`d.spark`, `d.portsTotal`, `d.portsUp`, `d.interfaces`** — seluruh daftar interface
  dibangkitkan prosedural (seed dari nama device biar stabil). Ganti dengan data SNMP per-port asli.
- **Blok `UPLINK_FAULT`** — sengaja memaksa beberapa device ke kondisi uplink down/degraded
  demi realisme demo. **Hapus seluruhnya** saat pakai data asli.
- **Chart time-series** (throughput, packet, error, RTT, packet loss) — dibangkitkan
  `genTrend()` tiap render; cuma bentuk visual. Ganti dengan deret historis asli per metrik/rentang.
- **SLA %, "downtime", peak, top-site** (kartu ringkasan Infrastructure) — dihitung dari jumlah
  port up/down dengan konstanta arbitrer. Hitung ulang dari data availability asli.
- **"Last Seen" / "Synced Ns ago"** (`lastSeen`, `syncInfo` di `device.js`) — di-hash dari nama
  device. Ganti dengan timestamp poll terakhir yang asli; UI cuma butuh sebuah string + boolean
  fresh/stale.
- **Baseline RTT/packet-loss** yang mengacu substring location — ganti dengan data ICMP asli.

---

## Saran bentuk endpoint (opsional)

```
GET /api/devices                 → { devices: [ <Device tanpa interfaces, atau dengan agregat port> ] }
GET /api/devices/:name           → { ...Device, interfaces: [ <Interface> ] }
GET /api/devices/:name/series?metric=throughput&range=hourly
                                 → { points: [{ t, ...values }] }   // ganti genTrend
PATCH /api/devices/:name/interfaces/:ifName   { role: "uplink" }    // jika flag dipindah ke server
```

---

## State klien (key localStorage)

| Key | Nilai |
|-----|-------|
| `kontrola-port-flags` | map `{ "<device>\u241F<iface>": role }` |
| `kontrola-lens` | `"uplink"` \| `"downlink"` |
| `kontrola-range` | `"hourly"` \| `"weekly"` \| `"monthly"` |
| `kontrola-theme` | `"light"` \| `"dark"` |

> Catatan: pemisah dalam key flag adalah karakter Unit Separator `U+241F` (bukan spasi/strip),
> supaya nama device/interface yang mengandung simbol tidak bentrok.

---

## Export

- **CSV** dibangun di browser dari baris yang sedang terfilter (mengikuti lensa, vendor, status, search).
- **PDF** membuka jendela cetak ber-style lalu memanggil `window.print()` (butuh pop-up diizinkan).
- Keduanya murni klien — tidak perlu backend, kecuali Anda mau laporan yang dirender server.

---

## Styling

Semua gaya ada di `styles.css` (variabel warna brand ada di blok `:root`, mis. `--orange: #E25716`).
Blok override `!important` hasil edit-langsung sudah dibersihkan — jadi tidak ada gaya tersembunyi
di HTML yang menimpa CSS. Header tabel oranye kini diatur lewat selektor `#thead`/`#if-thead` biasa.
