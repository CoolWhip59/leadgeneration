# Isletme Lead Generation SaaS

Google Places API veya OpenStreetMap Overpass API uzerinden sehir + sektor bazli isletmeleri cekip website'i olmayanlari tespit eden production-ready lead generation sistemi.

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
npm run prisma:seed
npm run dev
```

Worker'i ayrica calistirin:

```
cd apps/api
npm run worker:dev
```

### 1.1) WhatsApp Otomatik Mesaj (Opsiyonel)

Tarama job'i `COMPLETED` oldugunda, websitesi olmayan isletmelere otomatik WhatsApp template mesaji gonderebilirsiniz.

`apps/api/.env` icine su ayarlari ekleyin:

```
WHATSAPP_AUTO_SEND_ENABLED=true
WHATSAPP_REQUIRE_OPT_IN=true
WHATSAPP_TEST_MODE=true
WHATSAPP_TEST_OVERRIDE_TO=+905xxxxxxxxx
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_TEMPLATE_NAME=...
WHATSAPP_TEMPLATE_LANG=tr
```

Notlar:
- `WHATSAPP_TEST_MODE=true` iken canli numaralara gitmez, test etmek icin guvenli moddur.
- `WHATSAPP_REQUIRE_OPT_IN=true` ile sadece `whatsappOptIn=true` olan kayitlara gonderim yapilir.
- Sistem ayni job + isletme icin tek kayit tutar ve tekrar gonderimi engeller.

### 2) Frontend

```
cd apps/web
cp .env.example .env
npm install
npm run dev
```

## Places Provider

Varsayilan: `PLACES_PROVIDER=osm`

OSM Overpass icin:
- Google API key gerekmez
- `PLACES_PROVIDER=osm`
- `OVERPASS_ENDPOINT` ve `OVERPASS_TIMEOUT_SEC` ayarlanabilir

Google icin:
- `PLACES_PROVIDER=google`
- `GOOGLE_PLACES_API_KEY` gerekli

OSM quick test:
- Sehirler: Istanbul + Ankara
- Kategoriler: kuafor, oto-yikama

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
- WhatsApp otomasyon modulu opsiyoneldir ve varsayilan olarak kapalidir
- Canli gonderim oncesi acik riza/opt-in sureci uygulanmalidir
- API key'ler `.env` icindedir

## Notlar
- Deduplication `externalId` uzerinden yapilir.
- Multi-city job tek istekte birden fazla sehir icin tarama baslatir.
- Redis cache ile Places sonuclari TTL boyunca saklanir.
- `WORKER_CONCURRENCY` ile sehir bazli paralel isleme ayarlanir.
- Cache icin `WEBSITE_RECHECK_DAYS` ile yeniden kontrol periyodu belirlenir.
