import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';

const agent = new https.Agent({
    rejectUnauthorized: false
});

export async function POST(req: NextRequest) {
    try {
        const bodyJSON = await req.json();
        console.log("Proxy Request:", {
            method: bodyJSON.method,
            url: bodyJSON.url,
            headersCount: Object.keys(bodyJSON.headers || {}).length
        });
        const { method, url, headers, body } = bodyJSON;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Prepare headers, removing host to let axios handle it
        const requestHeaders: Record<string, string> = {};

        // Lowercase keys to cleaner filtering
        Object.keys(headers || {}).forEach(key => {
            requestHeaders[key.toLowerCase()] = headers[key];
        });

        const blockedHeaders = ['host', 'content-length', 'connection', 'accept-encoding'];
        blockedHeaders.forEach(h => delete requestHeaders[h]);

        // Default User-Agent if missing
        if (!requestHeaders['user-agent']) {
            requestHeaders['user-agent'] = 'ApiHunter/1.0';
        }

        const startTime = Date.now();

        const response = await axios({
            method: method || 'GET',
            url,
            headers: requestHeaders,
            data: body || undefined,
            validateStatus: () => true, // resolve promise for all status codes
            timeout: 30000,
            transitional: {
                clarifyTimeoutError: true
            },
            httpsAgent: agent
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Convert AxiosHeaders to a plain object for JSON serialization
        const responseHeaders: Record<string, string> = {};
        if (response.headers) {
            Object.entries(response.headers).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    responseHeaders[key] = value;
                } else if (Array.isArray(value)) {
                    responseHeaders[key] = value.join(', ');
                }
            });
        }

        return NextResponse.json({
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            data: response.data,
            duration,
        });
    } catch (error: any) {
        console.error("Proxy Error:", error.message);
        if (error.response) {
            console.error("Upstream Response:", error.response.status, error.response.data);
        }
        return NextResponse.json(
            {
                error: error.message,
                details: error.response ? error.response.data : null,
            },
            { status: 500 }
        );
    }
}
