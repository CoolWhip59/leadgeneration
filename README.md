# Isletme Lead Generation SaaS

Google Places API uzerinden sehir + sektor bazli isletmeleri cekip website'i olmayanlari tespit eden production-ready lead generation sistemi.

## Mimari
- Backend: NestJS + Prisma + PostgreSQL
- Queue: BullMQ + Redis
- Worker: ayrı process (worker.ts)
- Frontend: Next.js (App Router)
- Auth: JWT

## Klasor Yapisi
- `apps/api` NestJS API
- `apps/api/src/worker.ts` BullMQ worker
- `apps/web` Next.js dashboard

## Kurulum

### 1) Backend

```
cd apps/api
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Worker'i ayrica calistirin:

```
cd apps/api
node dist/worker.js
```

Gelistirme icin:
```
cd apps/api
ts-node src/worker.ts
```

### 2) Frontend

```
cd apps/web
cp .env.example .env
npm install
npm run dev
```

## API Ozet
- `POST /auth/register`
- `POST /auth/login`
- `GET /cities`
- `GET /categories`
- `POST /cities` (JWT)
- `POST /categories` (JWT)
- `POST /jobs` (JWT, cityIds + categoryId)
- `GET /jobs` (JWT)
- `GET /businesses` (JWT)
- `GET /businesses/export` (JWT, CSV)

## Web Site Kontrol Kurallari
- Website alani bos ise: `NO_WEBSITE`
- Sadece sosyal medya linki: `SOCIAL_ONLY`
- 5 saniye icinde cevap yok: `TIMEOUT`
- HTTP 4xx / 5xx: `HTTP_ERROR`

## KVKK / GDPR
- Sadece isletme bilgileri saklanir
- E-posta/spam entegrasyonu yoktur
- API key'ler `.env` icindedir

## Notlar
- Deduplication `placeId` uzerinden yapilir.
- Multi-city job tek istekte birden fazla sehir icin tarama baslatir.
- Redis cache ile Places sonuclari TTL boyunca saklanir (`GOOGLE_PLACES_CACHE_TTL_SEC`).
- `WORKER_CONCURRENCY` ile sehir bazli paralel isleme ayarlanir.
- Cache icin `WEBSITE_RECHECK_DAYS` ile yeniden kontrol periyodu belirlenir.
