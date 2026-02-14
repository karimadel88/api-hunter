import { NextRequest, NextResponse } from "next/server";
import { getMockRoutes, setMockRoutes, ServerMockRoute, matchPath, substituteParams } from "@/lib/mockStore";

/**
 * POST /api/mock — Sync routes from client to server OR test a mock route.
 *
 * Body options:
 * 1. { syncRoutes: [...] }         — Sync routes from IndexedDB to server memory
 * 2. { routes: [...], request: {} } — Test a mock route (legacy quick-test)
 */

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Sync routes
        if (body.syncRoutes) {
            setMockRoutes(body.syncRoutes as ServerMockRoute[]);
            return NextResponse.json({ ok: true, count: body.syncRoutes.length });
        }

        // Quick test (legacy)
        const { routes, request } = body;
        if (!routes || !request) {
            return NextResponse.json({ error: "Missing routes or request" }, { status: 400 });
        }

        const result = findAndExecuteRoute(routes.filter((r: any) => r.enabled), request.method, request.path);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/mock — Return info about the mock server status.
 */
export async function GET() {
    const routes = getMockRoutes();
    return NextResponse.json({
        active: true,
        routeCount: routes.length,
        enabledCount: routes.filter(r => r.enabled).length,
        routes: routes.map(r => ({ method: r.method, path: r.path, status: r.responseStatus, enabled: r.enabled })),
    });
}

function findAndExecuteRoute(routes: ServerMockRoute[], method: string, path: string) {
    for (const route of routes) {
        if (route.method.toUpperCase() !== method.toUpperCase() && route.method !== '*') {
            continue;
        }
        const params = matchPath(route.path, path);
        if (params !== null) {
            let body = substituteParams(route.responseBody, params);
            let data: any;
            try { data = JSON.parse(body); } catch { data = body; }

            return {
                status: route.responseStatus,
                statusText: "OK",
                headers: route.responseHeaders,
                data,
                duration: route.delay,
                mock: true,
                matchedPath: route.path,
                pathParams: params,
            };
        }
    }

    return {
        status: 404,
        statusText: "Not Found",
        headers: {},
        data: { error: "No mock route matched", path, method },
        duration: 0,
    };
}
