"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("../auth/auth.module");
const prisma_module_1 = require("../prisma/prisma.module");
const cities_module_1 = require("../cities/cities.module");
const categories_module_1 = require("../categories/categories.module");
const businesses_module_1 = require("../businesses/businesses.module");
const jobs_module_1 = require("../jobs/jobs.module");
const queue_module_1 = require("../queue/queue.module");
const places_module_1 = require("../places/places.module");
const website_check_module_1 = require("../website-check/website-check.module");
const job_cities_module_1 = require("../job-cities/job-cities.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            cities_module_1.CitiesModule,
            categories_module_1.CategoriesModule,
            businesses_module_1.BusinessesModule,
            jobs_module_1.JobsModule,
            queue_module_1.QueueModule,
            places_module_1.PlacesModule,
            website_check_module_1.WebsiteCheckModule,
            job_cities_module_1.JobCitiesModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map