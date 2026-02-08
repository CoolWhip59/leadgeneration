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
exports.JobsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const rxjs_1 = require("rxjs");
const jwt_guard_1 = require("../auth/jwt.guard");
const jobs_service_1 = require("./jobs.service");
const jobs_dto_1 = require("./jobs.dto");
let JobsController = class JobsController {
    constructor(jobs, jwt) {
        this.jobs = jobs;
        this.jwt = jwt;
    }
    create(req, dto) {
        return this.jobs.create(req.user.sub, dto);
    }
    list(req) {
        return this.jobs.list(req.user.sub);
    }
    get(req, id) {
        return this.jobs.get(req.user.sub, id);
    }
    errors(req, id) {
        return this.jobs.getErrors(req.user.sub, id);
    }
    stream(req, id, token) {
        const authHeader = req.headers['authorization'];
        const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
        const finalToken = token || bearer;
        if (!finalToken) {
            throw new common_1.UnauthorizedException('Missing token');
        }
        let payload;
        try {
            payload = this.jwt.verify(finalToken, { secret: process.env.JWT_SECRET });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid token');
        }
        return new rxjs_1.Observable((subscriber) => {
            let closed = false;
            let lastStatus = null;
            const sentCityErrors = new Set();
            const poll = async () => {
                if (closed)
                    return;
                try {
                    const data = await this.jobs.get(payload.sub, id);
                    subscriber.next({ data });
                    for (const jc of data.jobCities) {
                        if (jc.status === 'FAILED' && jc.errorCode && !sentCityErrors.has(jc.id)) {
                            sentCityErrors.add(jc.id);
                            subscriber.next({
                                event: 'city_error',
                                data: {
                                    jobCityId: jc.id,
                                    city: jc.city?.name,
                                    cityName: jc.city?.name,
                                    errorCode: jc.errorCode,
                                    error: jc.error,
                                },
                            });
                        }
                    }
                    if (data.status !== lastStatus && (data.status === 'COMPLETED' || data.status === 'FAILED')) {
                        lastStatus = data.status;
                        subscriber.next({
                            event: data.status === 'COMPLETED' ? 'completed' : 'failed',
                            data: {
                                status: data.status,
                                error: data.error || null,
                            },
                        });
                        clearInterval(intervalId);
                        subscriber.complete();
                        closed = true;
                    }
                }
                catch (error) {
                    subscriber.error(error);
                }
            };
            poll();
            const intervalId = setInterval(poll, 2000);
            req.on('close', () => {
                closed = true;
                clearInterval(intervalId);
                subscriber.complete();
            });
        });
    }
};
exports.JobsController = JobsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, jobs_dto_1.CreateJobDto]),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "get", null);
__decorate([
    (0, common_1.Get)(':id/errors'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "errors", null);
__decorate([
    (0, common_1.Sse)(':id/stream'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "stream", null);
exports.JobsController = JobsController = __decorate([
    (0, common_1.Controller)('jobs'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [jobs_service_1.JobsService, jwt_1.JwtService])
], JobsController);
//# sourceMappingURL=jobs.controller.js.map