"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { MockRoute, db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    Plus, Trash2, Power, PowerOff, Copy, Wand2, Server,
    ChevronDown, ChevronRight, X, Save, Loader2, Play,
    CheckCircle2, ExternalLink, RefreshCw
} from "lucide-react";
import axios from "axios";
import { CodeEditor } from "@/components/CodeEditor";

const METHOD_COLORS: Record<string, string> = {
    GET: "text-emerald-400 bg-emerald-400/10",
    POST: "text-amber-400 bg-amber-400/10",
    PUT: "text-blue-400 bg-blue-400/10",
    DELETE: "text-red-400 bg-red-400/10",
    PATCH: "text-purple-400 bg-purple-400/10",
    "*": "text-gray-400 bg-gray-400/10",
};

const STATUS_COLORS: Record<string, string> = {
    "2": "text-emerald-400",
    "3": "text-amber-400",
    "4": "text-red-400",
    "5": "text-red-500",
};

// ═══════════════ Schema Generator ═══════════════

function generateMockFromSchema(schemaText: string): MockRoute[] {
    try {
        const schema = JSON.parse(schemaText);
        const routes: MockRoute[] = [];
        const now = Date.now();

        if (schema.paths) {
            // OpenAPI/Swagger format
            for (const [path, methods] of Object.entries(schema.paths as Record<string, any>)) {
                for (const [method, config] of Object.entries(methods as Record<string, any>)) {
                    if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
                        const response = config.responses?.['200'] || config.responses?.['201'] || Object.values(config.responses || {})[0] as any;
                        let body = '{}';

                        // Try to get example from schema
                        const content = response?.content?.['application/json'];
                        if (content?.example) {
                            body = JSON.stringify(content.example, null, 2);
                        } else if (content?.schema) {
                            body = JSON.stringify(generateFromJsonSchema(content.schema, schema.components?.schemas || {}), null, 2);
                        }

                        routes.push({
                            method: method.toUpperCase(),
                            path: path.replace(/\{(\w+)\}/g, ':$1'),
                            responseStatus: parseInt(Object.keys(config.responses || { '200': {} })[0]) || 200,
                            responseHeaders: { 'Content-Type': 'application/json' },
                            responseBody: body,
                            delay: 0,
                            enabled: true,
                            description: config.summary || config.description || '',
                            createdAt: now,
                        });
                    }
                }
            }
        } else if (typeof schema === 'object') {
            // Plain JSON schema / sample response — create a single GET route
            routes.push({
                method: 'GET',
                path: '/api/mock',
                responseStatus: 200,
                responseHeaders: { 'Content-Type': 'application/json' },
                responseBody: JSON.stringify(schema, null, 2),
                delay: 0,
                enabled: true,
                description: 'Auto-generated from JSON',
                createdAt: now,
            });
        }

        return routes;
    } catch {
        return [];
    }
}

function generateFromJsonSchema(schema: any, definitions: Record<string, any>): any {
    if (!schema) return {};

    // Handle $ref
    if (schema.$ref) {
        const refName = schema.$ref.split('/').pop();
        return generateFromJsonSchema(definitions[refName] || {}, definitions);
    }

    if (schema.example) return schema.example;

    switch (schema.type) {
        case 'string':
            if (schema.format === 'date-time') return new Date().toISOString();
            if (schema.format === 'email') return 'user@example.com';
            if (schema.format === 'uri') return 'https://example.com';
            if (schema.enum) return schema.enum[0];
            return schema.default || 'string';
        case 'integer':
        case 'number':
            return schema.default || (schema.minimum ?? 1);
        case 'boolean':
            return schema.default ?? true;
        case 'array':
            return [generateFromJsonSchema(schema.items || {}, definitions)];
        case 'object': {
            const obj: Record<string, any> = {};
            for (const [key, prop] of Object.entries(schema.properties || {} as Record<string, any>)) {
                obj[key] = generateFromJsonSchema(prop, definitions);
            }
            return obj;
        }
        default:
            if (schema.properties) {
                const obj: Record<string, any> = {};
                for (const [key, prop] of Object.entries(schema.properties as Record<string, any>)) {
                    obj[key] = generateFromJsonSchema(prop, definitions);
                }
                return obj;
            }
            return {};
    }
}

// ═══════════════ Route Card ═══════════════

function RouteCard({ route, onUpdate, onDelete }: {
    route: MockRoute;
    onUpdate: (updates: Partial<MockRoute>) => void;
    onDelete: () => void;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className={cn(
            "border rounded-lg overflow-hidden transition-colors",
            route.enabled ? "border-border/50 bg-background/50" : "border-border/30 bg-muted/10 opacity-60"
        )}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setOpen(!open)}>
                <button onClick={e => { e.stopPropagation(); onUpdate({ enabled: !route.enabled }); }}
                    className="shrink-0" title={route.enabled ? "Disable" : "Enable"}>
                    {route.enabled
                        ? <Power className="h-3.5 w-3.5 text-emerald-400" />
                        : <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                    METHOD_COLORS[route.method] || METHOD_COLORS['GET']
                )}>{route.method}</span>
                <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{route.path}</span>
                <span className={cn(
                    "text-[10px] font-mono font-medium",
                    STATUS_COLORS[String(route.responseStatus)[0]] || "text-foreground"
                )}>{route.responseStatus}</span>
                {route.delay > 0 && (
                    <span className="text-[10px] text-muted-foreground/50 font-mono">{route.delay}ms</span>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={e => { e.stopPropagation(); onDelete(); }}>
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>

            {/* Details */}
            {open && (
                <div className="p-3 space-y-3 border-t border-border/30">
                    <div className="flex gap-2">
                        <select value={route.method}
                            onChange={e => onUpdate({ method: e.target.value })}
                            className={cn("h-8 rounded border px-2 text-xs font-bold outline-none", METHOD_COLORS[route.method])}>
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                            <option value="*">ANY</option>
                        </select>
                        <Input className="h-8 flex-1 text-xs font-mono" placeholder="/api/users/:id"
                            value={route.path} onChange={e => onUpdate({ path: e.target.value })} />
                        <Input className="h-8 w-20 text-xs font-mono" placeholder="200" type="number"
                            value={route.responseStatus} onChange={e => onUpdate({ responseStatus: parseInt(e.target.value) || 200 })} />
                        <Input className="h-8 w-20 text-xs font-mono" placeholder="Delay ms" type="number"
                            value={route.delay} onChange={e => onUpdate({ delay: parseInt(e.target.value) || 0 })} />
                    </div>

                    <Input className="h-7 text-xs" placeholder="Description (optional)"
                        value={route.description || ''} onChange={e => onUpdate({ description: e.target.value })} />

                    {/* Response Headers */}
                    <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Response Headers</span>
                        {Object.entries(route.responseHeaders).map(([k, v], i) => (
                            <div key={i} className="flex gap-1.5 mt-1 items-center group">
                                <Input className="h-7 flex-1 text-xs font-mono" placeholder="Key" value={k}
                                    onChange={e => {
                                        const entries = Object.entries(route.responseHeaders);
                                        entries[i] = [e.target.value, v];
                                        onUpdate({ responseHeaders: Object.fromEntries(entries) });
                                    }} />
                                <Input className="h-7 flex-1 text-xs font-mono" placeholder="Value" value={v}
                                    onChange={e => {
                                        const entries = Object.entries(route.responseHeaders);
                                        entries[i] = [k, e.target.value];
                                        onUpdate({ responseHeaders: Object.fromEntries(entries) });
                                    }} />
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                    onClick={() => {
                                        const entries = Object.entries(route.responseHeaders);
                                        entries.splice(i, 1);
                                        onUpdate({ responseHeaders: Object.fromEntries(entries) });
                                    }}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 mt-1"
                            onClick={() => onUpdate({ responseHeaders: { ...route.responseHeaders, '': '' } })}>
                            <Plus className="h-2.5 w-2.5 mr-0.5" /> Add Header
                        </Button>
                    </div>

                    {/* Response Body */}
                    <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Response Body</span>
                        <div className="h-32 mt-1 border border-border/50 rounded overflow-hidden">
                            <CodeEditor
                                value={route.responseBody}
                                onChange={v => onUpdate({ responseBody: v })}
                                language="json"
                                className="border-0"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                            Use {'{{param}}'} to reference path parameters (e.g. :id → {'{{id}}'})
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════ Test Flyout ═══════════════

function MockTester({ routes }: { routes: MockRoute[] }) {
    const [method, setMethod] = useState("GET");
    const [path, setPath] = useState("/api/");
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const testRoute = async () => {
        setLoading(true);
        try {
            const res = await axios.post('/api/mock', {
                routes: routes.filter(r => r.enabled),
                request: { method, path },
            });
            setResponse(res.data);
        } catch (e: any) {
            setResponse({ error: e.message });
        }
        setLoading(false);
    };

    return (
        <div className="border border-border/50 rounded-lg p-3 bg-muted/10 space-y-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Test</span>
            <div className="flex gap-1.5">
                <select value={method} onChange={e => setMethod(e.target.value)}
                    className="h-8 rounded border px-2 text-xs font-bold outline-none">
                    <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
                </select>
                <Input className="h-8 flex-1 text-xs font-mono" value={path} onChange={e => setPath(e.target.value)}
                    placeholder="/api/users/1" onKeyDown={e => e.key === 'Enter' && testRoute()} />
                <Button size="sm" className="h-8 text-xs" onClick={testRoute} disabled={loading}>
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                    Test
                </Button>
            </div>
            {response && (
                <pre className="text-[11px] font-mono p-2 rounded bg-background border border-border/30 overflow-auto max-h-40 text-muted-foreground">
                    {JSON.stringify(response, null, 2)}
                </pre>
            )}
        </div>
    );
}

// ═══════════════ Main MockServer ═══════════════

export function MockServer() {
    const routes = useLiveQuery(() => db.mockRoutes.toArray());
    const [showSchema, setShowSchema] = useState(false);
    const [schemaText, setSchemaText] = useState('');
    const [generating, setGenerating] = useState(false);
    const [synced, setSynced] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const syncTimer = useRef<NodeJS.Timeout | null>(null);
    const [mockPort, setMockPort] = useState(() => {
        if (typeof window !== 'undefined') return window.location.port || '3000';
        return '3000';
    });

    // Auto-sync routes to server whenever they change
    useEffect(() => {
        if (!routes) return;

        // Debounce sync
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(async () => {
            setSyncing(true);
            try {
                await axios.post('/api/mock', {
                    syncRoutes: routes.map(r => ({
                        method: r.method,
                        path: r.path,
                        responseStatus: r.responseStatus,
                        responseHeaders: r.responseHeaders,
                        responseBody: r.responseBody,
                        delay: r.delay,
                        enabled: r.enabled,
                    })),
                });
                setSynced(true);
            } catch {
                setSynced(false);
            }
            setSyncing(false);
        }, 300);

        return () => {
            if (syncTimer.current) clearTimeout(syncTimer.current);
        };
    }, [routes]);

    const baseUrl = `http://localhost:${mockPort}/mock`;

    const addRoute = async () => {
        // Generate a unique path so new routes don't duplicate
        const existing = routes?.map(r => r.path) || [];
        let newPath = '/new-route';
        let counter = 1;
        while (existing.includes(newPath)) {
            newPath = `/new-route-${counter}`;
            counter++;
        }
        await db.mockRoutes.add({
            method: 'GET',
            path: newPath,
            responseStatus: 200,
            responseHeaders: { 'Content-Type': 'application/json' },
            responseBody: '{\n  \n}',
            delay: 0,
            enabled: true,
            createdAt: Date.now(),
        });
    };

    const updateRoute = async (id: number, updates: Partial<MockRoute>) => {
        await db.mockRoutes.update(id, updates);
    };

    const deleteRoute = async (id: number) => {
        await db.mockRoutes.delete(id);
    };

    const generateFromSchema = async () => {
        setGenerating(true);
        const generated = generateMockFromSchema(schemaText);
        for (const route of generated) {
            await db.mockRoutes.add(route);
        }
        setGenerating(false);
        setShowSchema(false);
        setSchemaText('');
    };

    const toggleAll = async (enabled: boolean) => {
        if (!routes) return;
        for (const route of routes) {
            if (route.id) await db.mockRoutes.update(route.id, { enabled });
        }
    };

    const enabledCount = routes?.filter(r => r.enabled).length || 0;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-url-bar-bg">
                <Server className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold">Mock Server</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-medium">
                    {enabledCount}/{routes?.length || 0} active
                </span>
                {syncing ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Syncing...
                    </span>
                ) : synced ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Live
                    </span>
                ) : null}
                <div className="ml-auto flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toggleAll(true)}>
                        <Power className="h-3 w-3 mr-1 text-emerald-400" /> All On
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toggleAll(false)}>
                        <PowerOff className="h-3 w-3 mr-1" /> All Off
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowSchema(!showSchema)}>
                        <Wand2 className="h-3 w-3 mr-1" /> From Schema
                    </Button>
                    <Button size="sm" className="h-7 text-xs bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0" onClick={addRoute}>
                        <Plus className="h-3 w-3 mr-1" /> Add Route
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
                {routes && routes.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Mock URL</span>
                        <div className="flex items-center bg-emerald-500/10 rounded px-1.5 py-0.5" title="Updates display only. App must actally run on this port.">
                            <span className="text-xs font-mono text-muted-foreground mr-0.5">http://localhost:</span>
                            <Input
                                className="h-5 w-10 text-xs font-mono text-center text-emerald-300 bg-transparent border-none p-0 focus-visible:ring-0"
                                value={mockPort}
                                onChange={e => setMockPort(e.target.value.replace(/\D/g, ''))}
                            />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">/mock/</span>
                        <span className="text-xs font-mono text-emerald-400">{'{path}'}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5"
                            onClick={() => navigator.clipboard.writeText(baseUrl)}
                            title="Copy base URL">
                            <Copy className="h-2.5 w-2.5 text-emerald-400" />
                        </Button>
                        <span className="text-[10px] text-muted-foreground/50 ml-auto flex items-center gap-1">
                            Display Port Only <span className="hidden sm:inline">— Server: {typeof window !== 'undefined' ? window.location.port : '...'}</span>
                        </span>
                    </div>
                )}
                {/* Schema Import */}
                {showSchema && (
                    <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-indigo-300">
                                <Wand2 className="h-3 w-3 inline mr-1" />
                                Auto-Generate from Schema
                            </span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSchema(false)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="h-40 border border-indigo-500/20 rounded overflow-hidden">
                            <CodeEditor
                                value={schemaText}
                                onChange={setSchemaText}
                                language="json"
                                className="border-0"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={generateFromSchema} disabled={!schemaText.trim() || generating}>
                                {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                                Generate Routes
                            </Button>
                            <p className="text-[10px] text-muted-foreground/50">
                                Routes will be generated from the schema and added to your mock server.
                            </p>
                        </div>
                    </div>
                )}

                {/* Routes */}
                {routes?.map(route => (
                    <RouteCard
                        key={route.id}
                        route={route}
                        onUpdate={updates => updateRoute(route.id!, updates)}
                        onDelete={() => deleteRoute(route.id!)}
                    />
                ))}

                {(!routes || routes.length === 0) && !showSchema && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 gap-3">
                        <Server className="h-10 w-10" />
                        <p className="text-sm font-medium">No Mock Routes</p>
                        <p className="text-xs text-muted-foreground/30">Add routes manually or auto-generate from an OpenAPI schema</p>
                        <div className="flex gap-2 mt-2">
                            <Button onClick={addRoute} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0">
                                <Plus className="h-4 w-4 mr-1" /> Add Route
                            </Button>
                            <Button variant="outline" onClick={() => setShowSchema(true)}>
                                <Wand2 className="h-4 w-4 mr-1" /> From Schema
                            </Button>
                        </div>
                    </div>
                )}

                {/* Quick Tester */}
                {routes && routes.length > 0 && (
                    <MockTester routes={routes} />
                )}
            </div>
        </div>
    );
}
