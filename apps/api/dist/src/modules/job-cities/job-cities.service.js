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
exports.JobCitiesService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
let JobCitiesService = class JobCitiesService {
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
    async retry(userId, jobCityId) {
        const jobCity = await this.prisma.jobCity.findFirst({
            where: { id: jobCityId, deletedAt: null },
            include: {
                job: true,
                city: true,
            },
        });
        if (!jobCity || jobCity.job.userId !== userId) {
            throw new common_1.NotFoundException('Job city not found');
        }
        const latestError = await this.prisma.jobCityErrorLog.findFirst({
            where: { jobCityId },
            orderBy: { createdAt: 'desc' },
        });
        if (!latestError || !this.retryableError(latestError.errorCode)) {
            throw new common_1.BadRequestException('Job city is not retryable');
        }
        const category = await this.prisma.category.findFirst({
            where: { id: jobCity.job.categoryId, deletedAt: null },
        });
        if (!category) {
            throw new common_1.NotFoundException('Category not found');
        }
        const maxAttempt = await this.prisma.jobCity.aggregate({
            where: { jobId: jobCity.jobId, cityId: jobCity.cityId },
            _max: { attempt: true },
        });
        const nextAttempt = (maxAttempt._max.attempt || 1) + 1;
        const newJobCity = await this.prisma.jobCity.create({
            data: {
                jobId: jobCity.jobId,
                cityId: jobCity.cityId,
                attempt: nextAttempt,
            },
        });
        const queueJob = await this.queue.add('lead-scan', {
            jobId: jobCity.jobId,
            jobCityId: newJobCity.id,
            city: jobCity.city.name,
            category: category.name,
            cityId: jobCity.cityId,
            categoryId: category.id,
        }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 100,
            removeOnFail: 100,
        });
        await this.prisma.jobCity.update({
            where: { id: newJobCity.id },
            data: { queueJobId: String(queueJob.id) },
        });
        await this.prisma.job.update({
            where: { id: jobCity.jobId },
            data: {
                status: 'RUNNING',
                error: null,
                finishedAt: null,
                startedAt: jobCity.job.startedAt ?? new Date(),
            },
        });
        return newJobCity;
    }
};
exports.JobCitiesService = JobCitiesService;
exports.JobCitiesService = JobCitiesService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('LEAD_QUEUE')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_1.Queue])
], JobCitiesService);
//# sourceMappingURL=job-cities.service.js.map