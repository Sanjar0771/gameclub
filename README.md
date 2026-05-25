# 🎮 GameClub

Online gameclub PC bron qilish platformasi — Telegram bot + WebApp.

**Stack:** Node.js + TypeScript + grammY + Fastify + Prisma + PostgreSQL + Next.js 14 + Tailwind.

**Deploy:** Railway ($5) + Vercel (bepul).

---

## 📋 Mundarija

- [Loyiha tuzilishi](#loyiha-tuzilishi)
- [5 ta foydalanuvchi roli](#5-ta-foydalanuvchi-roli)
- [Local development](#local-development)
- [Deploy](#deploy)
- [Birinchi konfiguratsiya](#birinchi-konfiguratsiya)
- [Testlash](#testlash)

---

## Loyiha tuzilishi

```
gameclub/
├── apps/
│   ├── server/          # Bot + API + cron (Railway)
│   └── webapp/          # Next.js WebApp (Vercel)
├── packages/
│   ├── db/              # Prisma schema + client
│   ├── shared/          # Umumiy types, konstantalar, validatorlar
│   └── i18n/            # UZ + RU tarjimalar
├── Dockerfile           # Railway uchun
├── railway.json
└── package.json         # pnpm monorepo
```

---

## 5 ta foydalanuvchi roli

| Rol | Vazifa | Kirish usuli |
|-----|--------|--------------|
| **SUPER_ADMIN** | Hammaga ruxsat, moliyaviy nazorat | Telegram ID + login/parol |
| **PRE_ADMIN** | Texnik yordam, hamkor arizalari | Telegram ID + login/parol |
| **PARTNER** | Gameclub egasi — filial, PC, narx, balans | Telegram ID, hamkor arizasi |
| **ASSISTANT** | Filial menejeri — chegaralangan huquqlar | Partner qo'shadi (Telegram ID) |
| **CUSTOMER** | Mijoz — bron qilish, baholash | Avtomatik (har kim) |

---

## Local development

### 1. Bog'liqliklar

- **Node.js 20+**
- **pnpm 9+**: `npm i -g pnpm`
- **PostgreSQL 15+** (local yoki Docker)
- **Telegram bot**: [@BotFather](https://t.me/BotFather) orqali yarating

### 2. Loyiha yuklash

```bash
git clone <repo-url>
cd gameclub
pnpm install
```

### 3. .env yaratish

`.env.example` ni nusxa qiling va to'ldiring:

```bash
cp .env.example .env
```

Asosiy o'zgaruvchilar:
- `BOT_TOKEN` — @BotFather'dan
- `SUPER_ADMIN_TELEGRAM_ID` — sizning Telegram ID (@userinfobot)
- `DATABASE_URL` — PostgreSQL ulanish stringi
- `JWT_SECRET`, `QR_SECRET` — `openssl rand -hex 32`
- `CLOUDINARY_*` — [cloudinary.com](https://cloudinary.com) (bepul)

### 4. Database

Local Postgres (Docker):
```bash
docker run -d --name gameclub-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gameclub \
  -p 5432:5432 \
  postgres:16-alpine
```

Migratsiya:
```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Server + WebApp ishga tushirish

Ikki terminalda:

```bash
# Terminal 1: Server (bot + API)
pnpm --filter @gameclub/server dev
# → http://localhost:3001

# Terminal 2: WebApp
pnpm --filter @gameclub/webapp dev
# → http://localhost:3000
```

Boshqa foydali komandalar:

```bash
pnpm db:studio              # Prisma Studio (GUI)
pnpm --filter @gameclub/server typecheck
pnpm --filter @gameclub/webapp build
```

---

## Deploy

### Variant 1: Railway + Vercel (tavsiya etiladi, ~$5/oy)

#### A. Railway — server + database

1. [railway.app](https://railway.app) → New Project → **Empty Project**.
2. **+ New** → **Database** → **PostgreSQL**. Railway avtomatik `DATABASE_URL` yaratadi.
3. **+ New** → **GitHub Repo** → repository tanlang.
4. Service sozlamalarida:
   - **Root Directory**: `/` (loyiha ildizi)
   - **Builder**: Dockerfile (`railway.json` avtomatik o'qiydi)
   - **Variables** → quyidagilarni qo'shing:
     ```
     NODE_ENV=production
     TZ=Asia/Tashkent
     BOT_TOKEN=...
     BOT_USERNAME=...
     SUPER_ADMIN_TELEGRAM_ID=...
     SUPER_ADMIN_LOGIN=admin
     SUPER_ADMIN_PASSWORD=...
     JWT_SECRET=...
     QR_SECRET=...
     CLOUDINARY_CLOUD_NAME=...
     CLOUDINARY_API_KEY=...
     CLOUDINARY_API_SECRET=...
     WEBAPP_URL=https://your-app.vercel.app   # Vercel deploydan keyin yangilang
     BOT_WEBAPP_URL=https://your-app.vercel.app
     ```
   - `DATABASE_URL` Railway tomonidan avtomatik beriladi (Postgres bilan **Reference Variable** ulang).
5. **Settings** → **Domains** → **Generate Domain** → URL'ni nusxalang (masalan: `your-app.up.railway.app`).
6. **Deploy** tugmasini bosing.

#### B. Vercel — WebApp

1. [vercel.com](https://vercel.com) → New Project → GitHub repo.
2. Konfiguratsiya:
   - **Root Directory**: `apps/webapp`
   - **Framework Preset**: Next.js
   - **Build Command**: `cd ../.. && pnpm install && pnpm --filter @gameclub/webapp build`
   - **Install Command**: `echo skip`
3. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-app.up.railway.app
   ```
4. Deploy → URL nusxalang.

#### C. Botga WebApp ulash

1. Railway'da `BOT_WEBAPP_URL` va `WEBAPP_URL` qiymatlarini Vercel URL'ga yangilang → Redeploy.
2. [@BotFather](https://t.me/BotFather):
   - `/mybots` → botni tanlang → **Bot Settings** → **Menu Button** → **Configure Menu Button** → URL: `https://your-app.vercel.app`
   - `/setdomain` → bot'ni tanlang → `your-app.vercel.app`

### Variant 2: Hammasi Railway'da (kichik resurs)

Vercel'siz Next.js'ni Railway'da ham deploy qilish mumkin, lekin Vercel kerakli bo'lgani sababli tavsiya etilmaydi (ortiqcha resurs ishlatadi).

---

## Birinchi konfiguratsiya

Deploy qilingach:

1. **Super-admin avtomatik yaratiladi** seed orqali (`SUPER_ADMIN_TELEGRAM_ID` ga ko'ra).
2. Botga `/start` yuboring — super-admin paneliga kirasiz.
3. WebApp orqali:
   - Filial komissiyasini sozlang (5-20%)
   - Bot matnlarini moslang
   - Birinchi hamkorni tasdiqlang

### Hamkor qanday qo'shiladi?

1. Hamkor botga `/start` → `/register` → ma'lumotlarini yuboradi.
2. Super-admin yoki pre-admin admin panelda **Arizalar** ostida tasdiqlaydi.
3. Hamkor WebApp orqali filial qo'shadi, PC turi, narx belgilaydi.
4. Mijozlar shu filialni topib bron qilishi mumkin.

---

## Testlash

### Bot orqali

1. Botga `/start` → mijoz sifatida WebApp ochiladi.
2. Gameclub tanlang → PC → vaqt → bron → karta raqami ko'rsatiladi.
3. Botga chek rasmi yuboring.
4. Super-admin tasdiqlasin → QR-kod yuboriladi.
5. Hamkor `partner/scan` orqali QR'ni tasdiqlasin → balansga pul qo'shiladi.

### Avtomatik testlar (TODO)

Vaqt qolsa qo'shish kerak:
- API integration testlari (Vitest + Supertest)
- E2E test (Playwright)

---

## Asosiy URL'lar

- **Bot**: `https://t.me/<BOT_USERNAME>`
- **WebApp**: `https://your-app.vercel.app`
- **API**: `https://your-app.up.railway.app/api`
- **Health**: `https://your-app.up.railway.app/health`

---

## Texnik tafsilotlar

### Komissiya hisoblash

- Mijoz to'laydi: `totalAmount`
- Komissiya: `commissionAmount = totalAmount * commissionPct / 100`
- Hamkor oladi: `partnerAmount = totalAmount - commissionAmount`

### Vaqt slotlari

- Slot uzunligi: 30 daqiqa
- Min bron: 60 daqiqa
- Max bron: 24 soat
- Eng erta bron: hozir (o'tgan vaqt mumkin emas)
- Eng kech bron: 7 kun keyin

### Auto-jobs (cron, har minutda)

- 30 min oldin eslatma yuborish
- Bron vaqtidan 30 min o'tgach va QR'siz → `NO_SHOW` (pul hamkorga)
- `ACTIVE` bron `endAt` ga yetsa → `COMPLETED`
- `PENDING_PAYMENT` startAt'dan o'tsa → `EXPIRED`
- Yopiq filiallar `closedUntil` ga yetsa → avtomatik ochilish

### Xavfsizlik

- JWT (30 kun)
- HMAC-SHA256 imzolangan QR (auto-tasdiq mumkin emas)
- Prisma orqali SQL-injection yo'q
- Helmet + CORS + Rate limit (200 req/min)
- Audit log barcha admin amallariga

---

## Yordam

Muammolar bo'lsa:
- Loglarni Railway dashboard'da ko'ring
- Database to'g'ri ulanmaganmi? `pnpm db:studio` orqali tekshiring
- Bot ishlamayaptimi? `BOT_TOKEN` to'g'rimi, webhook yo'qmi?

---

## Litsenziya

Xususiy ishlanma. Barcha huquqlar himoyalangan.
