"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobCitiesModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const queue_module_1 = require("../queue/queue.module");
const job_cities_controller_1 = require("./job-cities.controller");
const job_cities_service_1 = require("./job-cities.service");
let JobCitiesModule = class JobCitiesModule {
};
exports.JobCitiesModule = JobCitiesModule;
exports.JobCitiesModule = JobCitiesModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, queue_module_1.QueueModule],
        controllers: [job_cities_controller_1.JobCitiesController],
        providers: [job_cities_service_1.JobCitiesService],
    })
], JobCitiesModule);
//# sourceMappingURL=job-cities.module.js.map