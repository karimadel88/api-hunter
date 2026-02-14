import { NextRequest, NextResponse } from "next/server";
import { getMockRoutes, matchPath, substituteParams } from "@/lib/mockStore";

/**
 * Catch-all route: handles all HTTP methods at /mock/*
 * E.g. GET /mock/users/123 will match a route with path "/users/:id"
 *
 * The mock routes are synced from the client via POST /api/mock { syncRoutes: [...] }
 */

async function handleMockRequest(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    const requestPath = '/' + (path || []).join('/');
    const method = req.method;
    const routes = getMockRoutes().filter(r => r.enabled);

    for (const route of routes) {
        if (route.method.toUpperCase() !== method.toUpperCase() && route.method !== '*') {
            continue;
        }

        const pathParams = matchPath(route.path, requestPath);
        if (pathParams !== null) {
            // Simulate delay
            if (route.delay > 0) {
                await new Promise(r => setTimeout(r, route.delay));
            }

            // Build response body with param substitution
            const body = substituteParams(route.responseBody, pathParams);

            // Build headers
            const headers = new Headers();
            for (const [k, v] of Object.entries(route.responseHeaders)) {
                if (k) headers.set(k, substituteParams(v, pathParams));
            }
            // Allow CORS for external access
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            headers.set('Access-Control-Allow-Headers', '*');
            headers.set('X-Mock-Route', route.path);

            return new NextResponse(body, {
                status: route.responseStatus,
                headers,
            });
        }
    }

    // No match
    return NextResponse.json(
        {
            error: "No mock route matched",
            path: requestPath,
            method,
            hint: "Sync your routes first: the Mock Server UI auto-syncs when routes change. Ensure routes are enabled.",
            availableRoutes: routes.map(r => `${r.method} ${r.path}`),
        },
        {
            status: 404,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        }
    );
}

// Handle CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        },
    });
}

export const GET = handleMockRequest;
export const POST = handleMockRequest;
export const PUT = handleMockRequest;
export const DELETE = handleMockRequest;
export const PATCH = handleMockRequest;
