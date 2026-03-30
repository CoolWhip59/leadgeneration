import { PrismaClient } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';

const prisma = new PrismaClient();

const NOMINATIM_ENDPOINT =
  process.env.NOMINATIM_ENDPOINT || 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = Number(process.env.NOMINATIM_MIN_INTERVAL_MS || 1000);

async function fetchBbox(cityName: string) {
  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    countrycodes: 'tr',
    q: cityName,
  });

  const res = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    headers: {
      'User-Agent': 'isletme-leads/1.0 (admin@local.dev)',
      'Accept-Language': 'tr',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`Nominatim ${res.status}: ${text}`);
    (error as any).status = res.status;
    throw error;
  }

  const data = (await res.json()) as Array<{ boundingbox: [string, string, string, string] }>;
  if (!data?.length || !data[0]?.boundingbox) {
    throw new Error('Nominatim bbox not found');
  }

  const [south, north, west, east] = data[0].boundingbox.map((v) => Number(v));
  return { south, west, north, east };
}

async function fetchWithRetry(cityName: string) {
  const maxRetries = 3;
  const backoffs = [1000, 2000, 4000];
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fetchBbox(cityName);
    } catch (err: any) {
      const status = err?.status as number | undefined;
      const isRetryable = status === 429 || (status !== undefined && status >= 500);
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      await delay(backoffs[attempt - 1]);
    }
  }
  throw new Error('Unreachable');
}

async function main() {
  const cities = await prisma.city.findMany({
    where: {
      deletedAt: null,
      OR: [
        { bboxSouth: null },
        { bboxWest: null },
        { bboxNorth: null },
        { bboxEast: null },
      ],
    },
    orderBy: { name: 'asc' },
  });

  const total = cities.length;
  let done = 0;
  let ok = 0;
  let failed = 0;

  for (const city of cities) {
    done += 1;
    try {
      const bbox = await fetchWithRetry(city.name);
      await prisma.city.update({
        where: { id: city.id },
        data: {
          bboxSouth: bbox.south,
          bboxWest: bbox.west,
          bboxNorth: bbox.north,
          bboxEast: bbox.east,
        },
      });
      ok += 1;
      console.log(`${done}/${total} ${city.name} OK`);
    } catch (err: any) {
      failed += 1;
      console.log(`${done}/${total} ${city.name} FAIL: ${err?.message || err}`);
    }

    await delay(MIN_INTERVAL_MS);
  }

  console.log(`Done. total=${total} ok=${ok} failed=${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
