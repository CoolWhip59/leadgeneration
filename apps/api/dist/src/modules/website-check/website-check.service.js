"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsiteCheckService = void 0;
const common_1 = require("@nestjs/common");
const undici_1 = require("undici");
const client_1 = require("@prisma/client");
const SOCIAL_DOMAINS = new Set([
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'twitter.com',
    'x.com',
    'linkedin.com',
]);
let WebsiteCheckService = class WebsiteCheckService {
    isSocialOnly(url) {
        if (!url)
            return false;
        try {
            const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();
            return SOCIAL_DOMAINS.has(hostname);
        }
        catch {
            return false;
        }
    }
    async checkWebsite(url) {
        if (!url) {
            return { status: client_1.WebsiteCheckStatus.NO_WEBSITE };
        }
        if (this.isSocialOnly(url)) {
            return { status: client_1.WebsiteCheckStatus.SOCIAL_ONLY };
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const started = Date.now();
        try {
            let response = await (0, undici_1.fetch)(url, {
                method: 'HEAD',
                redirect: 'follow',
                signal: controller.signal,
            });
            if (response.status === 405) {
                response = await (0, undici_1.fetch)(url, {
                    method: 'GET',
                    redirect: 'follow',
                    signal: controller.signal,
                });
            }
            const duration = Date.now() - started;
            clearTimeout(timeout);
            if (response.status >= 400) {
                return {
                    status: client_1.WebsiteCheckStatus.HTTP_ERROR,
                    httpStatus: response.status,
                    responseMs: duration,
                };
            }
            return {
                status: client_1.WebsiteCheckStatus.OK,
                httpStatus: response.status,
                responseMs: duration,
            };
        }
        catch (error) {
            clearTimeout(timeout);
            if (String(error).includes('AbortError')) {
                return { status: client_1.WebsiteCheckStatus.TIMEOUT };
            }
            return { status: client_1.WebsiteCheckStatus.HTTP_ERROR };
        }
    }
};
exports.WebsiteCheckService = WebsiteCheckService;
exports.WebsiteCheckService = WebsiteCheckService = __decorate([
    (0, common_1.Injectable)()
], WebsiteCheckService);
//# sourceMappingURL=website-check.service.js.map