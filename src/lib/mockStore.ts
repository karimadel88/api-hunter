/**
 * In-memory mock route store for the server side.
 * Routes are synced from the client (IndexedDB) via POST /api/mock/routes.
 */

export interface ServerMockRoute {
    method: string;
    path: string;
    responseStatus: number;
    responseHeaders: Record<string, string>;
    responseBody: string;
    delay: number;
    enabled: boolean;
}

// Global in-memory store (persists across requests in dev/production)
const globalForMock = globalThis as typeof globalThis & { _mockRoutes?: ServerMockRoute[] };

export function getMockRoutes(): ServerMockRoute[] {
    return globalForMock._mockRoutes || [];
}

export function setMockRoutes(routes: ServerMockRoute[]) {
    globalForMock._mockRoutes = routes;
}

export function matchPath(pattern: string, actual: string): Record<string, string> | null {
    const patternParts = pattern.split('/').filter(Boolean);
    const actualParts = actual.split('/').filter(Boolean);

    // Handle trailing wildcard
    if (patternParts[patternParts.length - 1] === '*') {
        if (actualParts.length < patternParts.length - 1) return null;
        const params: Record<string, string> = {};
        for (let i = 0; i < patternParts.length - 1; i++) {
            if (patternParts[i].startsWith(':')) {
                params[patternParts[i].slice(1)] = actualParts[i];
            } else if (patternParts[i] !== actualParts[i]) {
                return null;
            }
        }
        params['*'] = actualParts.slice(patternParts.length - 1).join('/');
        return params;
    }

    if (patternParts.length !== actualParts.length) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
            params[patternParts[i].slice(1)] = actualParts[i];
        } else if (patternParts[i] !== actualParts[i]) {
            return null;
        }
    }
    return params;
}

export function substituteParams(text: string, params: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? `{{${key}}}`);
}
