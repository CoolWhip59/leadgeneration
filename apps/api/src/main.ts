import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  Logger.log(`API listening on :${port}`);

  const shouldSeed =
    process.env.SEED_ON_START === 'true' && (process.env.NODE_ENV || 'development') === 'development';
  if (shouldSeed) {
    const prisma = new PrismaClient();
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@local.dev';
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
      const passwordHash = await bcrypt.hash(adminPassword, 12);

      await prisma.user.upsert({
        where: { email: adminEmail },
        update: { passwordHash, role: 'admin', deletedAt: null },
        create: { email: adminEmail, passwordHash, role: 'admin' },
      });
    } finally {
      await prisma.$disconnect();
    }
  }
}

bootstrap();
