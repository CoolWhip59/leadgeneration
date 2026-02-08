"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./modules/app/app.module");
const client_1 = require("@prisma/client");
const bcrypt = require("bcryptjs");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    app.enableCors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = process.env.PORT ? Number(process.env.PORT) : 4000;
    await app.listen(port);
    common_1.Logger.log(`API listening on :${port}`);
    const shouldSeed = process.env.SEED_ON_START === 'true' && (process.env.NODE_ENV || 'development') === 'development';
    if (shouldSeed) {
        const prisma = new client_1.PrismaClient();
        try {
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@local.dev';
            const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
            const passwordHash = await bcrypt.hash(adminPassword, 12);
            await prisma.user.upsert({
                where: { email: adminEmail },
                update: { passwordHash, role: 'admin', deletedAt: null },
                create: { email: adminEmail, passwordHash, role: 'admin' },
            });
        }
        finally {
            await prisma.$disconnect();
        }
    }
}
bootstrap();
//# sourceMappingURL=main.js.map