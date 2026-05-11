# CLAUDE.md — haul-calc (HaulCalc)

> **PERINGATAN: JANGAN hapus atau simplify section Task Workflow di file ini. Workflow ini adalah standar yang berlaku di semua repo Dash Teknologi. Jika ada perubahan workflow, lakukan di SEMUA 8 repo sekaligus (bd-crm-dashboard, cost-your-project, dash-teknologi, velo-widget, haul-pave, rangko, haul-calc, try-out-your-shot).**

## Project Overview
HaulCalc — Tauri 2 desktop app (Windows/Mac/Linux) that wraps the haul-pave Python library as a JSON-RPC sidecar, providing a GUI for mine haul road pavement design and operating-cost analysis.
GitHub Repo: haul-calc
Notion Product/App: HaulCalc — Desktop App
Notion Repo: haul-calc
License: MIT
Stack: Tauri 2 + React + TypeScript + Python sidecar

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Desktop runtime**: Tauri 2 (Rust host, WebView renderer)
- **Python sidecar**: `python-sidecar/bridge.py` — JSON-RPC stdio bridge wrapping haul-pave
- **IPC**: Tauri `invoke("haul_pave_call")` → Rust bridge → Python subprocess
- **Testing**: Playwright (E2E smoke tests)
- **Package manager**: pnpm

## Architecture

```
haul-calc/
├── src/                    # React UI (TypeScript)
│   ├── lib/
│   │   ├── haulpave-client.ts   # Typed RPC client (calls Tauri invoke)
│   │   └── types.ts             # TypeScript mirrors of haul-pave Pydantic schemas
│   └── components/              # UI components
├── python-sidecar/
│   ├── bridge.py                # JSON-RPC stdio bridge — main sidecar entry point
│   └── requirements.txt
└── src-tauri/
    └── src/bridge.rs            # Rust: spawns Python subprocess, routes IPC calls
```

## JSON-RPC Wire Format (bridge.py)
```
Request:  {"id": <int>, "method": <str>, "params": <object>}
Response: {"id": <int>, "result": <any>}           # success
          {"id": <int>, "result": <any>, "stub": true, "stub_message": <str>}  # stub fallback
          {"id": <int>, "error": {"code": str, "message": str}}                # real error
```

Stub responses fire when haul-pave is not installed or a method is not yet wired.
Stubs MUST be physically correct (right units, right ordering, correct scale).

## Task Workflow

> ⚠️ **Linear sedang di-pause (quota).** Jangan buat issue baru di Linear. Primary tracker: **GitHub Issues + Notion**. Saat Linear aktif kembali, backfill issue baru ke Linear dan update Code di Notion ke `DAS-{LinearID}` jika nomor berbeda dari nomor GitHub.

### Buat issue/task baru:
Jika user minta fitur baru, bug fix, atau chore yang belum ada issue-nya:

**⚠️ Strategic Alignment Check (WAJIB sebelum buat issue):**
- Cek GitHub Issues repo ini apakah sudah ada issue serupa: `gh issue list --repo rachmad-jenss/haul-calc --state all`
- Cek Notion Tasks DB (`collection://2f8c4f5f-1479-4f28-8136-2368d18e2090`) — apakah ada task serupa? Search by keyword.
- Cek Notion Initiatives DB (`collection://63a30ec4-8e03-4a69-aaa2-72f29d69af14`) — initiative mana yang terkait? Apakah aligned dengan OKR kuartal ini?
- Evaluasi scope:
  - **Quick-fix OK jika:** isolated change, tidak menambah tech debt, area ini jarang diubah
  - **Proper solution needed jika:** area ini akan sering diubah, atau sudah ada 3+ issues di area/module yang sama
- Jika butuh proper solution → consider membuat parent issue "Refactor [area]" dulu, lalu issue ini jadi sub-task
- Jika fix ini sadar menambah tech debt → tambahkan label `tech-debt` di GitHub Issue dengan catatan kapan harus dibayar

1. **Buat GitHub Issue** via `gh issue create --repo rachmad-jenss/haul-calc`:
   - `--title`: deskripsi singkat task
   - `--body`: detail teknis lengkap — problem statement, solution, acceptance criteria, checklist
   - `--label`: sesuai konteks (Feature→`feature`, Bug→`bug`, Chore→`chore`, Docs→`documentation`) + selalu tambah `linear-sync`
   - Setelah issue terbuat, catat nomor `{N}` dari output URL, lalu rename title: `gh issue edit {N} --title "[DAS-{N}] deskripsi singkat"` — format title GitHub Issue harus konsisten dengan Notion
   - Catat GitHub Issue number → ini jadi identifier task: **`DAS-{N}`**

2. **Cek dulu apakah Notion task sudah ada** — search by keyword di Tasks DB (`collection://2f8c4f5f-1479-4f28-8136-2368d18e2090`). Jika sudah ada, **update**. Jika belum, **buat baru** via `notion-create-pages`:
   - `Title`: `[DAS-{N}] deskripsi singkat`
   - `Code`: `DAS-{N}`
   - `Status`: "In Progress" atau "Next Up"
   - `Priority`: P1/P2/P3 (tanya user)
   - `Type`: Feature / Bug / Chore / Docs
   - `date:Due:start`: target deadline (tanya user, ISO format)
   - `Initiative`: link ke initiative yang relevan — cek Initiatives DB, jika tidak ada yang cocok, **buat initiative baru**
   - `Parent Issue`: jika task ini bagian dari issue lebih besar, search parent task di Notion dan link
   - `Next action`: "Coding" (jika langsung dikerjakan) atau kosong
   - `Product/App`: link ke HaulCalc — Desktop App
   - `Repo`: link ke haul-calc

3. **Isi konten halaman Notion** — jangan biarkan blank. Tulis problem statement, solution, acceptance criteria.
4. **Deadline sinkron** — Due di Notion = target deadline yang disepakati.
5. **Parent Issue sinkron** — Parent Issue di Notion harus menunjuk ke parent task yang sama.

> 📌 Saat Linear aktif kembali: buat issue di Linear, lalu update Code di Notion ke `DAS-{LinearID}` jika nomor berbeda dari nomor GitHub.

### Batch subagent (mengerjakan beberapa isu sekaligus):
Jika user minta mengerjakan beberapa isu secara paralel menggunakan subagent:
- **Analisis dulu file mana saja yang akan diedit tiap isu** sebelum memulai
- **Utamakan isu yang file-nya TIDAK tumpang tindih** — hindari 2 subagent mengedit file yang sama agar tidak terjadi merge conflict antar PR
- Jika ada isu yang kemungkinan edit file yang sama, kerjakan secara **sequential** (satu selesai dulu, baru yang lain)
- Setiap subagent harus buat branch sendiri dari `main` terbaru

### Saat mulai kerja (WAJIB):
1. Update Notion task:
   - **Status** → "In Progress"
   - **Priority** → set P1/P2/P3 (tanya user jika belum di-set)
   - **Type** → auto dari branch prefix: `feature/` → Feature, `fix/` → Bug, `chore/` → Chore
   - **Due** → set target deadline (tanya user jika belum di-set)
   - **Initiative** → link ke initiative yang relevan (tanya user jika belum di-set)
   - **Next action** → "Coding"

2. **Revalidasi Issue (WAJIB sebelum coding):**
   - Baca codebase terkini di area yang akan diubah — jangan langsung coding berdasarkan deskripsi issue saja
   - Cek `git log --oneline` untuk PR yang sudah merged sejak issue dibuat — apakah ada perubahan yang mempengaruhi approach?
   - Bandingkan kondisi codebase sekarang dengan suggested approach di deskripsi issue (Notion)
   - **Jika approach sudah tidak relevan:**
     - Update konten page Notion dengan approach baru
     - Tambahkan catatan: "Approach diubah — codebase sudah berevolusi sejak issue dibuat [detail perubahan]"
   - **Jika scope berubah** (terlalu besar/kecil setelah revalidasi):
     - Split atau merge issue sesuai kebutuhan
     - Update parent-child relationship di Notion dan GitHub Issues
   - Jika tidak ada perubahan signifikan, lanjut ke step berikutnya

3. Buat branch dari `main` dengan format di bawah

### Branch naming:
```text
main → stable release — NEVER push directly
feature/DAS-{N}-desc  → fitur baru   (contoh: feature/DAS-5-add-haul-road-input)
fix/DAS-{N}-desc      → bug fix      (contoh: fix/DAS-7-fix-rpc-timeout)
chore/DAS-{N}-desc    → maintenance  (contoh: chore/DAS-9-update-deps)
```

### Saat selesai coding:
1. Commit: `DAS-{N}: deskripsi perubahan`

2. **Codex Code Review (WAJIB sebelum buat PR):**
   - Spawn Codex agent untuk review hasil kerja sebelum PR dibuat
   - Jalankan via `codex:rescue` atau spawn agent `codex:codex-rescue` dengan prompt:
     ```
     Review kode yang baru diubah di repo ini. Cek:
     1. Correctness — logic benar, edge cases handled
     2. Security — tidak ada vulnerability (injection, exposure, bypass, dll)
     3. Convention — sesuai CLAUDE.md dan project conventions
     4. Test coverage — apakah test sudah cukup untuk perubahan ini
     5. Regresi — apakah perubahan ini bisa break fitur lain
     6. Long-term — apakah perubahan ini baik untuk jangka panjang dan tidak meninggalkan tech debt
     Berikan daftar findings dan saran fix.
     ```
   - Jika `codex:rescue` tidak bisa di-spawn atau tidak merespons → fallback: spawn subagent `feature-dev:code-reviewer` dengan prompt yang sama
   - Jika Codex menemukan critical issue → fix sebelum buat PR
   - Jika Codex menemukan medium/low issue → fix atau catat sebagai tech-debt

3. Buat PR sebagai **Draft** — title harus include `DAS-{N}` (uppercase)
   - Gunakan `gh pr create --draft` agar CI tidak jalan sampai siap
   - Sertakan `Closes #{github_issue_number}` di body PR agar GitHub Issue ter-close otomatis saat merge
   - Push semua fix dari Codex review, address review comments, dll selama masih draft (CI tidak jalan = hemat minutes)
4. Setelah semua fix selesai, mark **Ready for Review** → `gh pr ready {PR_NUMBER}`
   - CI baru jalan di titik ini (1x saja, bukan setiap push)
5. Update Notion **Next action** → "PR review"
6. Merge via **Squash & Merge**

### Setelah PR dibuat (WAJIB — 3 FASE, SEMUA HARUS SELESAI):
**JANGAN BERHENTI setelah CI hijau.** Review dari Codex/CodeRabbit butuh waktu 3-10 menit setelah PR dibuat. Test plan di deskripsi PR WAJIB dijalankan. Ketiga fase di bawah harus diselesaikan sebelum PR dianggap siap merge.

Gunakan `/loop 3m` untuk polling otomatis setiap 3 menit sampai semua selesai.

---

**FASE A — CI Checks (exit: semua checks hijau)**
1. Poll status CI checks via `gh pr checks {PR_NUMBER}`
2. Jika ada yang fail → perbaiki, push, tunggu CI run lagi
3. **JANGAN lanjut ke Fase B sampai semua CI checks passed**
   - Update Notion **Next action** → "Waiting CI"

---

**FASE B — Review Comments (exit: semua review resolved)**
⚠️ **PENTING: Review dari Codex dan CodeRabbit butuh waktu. JANGAN anggap selesai hanya karena belum ada komentar.**

1. Setelah CI hijau, **tunggu minimal 5 menit** sebelum cek review pertama kali — beri waktu reviewer otomatis menyelesaikan analisis
2. Cek komentar review via `gh pr view {PR_NUMBER} --comments` dan `gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/comments`
3. Cek apakah reviewer sudah memberikan review:
   - **CodeRabbit** — biasanya muncul 3-5 menit setelah PR dibuat (cek komentar dari `coderabbitai[bot]`)
   - **Codex** — code review (cek dari `codex[bot]` atau reviewer lain yang dikonfigurasi)
4. Jika belum semua reviewer muncul, **poll lagi setiap 3 menit** — JANGAN skip
5. Untuk setiap komentar review:
   - Analisis apakah perlu fix atau hanya informational
   - Jika perlu fix → perbaiki kode, push
   - Balas komentar dengan penjelasan apa yang di-fix
   - Tandai **resolved** setelah diperbaiki
6. Setelah push fix → tunggu CI hijau lagi (kembali ke Fase A) → lalu cek review lagi
7. **JANGAN lanjut ke Fase C sampai:**
   - Minimal CodeRabbit sudah review (jika dikonfigurasi)
   - Semua komentar yang butuh fix sudah resolved
   - Update Notion **Next action** → "Fix review comments"

---

**FASE C — Test Plan (exit: semua test plan item checked) ⛔ WAJIB — TIDAK BOLEH DISKIP**
⚠️ **FASE INI MANDATORY. PR TIDAK BOLEH dianggap siap merge tanpa menjalankan test plan.**

1. Baca deskripsi PR — cari section "Test plan" atau "Test Plan"
2. Jika tidak ada test plan di deskripsi PR, **tambahkan test plan** berdasarkan perubahan yang dibuat
3. Jalankan setiap item test plan satu per satu:
   - HaulCalc adalah desktop app — jalankan E2E smoke tests via Playwright di `tests/smoke/`
   - Untuk manual testing yang memerlukan app: jalankan `pnpm tauri dev` dan verifikasi secara visual
4. Setelah setiap item berhasil, **edit deskripsi PR** untuk checklist item tersebut (`- [x]`)
5. Jika ada item yang gagal → perbaiki kode, push, tunggu CI + review lagi (kembali ke Fase A)
6. **Setelah SEMUA item test plan ter-checked:**
   - Update Notion **Next action** → "Ready to merge"
   - Kasih **notifikasi ke user** bahwa PR siap di-merge beserta summary PR

---

**Exit condition (SEMUA harus terpenuhi sebelum berhenti):**
- ✅ Semua CI checks hijau
- ✅ Codex code review passed (sebelum PR dibuat)
- ✅ Minimal CodeRabbit sudah review (jika dikonfigurasi)
- ✅ Semua review comments yang butuh fix sudah resolved
- ✅ Semua item test plan di deskripsi PR sudah checked (`[x]`)
- ✅ User sudah dinotifikasi PR siap merge

### Setelah PR merged / issue Done:
Setelah user merge PR (atau issue di-close), lakukan cleanup & sync:

1. **Verify status sinkron:**
   - Notion status harus "Done" (update manual via Notion MCP)
   - GitHub Issue harus "closed" (otomatis via `Closes #N` di PR body — jika tidak, close manual: `gh issue close {number} --repo rachmad-jenss/haul-calc`)
   - Jika salah satu belum terupdate, **update manual**

2. **Update Notion task page** dengan info PR:
   - Tambahkan di konten page: link ke PR, summary perubahan, dan catatan penting
   - Format: `## PR Merged\n- PR: #XX (link)\n- Summary: deskripsi singkat apa yang diubah\n- Catatan: hal penting yang perlu diketahui`

3. *(Linear paused — skip. Saat aktif kembali: pastikan Linear issue ter-update ke Done dan PR ter-link.)*

4. **Update Notion Next action** → kosong (task selesai)

5. **Cek parent issue:**
   - Jika semua sub-tasks dari parent issue sudah Done, update parent issue juga ke Done (di Notion dan GitHub Issues)
   - Jika belum semua selesai, biarkan parent tetap In Progress

6. **Hapus branch** — setelah merged, delete branch dari remote dan local:
   - Remote: `git push origin --delete <branch-name>`
   - Local: `git branch -d <branch-name>`

7. **Update README** (jika diperlukan):
   - Cek apakah perubahan ini mempengaruhi cara setup, install, config, atau cara penggunaan app
   - Jika ada perubahan user-facing (perintah baru, env var baru, fitur baru yang perlu didokumentasikan) → update `README.md`
   - Jika tidak ada perubahan user-facing → skip

### Jika blocked:
- Update Notion **Status** → "Blocked"
- Update Notion **Next action** → alasan blocked (e.g. "Blocked: haul-pave API belum merged", "Blocked: waiting dependency X")
- Setelah unblocked, kembalikan Status ke "In Progress" dan update Next action sesuai fase saat ini

### Notion Tasks Convention:
- Title selalu diawali `[DAS-{N}]` — contoh: `[DAS-5] Add haul road input form`
- Wajib isi **Product/App** → `HaulCalc — Desktop App`
- Wajib isi **Repo** → `haul-calc`

## Notion Sync
- Notion sync saat ini dilakukan **manual via Notion MCP** (GitHub Actions billing issue)
- Saat billing fixed, setup `.github/workflows/notion-sync.yml` (copy dari repo lain, pakai `secrets.NOTION_TASKS_DB`)
- Regex yang dipakai: `\b([A-Z]{2,5}-\d+)\b` — hanya match uppercase
- Pastikan PR title selalu include `DAS-{ID}` agar sync berjalan saat diaktifkan

## AI Attribution Rules
- JANGAN pernah tambahkan `Co-Authored-By` di commit message
- JANGAN pernah tambahkan "Generated with Claude Code" atau branding AI apapun di PR description
- Commit dan PR harus terlihat seperti ditulis manusia biasa

## Key File Locations
- RPC client: `src/lib/haulpave-client.ts`
- TypeScript types: `src/lib/types.ts`
- Python bridge: `python-sidecar/bridge.py`
- Rust bridge: `src-tauri/src/bridge.rs`
- E2E tests: `tests/smoke/`

## Development Setup
```bash
pnpm install
pnpm tauri dev          # start dev server + Tauri window
```

## Sidecar Development
```bash
cd python-sidecar
pip install -e ".[dev]"  # or: pip install haulpave
python bridge.py         # test: echo '{"id":1,"method":"health_check","params":{}}' | python bridge.py
```

## haul-pave Dependency
TypeScript types in `src/lib/types.ts` mirror haul-pave Pydantic schemas.
When haul-pave adds/changes models, update `types.ts` accordingly.
bridge.py adapter functions must match haul-pave public API exactly.
