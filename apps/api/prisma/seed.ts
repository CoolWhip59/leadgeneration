import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = 'admin@local.dev';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!';

const cities = [
  'Istanbul',
  'Ankara',
  'Izmir',
  'Bursa',
  'Antalya',
  'Adana',
  'Konya',
  'Gaziantep',
  'Kayseri',
  'Mersin',
];

const categories = [
  { name: 'Kuafor', slug: 'kuafor' },
  { name: 'Berber', slug: 'berber' },
  { name: 'Oto Yikama', slug: 'oto-yikama' },
  { name: 'Disci', slug: 'disci' },
  { name: 'Restoran', slug: 'restoran' },
  { name: 'Kafe', slug: 'kafe' },
  { name: 'Eczane', slug: 'eczane' },
  { name: 'Veteriner', slug: 'veteriner' },
  { name: 'Spor Salonu', slug: 'spor-salonu' },
  { name: 'Guzellik Merkezi', slug: 'guzellik-merkezi' },
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: 'admin', deletedAt: null },
    create: { email: adminEmail, passwordHash, role: 'admin' },
  });

  for (const name of cities) {
    await prisma.city.upsert({
      where: { name_country: { name, country: 'TR' } },
      update: { deletedAt: null },
      create: { name, country: 'TR' },
    });
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, deletedAt: null },
      create: { name: category.name, slug: category.slug },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
