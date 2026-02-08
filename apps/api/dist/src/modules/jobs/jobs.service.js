"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
let JobsService = class JobsService {
    constructor(prisma, queue) {
        this.prisma = prisma;
        this.queue = queue;
    }
    retryableError(errorCode) {
        if (!errorCode)
            return false;
        const nonRetryable = new Set(['INVALID_ARGUMENT', 'AUTH_ERROR', 'FORBIDDEN', 'NOT_FOUND']);
        return !nonRetryable.has(errorCode);
    }
    async create(userId, dto) {
        const uniqueCityIds = Array.from(new Set(dto.cityIds));
        const category = await this.prisma.category.findFirst({
            where: { id: dto.categoryId, deletedAt: null },
        });
        const cities = await this.prisma.city.findMany({
            where: { id: { in: uniqueCityIds }, deletedAt: null },
        });
        if (!category || cities.length !== uniqueCityIds.length) {
            throw new common_1.NotFoundException('City or category not found');
        }
        const job = await this.prisma.job.create({
            data: {
                userId,
                categoryId: category.id,
            },
        });
        for (const city of cities) {
            const jobCity = await this.prisma.jobCity.create({
                data: { jobId: job.id, cityId: city.id },
            });
            const queueJob = await this.queue.add('lead-scan', {
                jobId: job.id,
                jobCityId: jobCity.id,
                city: city.name,
                category: category.name,
                cityId: city.id,
                categoryId: category.id,
            }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
                removeOnComplete: 100,
                removeOnFail: 100,
            });
            await this.prisma.jobCity.update({
                where: { id: jobCity.id },
                data: { queueJobId: String(queueJob.id) },
            });
        }
        return job;
    }
    list(userId) {
        return this.prisma.job.findMany({
            where: { userId, deletedAt: null },
            include: {
                category: true,
                jobCities: {
                    include: { city: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async get(userId, id) {
        const job = await this.prisma.job.findFirst({
            where: { id, userId, deletedAt: null },
            include: {
                category: true,
                jobCities: {
                    include: { city: true },
                },
            },
        });
        if (!job) {
            throw new common_1.NotFoundException('Job not found');
        }
        return job;
    }
    async getErrors(userId, id) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            select: { role: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const job = await this.prisma.job.findFirst({
            where: { id, userId, deletedAt: null },
        });
        if (!job) {
            throw new common_1.NotFoundException('Job not found');
        }
        const logs = await this.prisma.jobCityErrorLog.findMany({
            where: { jobId: id },
            include: {
                jobCity: {
                    include: { city: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const canViewStack = user.role === 'admin';
        return logs.map((log) => ({
            id: log.id,
            jobId: log.jobId,
            jobCityId: log.jobCityId,
            cityId: log.cityId,
            cityName: log.jobCity?.city?.name,
            errorCode: log.errorCode,
            message: log.message,
            stack: canViewStack ? log.stack : null,
            rawError: canViewStack ? log.stack : null,
            createdAt: log.createdAt,
            canViewStack,
            retryable: this.retryableError(log.errorCode),
        }));
    }
};
exports.JobsService = JobsService;
exports.JobsService = JobsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('LEAD_QUEUE')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_1.Queue])
], JobsService);
//# sourceMappingURL=jobs.service.js.map