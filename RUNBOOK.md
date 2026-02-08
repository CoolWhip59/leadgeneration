# End-to-End Runbook (Local Dev)

Bu runbook, API + Worker + Web'i localde sorunsuz calistirman icin gerekli adimlari icerir.

## Quick start

```
npm run setup:local
npm run dev
npm run verify:local
```

## 1) On Kosullar

- Node.js: 20.x LTS (18.x calisir ama 20.x onerilir)
- npm: 9+ (pnpm kullanacaksan 8+)
- Docker: Postgres + Redis icin onerilir (zorunlu degil ama tavsiye edilir)

Portlar:
- API: 4000
- Web: 3000
- Postgres: 5432
- Redis: 6379

Cakisma kontrolu (Windows PowerShell):
```
Get-NetTCPConnection -LocalPort 3000,4000,5432,6379 -ErrorAction SilentlyContinue
```

## 2) Environment Dosyalari

API icin:
```
cp apps/api/.env.example apps/api/.env
```

Web icin:
```
cp apps/web/.env.example apps/web/.env
```

Minimum gerekli degiskenler (apps/api/.env):
- DATABASE_URL
- REDIS_URL
- GOOGLE_PLACES_API_KEY (bos olabilir, joblar Places'te fail olur)
- GOOGLE_PLACES_CACHE_TTL_SEC
- WORKER_CONCURRENCY
- JWT_SECRET
- CORS_ORIGIN
- ADMIN_EMAIL
- ADMIN_PASSWORD
- SEED_ON_START (opsiyonel, sadece NODE_ENV=development)

Minimum gerekli degiskenler (apps/web/.env):
- NEXT_PUBLIC_API_BASE

## 3) Docker Compose (Postgres + Redis)

Root'ta `docker-compose.yml` mevcut.

Baslat:
```
docker compose up -d
```

Saglik kontrolu:
```
docker ps
```

## 4) DB Migration + Admin Kullanici

```
cd apps/api
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Admin user default:
- admin@local.dev / Admin123!

## 5) Projeyi Calistirma

Tek komutla (root):
```
npm install
npm run dev
```

Ayri terminal ile:
- Terminal 1:
```
cd apps/api
npm run dev
```
- Terminal 2:
```
cd apps/api
npm run worker:dev
```
- Terminal 3:
```
cd apps/web
npm run dev
```

## 6) Smoke Test Checklist

- API health: GET http://localhost:4000/health
- Auth register/login
- Sehir + sektor ekle
- Job olustur (multi city)
- SSE: GET /jobs/:id/stream?token=JWT
- Errors panel (bos liste donmeli)
- Redis cache: ayni sehir+sektor icin tekrar job olustur, Places'den cache hit bekle

## 7) Olasi Hatalar

- Prisma generate yoksa: `npm run prisma:generate`
- CORS hatasi: `CORS_ORIGIN=http://localhost:3000`
- Port cakismasi: baska app kapat
- WSL/Windows: Docker portlari WSL tarafinda acik olmali

## 8) Basarili Calistigini Nasil Anlarim?

- Web UI aciliyor (http://localhost:3000)
- /health `{"status":"ok"}` donuyor
- Job calisiyor ve SSE progress akiyor
- Errors panel listesi geliyor

