export declare class WebsiteCheckService {
    isSocialOnly(url?: string | null): boolean;
    checkWebsite(url?: string | null): Promise<{
        status: "NO_WEBSITE";
        httpStatus?: undefined;
        responseMs?: undefined;
    } | {
        status: "SOCIAL_ONLY";
        httpStatus?: undefined;
        responseMs?: undefined;
    } | {
        status: "HTTP_ERROR";
        httpStatus: number;
        responseMs: number;
    } | {
        status: "OK";
        httpStatus: number;
        responseMs: number;
    } | {
        status: "TIMEOUT";
        httpStatus?: undefined;
        responseMs?: undefined;
    } | {
        status: "HTTP_ERROR";
        httpStatus?: undefined;
        responseMs?: undefined;
    }>;
}
