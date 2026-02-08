"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:timers/promises");
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@local.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
}
async function waitForHealth() {
    const maxAttempts = 30;
    const delayMs = 1000;
    let lastError = '';
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const res = await request('/health');
            if (res.ok) {
                console.log(`Health ready on attempt ${attempt}.`);
                return;
            }
            lastError = `HTTP ${res.status}`;
        }
        catch (err) {
            lastError = err?.message || String(err);
        }
        console.log(`Health check attempt ${attempt}/${maxAttempts} failed: ${lastError}`);
        await (0, promises_1.setTimeout)(delayMs);
    }
    console.error('API not running (start npm run dev)');
    console.error('Timeout after ~30s. Check PORT, API crash logs, or Docker (Postgres/Redis).');
    process.exit(1);
}
async function main() {
    console.log('Verify local...');
    console.log(`API_BASE_URL=${API_BASE_URL}`);
    await waitForHealth();
    const login = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!login.ok) {
        console.log(`Login failed: ${login.status}`);
        console.log(login.text);
        process.exit(1);
    }
    const { accessToken } = JSON.parse(login.text);
    const citiesRes = await request('/cities');
    const categoriesRes = await request('/categories');
    const cities = citiesRes.ok ? JSON.parse(citiesRes.text) : [];
    const categories = categoriesRes.ok ? JSON.parse(categoriesRes.text) : [];
    if (!cities.length || !categories.length) {
        console.log('Seed data missing: cities/categories empty');
        process.exit(1);
    }
    const cityIds = cities.slice(0, 2).map((c) => c.id);
    const categoryId = categories[0].id;
    const jobRes = await request('/jobs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ cityIds, categoryId }),
    });
    if (!jobRes.ok) {
        console.log(`Job create failed: ${jobRes.status}`);
        console.log(jobRes.text);
        process.exit(1);
    }
    const job = JSON.parse(jobRes.text);
    console.log(`Job created: ${job.id}`);
    let processing = false;
    for (let attempt = 1; attempt <= 20; attempt += 1) {
        await (0, promises_1.setTimeout)(1000);
        try {
            const statusRes = await request(`/jobs/${job.id}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (statusRes.ok) {
                const statusJob = JSON.parse(statusRes.text);
                if (statusJob.status === 'RUNNING' || statusJob.progress > 0) {
                    processing = true;
                    console.log(`Worker started processing on attempt ${attempt}.`);
                    break;
                }
            }
        }
        catch {
        }
    }
    if (!processing) {
        console.log('Worker not processing jobs yet (is npm run dev running worker?)');
        process.exit(1);
    }
    const errorsRes = await request(`/jobs/${job.id}/errors`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!errorsRes.ok) {
        console.log(`Errors fetch failed: ${errorsRes.status}`);
        console.log(errorsRes.text);
        process.exit(1);
    }
    const errors = JSON.parse(errorsRes.text);
    console.log(`Errors endpoint OK (${errors.length} records).`);
    console.log('Verify local: OK');
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=verify-local.js.map