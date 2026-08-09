# Rancangan Personal AI Development Studio

> Status: **Rancangan aktif**
> Diperbarui: 9 Agustus 2026
> Target pengguna: **satu pengguna pribadi**
> Deployment: **laptop lokal saja**
> Scope: **satu proyek/aplikasi aktif pada satu waktu**

---

## 1. Ringkasan

Personal AI Development Studio adalah aplikasi pribadi yang berjalan di laptop sendiri, dapat diakses melalui browser di `localhost`. Tujuannya menggantikan ketergantungan pada Replit untuk kebutuhan pengembangan sehari-hari.

Fitur inti:

- Membuka dan mengedit proyek dari GitHub atau folder lokal.
- Editor kode di browser.
- Terminal di browser.
- Preview aplikasi yang sedang dikerjakan.
- AI Agent untuk coding, debugging, dan problem solving.
- Mode Build dan Design.
- Penyimpanan secret aman per proyek.
- Git pull, diff, commit, dan push.
- Checkpoint dan rollback.

Tidak ada VPS. Tidak ada Docker. Tidak ada multi-user. Tidak ada billing.
Semua berjalan di laptop, semua data tersimpan lokal.

---

## 2. Batasan dan Scope

### Yang dibuat

- Satu aplikasi berjalan lokal di laptop.
- Satu proyek aktif pada satu waktu.
- Satu pengguna.
- Akses hanya dari browser di laptop yang sama.

### Yang tidak dibuat

- Multi-user.
- Akses dari internet atau luar laptop.
- VPS atau cloud deployment.
- Docker atau container isolation.
- Billing atau quota.
- Kolaborasi atau sharing.
- Marketplace atau plugin publik.
- Editor visual setara Figma.
- Hosting aplikasi untuk orang lain.

Fitur di luar scope ini dapat ditambahkan nanti jika dibutuhkan, tanpa harus menulis ulang fondasi.

---

## 3. Arsitektur

Semua komponen berjalan di satu laptop:

```text
Browser (localhost:3000)
        │
        ▼
┌───────────────────────────────────────┐
│ Personal Dev Studio                   │
│                                       │
│  Backend — Node.js + Express          │
│  ├── Auth lokal (password tunggal)    │
│  ├── Project Manager                  │
│  ├── File System API                  │
│  ├── Workspace Runner (node-pty)      │
│  ├── Build Runner                     │
│  ├── Preview Proxy                    │
│  ├── AI Gateway                       │
│  ├── GitHub Service (simple-git)      │
│  ├── Secret Manager                   │
│  └── Checkpoint Manager               │
│                                       │
│  Database — SQLite (satu file)        │
│  Storage  — folder ~/dev-studio/      │
└───────────────────────────────────────┘
        │
        ├── Proyek aktif (folder lokal)
        │     └── source code
        │
        ├── Preview (localhost:3100)
        │     └── proses aplikasi berjalan
        │
        └── AI
              ├── API key sendiri (eksternal)
              └── Ollama (lokal, opsional)
```

### Cara kerja umum

```text
Buka browser → localhost:3000
        ↓
Login dengan password lokal
        ↓
Pilih atau import proyek
        ↓
Edit kode / minta agent bekerja
        ↓
Build dan preview di localhost:3100
        ↓
Lihat diff → commit → push ke GitHub
```

---

## 4. Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Backend | Node.js + Express | Mudah, cukup untuk kebutuhan ini |
| Database | SQLite | Satu file, tanpa setup, cukup untuk satu pengguna |
| Terminal | node-pty + xterm.js | Terminal nyata di browser |
| Editor | Monaco Editor | Sama dengan VS Code, berjalan di browser |
| Git | simple-git | Library Node.js untuk git |
| Preview proxy | http-proxy + express | Teruskan port lokal ke browser |
| Secret | SQLite + AES-256-GCM | Enkripsi di kolom database |
| AI API | Groq, OpenAI, Gemini, dll | Sesuai API key yang dimiliki |
| AI lokal | Ollama (opsional) | Model lokal jika tidak ingin pakai API |
| Frontend | React + Vite | Konsisten dengan proyek TOMAT |
| Auth | Session + bcrypt | Password tunggal, satu akun lokal |

---

## 5. Struktur Folder Aplikasi

```text
~/dev-studio/                    ← root aplikasi
├── studio/                      ← source code Personal Dev Studio
│   ├── server/                  ← backend Node.js
│   │   ├── index.js
│   │   ├── auth.js
│   │   ├── projects.js
│   │   ├── workspace.js
│   │   ├── preview.js
│   │   ├── ai-gateway.js
│   │   ├── github.js
│   │   ├── secrets.js
│   │   └── checkpoints.js
│   ├── src/                     ← frontend React
│   │   ├── App.jsx
│   │   ├── screens/
│   │   │   ├── ProjectList.jsx
│   │   │   ├── BuildMode.jsx
│   │   │   └── DesignMode.jsx
│   │   └── components/
│   │       ├── Editor.jsx
│   │       ├── Terminal.jsx
│   │       ├── FileExplorer.jsx
│   │       ├── AIAgent.jsx
│   │       ├── GitPanel.jsx
│   │       └── PreviewFrame.jsx
│   ├── studio.db                ← database SQLite
│   └── package.json
│
└── projects/                    ← semua proyek yang dikelola
    ├── tomat/                   ← clone proyek TOMAT
    ├── website/                 ← proyek lain
    └── api/
```

---

## 6. Auth Lokal

Karena hanya satu pengguna dan hanya diakses dari laptop sendiri, sistem auth bisa sangat sederhana:

- Satu password yang di-hash dengan bcrypt.
- Session disimpan di SQLite atau file.
- Cookie httpOnly.
- Tidak ada registrasi.
- Tidak ada reset password melalui email.
- Password hanya bisa diubah langsung dari terminal atau file konfigurasi.

Cara mengakses:

```text
Buka browser → localhost:3000
→ Masukkan password
→ Session aktif selama browser terbuka atau sampai logout
```

Jika ingin lebih sederhana lagi, versi pertama dapat memakai autentikasi berbasis token statis yang disimpan di file `.env` studio.

---

## 7. Project Manager

Project Manager mengelola daftar proyek yang dikerjakan.

Data per proyek yang disimpan di SQLite:

```text
id
nama
path lokal (misalnya ~/dev-studio/projects/tomat)
url github
branch aktif
port preview
perintah start (misalnya: npm run dev)
perintah build (misalnya: npm run build)
env/secret yang aktif
waktu terakhir dibuka
```

Fitur:

- Tambah proyek baru dari GitHub URL.
- Tambah proyek dari folder lokal yang sudah ada.
- Clone repository.
- Pilih branch.
- Buka proyek di Build Mode atau Design Mode.
- Lihat status proyek: berjalan, berhenti, atau error.

---

## 8. File Explorer dan Editor

### File Explorer

- Menampilkan struktur folder proyek.
- Klik file untuk membuka di editor.
- Klik kanan untuk rename, hapus, buat file/folder baru.
- Navigasi keyboard.
- Indikator file yang sudah diubah.

### Editor

Monaco Editor berjalan di browser dan berkomunikasi dengan backend untuk:

- Membaca konten file dari disk.
- Menyimpan perubahan ke disk.
- Menampilkan diff terhadap git.
- Highlight syntax sesuai bahasa.
- Search dan replace.
- Multiple tab.

Backend endpoint yang diperlukan:

```text
GET  /api/files?path=...        → baca file
POST /api/files                 → tulis file
GET  /api/tree?root=...         → daftar file/folder
POST /api/files/rename          → rename
POST /api/files/delete          → hapus
POST /api/files/mkdir           → buat folder
```

---

## 9. Terminal

Terminal menggunakan `node-pty` di backend dan `xterm.js` di frontend melalui WebSocket.

```text
Browser (xterm.js)
    ↕ WebSocket
Backend (node-pty)
    ↕
Shell (bash/sh) — di dalam folder proyek
```

Terminal berjalan di direktori proyek aktif. Pengguna dapat:

- Menjalankan command apa pun seperti terminal biasa.
- Menjalankan `npm install`, `npm run dev`, `git status`, dll.
- Melihat output secara realtime.

Pembatasan ringan yang disarankan:

- Timeout per command opsional.
- Tidak menjalankan lebih dari satu proses berat secara bersamaan.

---

## 10. Preview

Preview menampilkan aplikasi yang sedang berjalan di dalam iframe:

```text
Browser
├── Dev Studio (localhost:3000)
│   └── Panel Preview (iframe)
│         └── Mengarah ke localhost:3100
│
└── Proyek aktif (localhost:3100)
      └── npm run dev / server Node.js / dll
```

Backend meneruskan port preview ke iframe melalui proxy:

```text
localhost:3000/preview → localhost:3100
```

Fitur preview:

- Status server: berjalan, berhenti, crash.
- Tombol restart server.
- Log startup.
- Refresh otomatis setelah build berhasil.
- Screenshot preview untuk dikirim ke agent.
- Buka di tab baru.

Port preview dapat dikonfigurasi per proyek jika proyek menggunakan port berbeda.

---

## 11. AI Gateway

AI Gateway adalah lapisan tengah yang menghubungkan agent ke provider AI.

```text
Agent
  ↓
AI Gateway
  ├── Groq (API key sendiri)
  ├── OpenAI (API key sendiri)
  ├── Gemini (API key sendiri)
  ├── Provider lain (API key sendiri)
  └── Ollama (lokal, opsional)
```

Karena ini penggunaan pribadi, AI Gateway tidak perlu mengelola billing atau quota pengguna. Cukup:

- Membaca konfigurasi provider dari secret studio.
- Memilih provider berdasarkan konfigurasi pengguna.
- Mengirim request ke provider.
- Meneruskan respons ke agent.
- Mencatat penggunaan token di SQLite.
- Menyensor secret dari input sebelum dikirim ke provider.

### Routing sederhana

```text
Tugas ringan      → provider utama yang dipilih pengguna
Tugas vision      → provider yang mendukung image
Tugas lokal       → Ollama (jika dikonfigurasi)
```

### Penghematan token

Karena API key milik sendiri, pengguna menanggung biaya sendiri. Tetap disarankan:

- Jangan mengirim `node_modules`, `dist`, cache, dan binary.
- Batasi ukuran log yang dikirim (misalnya maksimal 20 KB).
- Kirim hanya file yang relevan, bukan seluruh repository.
- Cache ringkasan proyek agar tidak dibaca ulang setiap permintaan.
- Hentikan agent jika gagal tiga kali berturut-turut.

---

## 12. AI Agent

Agent adalah komponen yang menjalankan instruksi coding secara otomatis menggunakan tools.

### Tools yang tersedia

```text
read_file           → membaca isi file
list_files          → daftar file/folder
search_code         → cari teks atau pola dalam proyek
inspect_project     → ringkasan struktur proyek
write_file          → membuat atau mengubah file
apply_patch         → menerapkan diff
run_command         → menjalankan command di terminal
run_build           → menjalankan build command
run_tests           → menjalankan test
read_logs           → membaca output log terakhir
take_screenshot     → screenshot preview
git_status          → status git
git_diff            → melihat perubahan
git_branch          → membuat atau pindah branch
git_commit          → commit lokal
git_pull            → pull dari remote
git_push            → push ke remote (perlu approval)
```

### Siklus kerja agent

```text
1. Memahami instruksi pengguna.
2. Menginspeksi struktur proyek.
3. Membuat rencana singkat.
4. Membuat checkpoint.
5. Mengubah file.
6. Menjalankan build atau test.
7. Membaca error jika ada.
8. Memperbaiki secara terbatas.
9. Menampilkan ringkasan dan diff.
10. Menunggu approval untuk commit/push.
```

### Guardrail

Agent tidak boleh:

- Membaca nilai secret.
- Menampilkan secret di chat atau log.
- Push ke remote tanpa approval pengguna.
- Mengubah file di luar folder proyek aktif.
- Menjalankan command destruktif tanpa konfirmasi.
- Mengulangi langkah yang sama tanpa perubahan strategi.

Batas awal:

```text
Maksimal langkah per permintaan   : 20
Maksimal kegagalan build otomatis : 3
Maksimal ukuran log ke model      : 20 KB
Screenshot otomatis               : hanya saat diperlukan
```

---

## 13. Mode Build

```text
┌──────────────┬─────────────────────────┬──────────────────┐
│ File Explorer│ Editor (Monaco)         │ AI Agent         │
│              │                         │                  │
│ src/         │ kode file aktif         │ chat             │
│ public/      │                         │ rencana          │
│ package.json │                         │ status tool      │
├──────────────┴─────────────────────────┴──────────────────┤
│ Terminal │ Build Log │ Git Diff │ Checkpoints              │
└──────────────────────────────────────────────────────────-─┘
```

Fitur MVP:

- File explorer.
- Buka dan simpan file.
- Monaco Editor.
- Terminal.
- Jalankan build.
- Log realtime.
- AI Agent.
- Git status, diff, commit.
- Checkpoint.

Fitur lanjutan:

- Multi-tab editor.
- Search seluruh proyek.
- Inline diagnostic.
- Auto-format.
- Perbandingan checkpoint.
- Apply/reject perubahan per baris.

---

## 14. Mode Design

Mode Design membantu mengubah tampilan aplikasi berdasarkan visual, bukan hanya instruksi teks.

### Alur

```text
Pengguna membuka preview
        ↓
Pengguna klik elemen di preview
        ↓
Sistem mengambil screenshot + info komponen
        ↓
Pengguna memberi instruksi visual
        ↓
Agent membuat beberapa variasi
        ↓
Pengguna memilih variasi
        ↓
Agent menerapkan perubahan + checkpoint
        ↓
Build dan preview diverifikasi
```

### MVP Design Mode

- Preview live.
- Screenshot preview.
- Klik elemen, kirim konteks komponen ke agent.
- Chat agent dengan konteks visual.
- Generate dua atau tiga variasi desain.
- Tampilkan variasi berdampingan.
- Apply variasi yang dipilih.

### Contoh instruksi

- "Buat kartu ini lebih mudah dibaca di layar Android."
- "Buat tiga variasi hero section tanpa mengubah fungsinya."
- "Jadikan layout ini landscape-only di mobile."
- "Pertahankan warna brand tetapi kuatkan hierarkinya."

---

## 15. GitHub Integration

### Fitur

- Import proyek dari GitHub URL.
- Clone repository ke folder lokal.
- Pilih branch.
- Pull perubahan terbaru.
- Lihat status dan diff.
- Buat branch baru.
- Commit perubahan.
- Push ke remote (dengan approval).

### Alur branch yang disarankan

```text
main (branch utama di GitHub)
    ↓ clone
lokal main
    ↓ agent membuat branch
agent/YYYYMMDD-nama-tugas
    ↓ agent bekerja
commit lokal + checkpoint
    ↓ pengguna lihat diff
push ke GitHub
    ↓ opsional
Pull Request
```

### Token GitHub

Token GitHub disimpan sebagai secret di studio, tidak pernah ditampilkan ke browser atau agent.

---

## 16. Secret Manager

Secret dipisahkan per proyek dan disimpan terenkripsi di SQLite.

Contoh:

```text
Proyek TOMAT
├── DATABASE_URL
├── GROQ_API_KEY
├── SESSION_SECRET
└── VAPID_PRIVATE_KEY

Proyek Website
├── GITHUB_TOKEN
└── DEPLOY_TOKEN

Studio (internal)
├── GITHUB_TOKEN_STUDIO
└── AI_PROVIDER_KEY
```

### Cara kerja

- Secret dienkripsi dengan AES-256-GCM.
- Kunci enkripsi disimpan terpisah di file konfigurasi studio, bukan di database.
- Secret hanya diinjeksi sebagai environment variable ke proses workspace.
- Nilai secret tidak pernah dikirim ke browser.
- Nilai secret tidak pernah masuk ke prompt agent.
- Output terminal dan log disensor otomatis.

### Yang dilihat agent

```text
Secret yang tersedia untuk proyek ini:
- DATABASE_URL ✓
- GROQ_API_KEY ✓
- SESSION_SECRET ✓
```

Bukan:

```text
DATABASE_URL=postgresql://user:password@host/db
```

### Operasi yang tersedia

- Tambah secret.
- Lihat daftar nama secret (bukan nilai).
- Ubah nilai secret.
- Hapus secret.
- Salin secret dari proyek lain.

---

## 17. Checkpoint dan Rollback

Checkpoint dibuat otomatis:

- Sebelum agent mulai mengubah kode.
- Sebelum refactor besar.
- Sebelum pengguna memilih variasi Design Mode.
- Secara manual oleh pengguna kapan saja.

Implementasi sederhana untuk laptop lokal:

- Git commit lokal dengan pesan checkpoint otomatis.
- Metadata checkpoint disimpan di SQLite.

Data per checkpoint:

```text
id
waktu
instruksi pengguna
ringkasan agent
daftar file yang berubah
hash commit git
hasil build/test
```

Rollback berarti:

```text
git reset --hard <hash-checkpoint>
```

Metadata checkpoint tetap tersimpan walaupun kode sudah di-rollback.

---

## 18. Biaya Operasional

Karena berjalan lokal tanpa VPS:

| Komponen | Biaya |
|---|---|
| Server/hosting | Rp 0 |
| Database | Rp 0 (SQLite lokal) |
| Storage | Rp 0 (disk laptop) |
| Preview | Rp 0 (port lokal) |
| GitHub | Rp 0 (paket gratis) |
| Ollama (model lokal) | Rp 0 (sekali download) |
| AI API | Sesuai pemakaian, API key sendiri |
| Listrik laptop | Normal, tidak ada tambahan signifikan |

Satu-satunya biaya variabel adalah **pemakaian AI API** jika tidak memakai model lokal.

### Cara meminimalkan biaya AI API

- Gunakan Ollama untuk tugas ringan seperti ringkasan, pencarian, dan perubahan kecil.
- Gunakan API hanya untuk debugging kompleks atau perubahan besar.
- Pilih provider dengan harga per token paling hemat.
- Batasi ukuran konteks yang dikirim ke model.
- Cache ringkasan proyek.
- Jangan kirim `node_modules`, `dist`, dan file tidak relevan.

---

## 19. Roadmap

### Fase 1 — Fondasi (MVP)

- [ ] Setup project: Node.js + Express + React + Vite + SQLite.
- [ ] Auth lokal dengan password tunggal.
- [ ] Project Manager: tambah, buka, dan hapus proyek.
- [ ] Import dari GitHub: clone repository.
- [ ] File Explorer.
- [ ] Monaco Editor: baca dan simpan file.
- [ ] Terminal: node-pty + xterm.js.
- [ ] Preview: jalankan server proyek dan tampilkan di iframe.

### Fase 2 — Git dan AI Dasar

- [ ] Git status, diff, branch, commit, pull, push.
- [ ] AI Gateway: satu provider (Groq atau OpenAI).
- [ ] AI Agent: `read_file`, `search_code`, `write_file`, `run_command`.
- [ ] Build runner: jalankan build command dan tampilkan log.
- [ ] Checkpoint otomatis sebelum agent bekerja.
- [ ] Review diff dan approval push.

### Fase 3 — Secret dan Keamanan Lokal

- [ ] Secret Manager: CRUD + enkripsi AES-256-GCM.
- [ ] Injeksi secret ke environment workspace.
- [ ] Masking secret dari terminal dan log.
- [ ] Audit log operasi secret.

### Fase 4 — Build Mode Lengkap

- [ ] Agent dengan semua tools Git.
- [ ] Checkpoint rollback.
- [ ] Multi-tab editor.
- [ ] Search seluruh proyek.
- [ ] Log dan error realtime yang lebih baik.
- [ ] Auto-retry perbaikan build terbatas.

### Fase 5 — Design Mode

- [ ] Screenshot preview.
- [ ] Inspect elemen.
- [ ] Konteks komponen ke agent.
- [ ] Generate variasi desain.
- [ ] Compare dan apply variasi.

### Fase 6 — AI Multi-Provider

- [ ] Ollama adapter.
- [ ] Dukungan beberapa API provider.
- [ ] Konfigurasi provider dari UI.
- [ ] Catat pemakaian token per provider.

---

## 20. Kriteria Sukses MVP

MVP berhasil jika:

1. Aplikasi berjalan di `localhost:3000` cukup dengan `npm start`.
2. Dapat login dengan password lokal.
3. Dapat import proyek dari GitHub.
4. Dapat membuka dan menyimpan file dari browser.
5. Dapat menjalankan terminal dari browser.
6. Dapat melihat preview aplikasi proyek di iframe.
7. Dapat meminta agent memperbaiki perubahan sederhana.
8. Dapat melihat diff sebelum commit.
9. Dapat commit dan push ke GitHub.
10. Dapat rollback ke checkpoint sebelumnya.
11. Secret tersimpan dan tidak pernah ditampilkan ke browser atau agent.
12. Semua ini bekerja tanpa koneksi internet, kecuali untuk GitHub dan AI API.

---

## 21. Keputusan Desain

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Deployment | Lokal saja | Tidak perlu VPS, tidak ada biaya hosting |
| Database | SQLite | Satu file, tanpa setup, cukup untuk satu pengguna |
| Isolasi workspace | Proses Node.js biasa | Tidak perlu Docker untuk penggunaan pribadi |
| Auth | Password lokal tunggal | Hanya satu pengguna, tidak perlu sistem akun |
| Secret | SQLite + AES-256-GCM | Cukup aman untuk lokal, tidak perlu Vault |
| AI | Gateway multi-provider | Provider dapat diganti kapan saja |
| Model lokal | Ollama opsional | Hemat biaya API untuk tugas ringan |
| Editor | Monaco | Sama dengan VS Code, open source |
| Terminal | node-pty + xterm.js | Terminal nyata, bukan simulasi |
| Git | simple-git | Library Node.js, tidak perlu install tambahan |
| Frontend | React + Vite | Konsisten dengan proyek yang sedang dikerjakan |
| Satu proyek aktif | Ya | Sesuai kebutuhan nyata, tidak perlu multi-workspace |

---

*Dokumen ini adalah acuan pengembangan. Fitur di luar scope fase yang sedang dikerjakan tidak perlu diimplementasikan dulu.*
