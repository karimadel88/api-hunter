"use client";

import React, { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, Plus, Send, FileCode2 } from "lucide-react";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useAppStore, useCurrentRequest } from "@/lib/store";
import { SaveRequestDialog } from "@/components/SaveRequestDialog";
import { ImportCurlDialog } from "@/components/ImportCurlDialog";
import { CodeGeneratorDialog } from "@/components/CodeGeneratorDialog";
import { ScriptEditor } from "@/components/ScriptEditor";
import { CodeEditor } from "@/components/CodeEditor";
import { AuthPanel } from "@/components/AuthPanel";
import { runScript } from "@/lib/scriptRunner";
import { useLiveQuery } from "dexie-react-hooks";

interface RequestPanelProps {
    onResponse: (response: any) => void;
}

const METHOD_COLORS: Record<string, string> = {
    GET: "text-method-get bg-method-get/10 border-method-get/30",
    POST: "text-method-post bg-method-post/10 border-method-post/30",
    PUT: "text-method-put bg-method-put/10 border-method-put/30",
    DELETE: "text-method-delete bg-method-delete/10 border-method-delete/30",
    PATCH: "text-method-patch bg-method-patch/10 border-method-patch/30",
};

export function RequestPanel({ onResponse }: RequestPanelProps) {
    const { setMethod, setUrl, setParams, setHeaders, setBody, activeEnvironmentId, updateTab, activeTabId } = useAppStore();
    const currentRequest = useCurrentRequest();
    const { method, url, params, headers, body, bodyType, bodyRawLanguage, bodyFormData, bodyFormUrlEncoded, preScript, postScript, auth } = currentRequest;
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);

    // Default values if undefined (migration)
    const effectiveParams = params || [];
    const effectiveHeaders = headers || [];
    const effectiveBodyType = bodyType || 'json';
    const effectiveRawLanguage = bodyRawLanguage || 'json';
    const effectiveFormData = bodyFormData || [{ key: '', value: '', type: 'text' }];
    const effectiveUrlEncoded = bodyFormUrlEncoded || [{ key: '', value: '' }];
    const effectivePreScript = preScript || "";
    const effectivePostScript = postScript || "";
    const effectiveAuth = auth || { type: "none" };

    const activeEnv = useLiveQuery(async () => {
        if (!activeEnvironmentId) return null;
        return await db.environments.get(activeEnvironmentId);
    }, [activeEnvironmentId]);

    const substituteVariables = (text: string) => {
        if (!text || !activeEnv) return text;
        let result = text;
        activeEnv.variables.forEach((v: any) => {
            if (v.enabled && v.key) {
                const regex = new RegExp(`{{${v.key}}}`, 'g');
                result = result.replace(regex, v.value);
            }
        });
        return result;
    };

    const [loading, setLoading] = useState(false);
    const [scriptTab, setScriptTab] = useState<"pre" | "post">("pre");

    const handleSend = async () => {
        setLoading(true);
        try {
            const startTime = Date.now();

            const paramObj: Record<string, string> = {};
            effectiveParams.forEach(p => {
                if (p.key) paramObj[substituteVariables(p.key)] = substituteVariables(p.value)
            });

            const headerObj: Record<string, string> = {};
            effectiveHeaders.forEach(h => {
                if (h.key) headerObj[substituteVariables(h.key)] = substituteVariables(h.value)
            });

            // ─── Apply Authentication ───
            if (effectiveAuth.type === 'basic' && effectiveAuth.basic) {
                const { username, password } = effectiveAuth.basic;
                const subsUser = substituteVariables(username);
                const subsPass = substituteVariables(password);
                const credentials = btoa(`${subsUser}:${subsPass}`);
                headerObj['Authorization'] = `Basic ${credentials}`;
            } else if (effectiveAuth.type === 'bearer' && effectiveAuth.bearer) {
                const subsToken = substituteVariables(effectiveAuth.bearer.token);
                headerObj['Authorization'] = `Bearer ${subsToken}`;
            } else if (effectiveAuth.type === 'apikey' && effectiveAuth.apikey) {
                const subsKey = substituteVariables(effectiveAuth.apikey.key);
                const subsValue = substituteVariables(effectiveAuth.apikey.value);
                if (effectiveAuth.apikey.addTo === 'header') {
                    headerObj[subsKey] = subsValue;
                } else {
                    paramObj[subsKey] = subsValue;
                }
            }

            const queryString = new URLSearchParams(paramObj).toString();
            const urlWithVars = substituteVariables(url || "");
            const finalUrl = queryString ? `${urlWithVars}?${queryString}` : urlWithVars;

            if (!finalUrl || finalUrl.trim() === "") {
                onResponse({
                    status: 0,
                    statusText: 'Validation Error',
                    error: 'URL is required',
                    data: null
                });
                setLoading(false);
                return;
            }

            const bodyWithVars = (method !== "GET" && method !== "HEAD") ? substituteVariables(body || "") : undefined;

            // ─── Run Pre-Request Script ───
            const envVars: Record<string, string> = {};
            if (activeEnv && activeEnv.variables) {
                activeEnv.variables.forEach(v => {
                    if (v.enabled && v.key) envVars[v.key] = v.value;
                });
            }

            if (effectivePreScript.trim()) {
                const preResult = runScript(effectivePreScript, {
                    request: { method, url: finalUrl, headers: headerObj, body: bodyWithVars || '' },
                    environmentVars: envVars,
                });
                // Apply env updates from pre-script
                if (Object.keys(preResult.envUpdates).length > 0) {
                    Object.assign(envVars, preResult.envUpdates);
                }
                if (preResult.error) {
                    updateTab(activeTabId, { testResults: [], response: null });
                    onResponse({
                        status: 0,
                        statusText: 'Script Error',
                        error: `Pre-request script error: ${preResult.error}`,
                        data: null,
                        scriptLogs: preResult.logs,
                    });
                    setLoading(false);
                    return;
                }
            }

            // ─── Send Request ───
            let requestBody: any = bodyWithVars;

            if (effectiveBodyType === 'form-data') {
                const fd = new FormData();
                effectiveFormData.forEach(item => {
                    if (item.key) {
                        const key = substituteVariables(item.key);
                        if (item.type === 'file' && item.file) {
                            fd.append(key, item.file);
                        } else {
                            fd.append(key, substituteVariables(item.value));
                        }
                    }
                });
                requestBody = fd;
                delete headerObj['Content-Type'];
            } else if (effectiveBodyType === 'urlencoded') {
                const params = new URLSearchParams();
                effectiveUrlEncoded.forEach(item => {
                    if (item.key) params.append(substituteVariables(item.key), substituteVariables(item.value));
                });
                requestBody = params.toString();
                headerObj['Content-Type'] = 'application/x-www-form-urlencoded';
            } else {
                if (!headerObj['Content-Type']) {
                    if (effectiveRawLanguage === 'json') headerObj['Content-Type'] = 'application/json';
                    else if (effectiveRawLanguage === 'xml') headerObj['Content-Type'] = 'application/xml';
                    else if (effectiveRawLanguage === 'html') headerObj['Content-Type'] = 'text/html';
                    else headerObj['Content-Type'] = 'text/plain';
                }
            }

            const res = await axios.post("/api/proxy", {
                method,
                url: finalUrl,
                headers: headerObj,
                body: requestBody,
                bodyType: effectiveBodyType
            }, {
                validateStatus: () => true // Handle 400/500 errors via onResponse instead of throwing
            });

            if (res.data.error && res.status >= 400) {
                onResponse({
                    status: res.status,
                    statusText: res.statusText,
                    error: res.data.error,
                    details: res.data.details,
                    data: res.data
                });
                setLoading(false);
                return;
            }

            const duration = Date.now() - startTime;

            await db.history.add({
                method,
                url: finalUrl,
                status: res.data.status,
                duration,
                environmentId: activeEnvironmentId || undefined,
                createdAt: Date.now()
            });

            const responseData = {
                ...res.data,
                duration
            };

            // ─── Run Post-Response Script ───
            let testResults: any[] = [];
            let scriptLogs: string[] = [];
            let scriptError: string | undefined;

            if (effectivePostScript.trim()) {
                const postResult = runScript(effectivePostScript, {
                    request: { method, url: finalUrl, headers: headerObj, body: bodyWithVars || '' },
                    response: {
                        status: res.data.status,
                        statusText: res.data.statusText,
                        headers: res.data.headers || {},
                        body: res.data.data,
                        responseTime: duration,
                    },
                    environmentVars: envVars,
                });
                testResults = postResult.testResults;
                scriptLogs = postResult.logs;
                scriptError = postResult.error;

                // Update environment variables if any was set via script
                if (activeEnv && activeEnv.variables) {
                    let updatedVars = [...activeEnv.variables];

                    // Update existing
                    updatedVars = updatedVars.map((v: any) => {
                        if (v.key && envVars[v.key] !== undefined) {
                            return { ...v, value: envVars[v.key] };
                        }
                        return v;
                    });

                    // Add new ones from script updates that weren't in env yet
                    Object.entries(postResult.envUpdates).forEach(([key, value]) => {
                        if (!updatedVars.find((v: any) => v.key === key)) {
                            updatedVars.push({ key, value: String(value), enabled: true });
                        } else {
                            // Also update if it exists but might have been changed in script
                            const idx = updatedVars.findIndex(v => v.key === key);
                            if (idx !== -1) updatedVars[idx].value = String(value);
                        }
                    });

                    await db.environments.update(activeEnv.id!, { variables: updatedVars });
                }
            }

            updateTab(activeTabId, { testResults });
            onResponse({
                ...responseData,
                scriptLogs,
                scriptError,
            });

        } catch (error: any) {
            console.error("Request Error:", error);
            const serverError = error.response?.data;
            onResponse({
                status: error.response?.status || 500,
                statusText: error.response?.statusText || "Error",
                error: serverError?.error || error.message || "Unknown Error",
                details: serverError?.details || null,
                data: serverError || null
            });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickSave = async () => {
        const isSaved = !isNaN(Number(activeTabId));
        if (isSaved) {
            try {
                const requestData = {
                    name: currentRequest.label || "Untitled Request",
                    method,
                    url,
                    params: effectiveParams.reduce((acc: any, p) => (p.key ? { ...acc, [p.key]: p.value } : acc), {}),
                    headers: effectiveHeaders.reduce((acc: any, h) => (h.key ? { ...acc, [h.key]: h.value } : acc), {}),
                    body,
                    bodyType: effectiveBodyType,
                    bodyRawLanguage: effectiveRawLanguage,
                    bodyFormData: effectiveFormData,
                    bodyFormUrlEncoded: effectiveUrlEncoded,
                    auth,
                    environmentId: activeEnvironmentId || undefined,
                };
                await db.requests.update(Number(activeTabId), requestData);
                updateTab(activeTabId, { isDirty: false });
                console.log("Quick saved request:", activeTabId);
            } catch (error) {
                console.error("Failed to quick save:", error);
            }
        } else {
            setSaveDialogOpen(true);
        }
    };

    // Global keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                handleQuickSave();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeTabId, currentRequest, method, url, effectiveParams, effectiveHeaders, body, effectiveAuth, activeEnvironmentId]);

    const hasScripts = effectivePreScript.trim() || effectivePostScript.trim();

    return (
        <div className="flex-1 flex flex-col h-full min-w-0">
            {/* ─── URL Bar ─── */}
            <div className="p-3 border-b border-border/50 bg-url-bar-bg">
                <div className="flex gap-2 items-center">
                    <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className={cn(
                            "h-10 rounded-lg border font-bold text-xs tracking-wider px-3 py-2 outline-none cursor-pointer transition-colors",
                            METHOD_COLORS[method] || METHOD_COLORS.GET
                        )}
                    >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                    </select>
                    <Input
                        className="flex-1 font-mono text-sm h-10 bg-background/80 border-border/50 focus:border-indigo-500/50 focus:ring-indigo-500/20 transition-all"
                        placeholder="https://api.example.com/v1/resource"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={loading}
                        className="h-10 px-5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white border-0 shadow-md shadow-indigo-500/20 transition-all"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Send
                    </Button>
                    <SaveRequestDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen} />
                </div>
                {/* ─── Toolbar ─── */}
                <div className="flex items-center gap-2 mt-2">
                    <ImportCurlDialog />
                    <CodeGeneratorDialog />
                </div>
            </div>

            {/* ─── Tabs ─── */}
            <Tabs defaultValue="params" className="flex-1 flex flex-col min-h-0">
                <div className="border-b border-border/50 px-3 bg-url-bar-bg/50">
                    <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-0">
                        {["params", "headers", "body", "scripts", "auth"].map(tab => (
                            <TabsTrigger
                                key={tab}
                                value={tab}
                                className="data-[state=active]:border-indigo-500 data-[state=active]:text-foreground data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs font-medium tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors relative"
                            >
                                {tab === "scripts" ? (
                                    <span className="flex items-center gap-1.5">
                                        <FileCode2 className="h-3 w-3" />
                                        Scripts
                                        {hasScripts && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
                                    </span>
                                ) : (
                                    tab.charAt(0).toUpperCase() + tab.slice(1)
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <div className="p-4 flex-1 overflow-auto">
                    <TabsContent value="params" className="mt-0 h-full">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Query Parameters</h3>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setParams([...effectiveParams, { key: "", value: "" }])}>
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                            </div>
                            {effectiveParams.map((p, i) => (
                                <div key={i} className="flex gap-2 items-center group">
                                    <Input
                                        className="flex-1 text-xs h-8 bg-background/50 font-mono"
                                        placeholder="parameter_key"
                                        value={p.key}
                                        onChange={(e) => { const n = [...effectiveParams]; n[i].key = e.target.value; setParams(n); }}
                                    />
                                    <Input
                                        className="flex-1 text-xs h-8 bg-background/50 font-mono"
                                        placeholder="value"
                                        value={p.value}
                                        onChange={(e) => { const n = [...effectiveParams]; n[i].value = e.target.value; setParams(n); }}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                        onClick={() => setParams(effectiveParams.filter((_, idx) => idx !== i))}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="headers" className="mt-0 h-full">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headers</h3>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setHeaders([...effectiveHeaders, { key: "", value: "" }])}>
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                            </div>
                            {effectiveHeaders.map((h, i) => (
                                <div key={i} className="flex gap-2 items-center group">
                                    <Input
                                        className="flex-1 text-xs h-8 bg-background/50 font-mono"
                                        placeholder="Header-Name"
                                        value={h.key}
                                        onChange={(e) => { const n = [...effectiveHeaders]; n[i].key = e.target.value; setHeaders(n); }}
                                    />
                                    <Input
                                        className="flex-1 text-xs h-8 bg-background/50 font-mono"
                                        placeholder="value"
                                        value={h.value}
                                        onChange={(e) => { const n = [...effectiveHeaders]; n[i].value = e.target.value; setHeaders(n); }}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                        onClick={() => setHeaders(effectiveHeaders.filter((_, idx) => idx !== i))}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="body" className="mt-0 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-3 bg-muted/20 p-2 rounded-md">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={effectiveBodyType === 'json' ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => updateTab(activeTabId, { bodyType: 'json' })}
                                    className="h-7 text-xs"
                                >
                                    Raw
                                </Button>
                                {effectiveBodyType === 'json' && (
                                    <Select
                                        value={effectiveRawLanguage}
                                        onValueChange={(v) => updateTab(activeTabId, { bodyRawLanguage: v as any })}
                                    >
                                        <SelectTrigger className="h-7 w-[70px] text-xs bg-transparent border-none shadow-none focus:ring-0 focus:ring-offset-0 px-1 gap-1 text-muted-foreground hover:text-foreground data-[state=open]:bg-transparent">
                                            <SelectValue placeholder="Lang" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="json">JSON</SelectItem>
                                            <SelectItem value="xml">XML</SelectItem>
                                            <SelectItem value="html">HTML</SelectItem>
                                            <SelectItem value="text">Text</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                                <Button
                                    variant={effectiveBodyType === 'form-data' ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => updateTab(activeTabId, { bodyType: 'form-data' })}
                                    className="h-7 text-xs"
                                >
                                    Form Data
                                </Button>
                                <Button
                                    variant={effectiveBodyType === 'urlencoded' ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => updateTab(activeTabId, { bodyType: 'urlencoded' })}
                                    className="h-7 text-xs"
                                >
                                    x-www-form-urlencoded
                                </Button>
                            </div>
                            {effectiveBodyType === 'json' && effectiveRawLanguage === 'json' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] hover:bg-indigo-500/10 hover:text-indigo-400"
                                    onClick={() => {
                                        try {
                                            const parsed = JSON.parse(body);
                                            setBody(JSON.stringify(parsed, null, 2));
                                        } catch (e) { }
                                    }}
                                    title="Format JSON"
                                >
                                    <FileCode2 className="mr-1 h-3 w-3" />
                                    Format
                                </Button>
                            )}
                        </div>

                        {effectiveBodyType === 'json' && (
                            <CodeEditor
                                value={body}
                                onChange={(v) => setBody(v)}
                                language={effectiveRawLanguage}
                                className="flex-1"
                            />
                        )}

                        {effectiveBodyType === 'form-data' && (
                            <div className="space-y-2 overflow-auto">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Multipart Form Data</span>
                                    <Button variant="outline" size="sm" className="h-6 text-[10px]"
                                        onClick={() => updateTab(activeTabId, { bodyFormData: [...effectiveFormData, { key: '', value: '', type: 'text' }] })}>
                                        <Plus className="h-3 w-3 mr-1" /> Add Field
                                    </Button>
                                </div>
                                {effectiveFormData.map((field, i) => (
                                    <div key={i} className="flex gap-2 items-center group">
                                        <Input
                                            className="flex-1 text-xs h-8 font-mono"
                                            placeholder="Key"
                                            value={field.key || ''}
                                            onChange={(e) => {
                                                const n = [...effectiveFormData];
                                                n[i] = { ...n[i], key: e.target.value };
                                                updateTab(activeTabId, { bodyFormData: n });
                                            }}
                                        />
                                        <select
                                            className="h-8 rounded border px-2 text-xs bg-background"
                                            value={field.type}
                                            onChange={(e) => {
                                                const n = [...effectiveFormData];
                                                n[i] = { ...n[i], type: e.target.value as 'text' | 'file' };
                                                updateTab(activeTabId, { bodyFormData: n });
                                            }}
                                        >
                                            <option value="text">Text</option>
                                            <option value="file">File</option>
                                        </select>
                                        {field.type === 'file' ? (
                                            <Input
                                                type="file"
                                                className="flex-[2] text-xs h-8 file:text-xs file:h-full file:mr-2"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    const n = [...effectiveFormData];
                                                    n[i] = { ...n[i], file: file, value: file?.name || '' };
                                                    updateTab(activeTabId, { bodyFormData: n });
                                                }}
                                            />
                                        ) : (
                                            <Input
                                                className="flex-[2] text-xs h-8 font-mono"
                                                placeholder="Value"
                                                value={field.value || ''}
                                                onChange={(e) => {
                                                    const n = [...effectiveFormData];
                                                    n[i] = { ...n[i], value: e.target.value };
                                                    updateTab(activeTabId, { bodyFormData: n });
                                                }}
                                            />
                                        )}
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                            onClick={() => updateTab(activeTabId, { bodyFormData: effectiveFormData.filter((_, idx) => idx !== i) })}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {effectiveBodyType === 'urlencoded' && (
                            <div className="space-y-2 overflow-auto">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">x-www-form-urlencoded</span>
                                    <Button variant="outline" size="sm" className="h-6 text-[10px]"
                                        onClick={() => updateTab(activeTabId, { bodyFormUrlEncoded: [...effectiveUrlEncoded, { key: '', value: '' }] })}>
                                        <Plus className="h-3 w-3 mr-1" /> Add Field
                                    </Button>
                                </div>
                                {effectiveUrlEncoded.map((field, i) => (
                                    <div key={i} className="flex gap-2 items-center group">
                                        <Input
                                            className="flex-1 text-xs h-8 font-mono"
                                            placeholder="Key"
                                            value={field.key || ''}
                                            onChange={(e) => {
                                                const n = [...effectiveUrlEncoded];
                                                n[i] = { ...n[i], key: e.target.value };
                                                updateTab(activeTabId, { bodyFormUrlEncoded: n });
                                            }}
                                        />
                                        <Input
                                            className="flex-[2] text-xs h-8 font-mono"
                                            placeholder="Value"
                                            value={field.value || ''}
                                            onChange={(e) => {
                                                const n = [...effectiveUrlEncoded];
                                                n[i] = { ...n[i], value: e.target.value };
                                                updateTab(activeTabId, { bodyFormUrlEncoded: n });
                                            }}
                                        />
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                            onClick={() => updateTab(activeTabId, { bodyFormUrlEncoded: effectiveUrlEncoded.filter((_, idx) => idx !== i) })}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="scripts" className="mt-0 h-full flex flex-col">
                        {/* Pre / Post toggle */}
                        <div className="flex items-center gap-1 mb-3">
                            <button
                                onClick={() => setScriptTab("pre")}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    scriptTab === "pre"
                                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                Pre-request {effectivePreScript.trim() && "•"}
                            </button>
                            <button
                                onClick={() => setScriptTab("post")}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    scriptTab === "post"
                                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                Post-response {effectivePostScript.trim() && "•"}
                            </button>
                        </div>

                        {scriptTab === "pre" ? (
                            <ScriptEditor
                                value={preScript}
                                onChange={(v) => updateTab(activeTabId, { preScript: v })}
                                placeholder="// Runs before the request is sent\n// Example: pm.environment.set('timestamp', Date.now());"
                                className="flex-1"
                            />
                        ) : (
                            <ScriptEditor
                                value={postScript}
                                onChange={(v) => updateTab(activeTabId, { postScript: v })}
                                placeholder='// Runs after response is received\n// Example:\npm.test("Status is 200", () => {\n  pm.expect(pm.response.code).to.equal(200);\n});'
                                className="flex-1"
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="auth" className="mt-0 h-full p-2">
                        <AuthPanel />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
