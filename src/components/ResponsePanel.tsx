"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponseFormatter } from "@/components/ResponseFormatter";
import { TestResultsPanel } from "@/components/TestResultsPanel";
import { useCurrentRequest } from "@/lib/store";
import { Clock, FileJson, Wifi, Copy, Check, Download, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ResponsePanelProps {
    response: any;
    orientation?: "vertical" | "horizontal";
}

function getStatusBadgeClass(status: number) {
    if (status >= 200 && status < 300) return "status-2xx";
    if (status >= 300 && status < 400) return "status-3xx";
    if (status >= 400 && status < 500) return "status-4xx";
    return "status-5xx";
}

function getSizeString(data: any): string {
    if (!data) return "0 B";
    const str = typeof data === "string" ? data : JSON.stringify(data);
    const bytes = new Blob([str]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

export function ResponsePanel({ response, orientation = "vertical" }: ResponsePanelProps) {
    const [copiedHeader, setCopiedHeader] = useState<string | null>(null);
    const currentRequest = useCurrentRequest();
    const isVertical = orientation === "vertical";

    if (!response) {
        return (
            <div className={cn(
                "flex flex-col items-center justify-center text-muted-foreground/40 bg-sidebar-bg h-full w-full"
            )}>
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center mb-4 border border-indigo-500/10">
                    <Wifi className="h-6 w-6 text-indigo-400/40" />
                </div>
                <p className="text-sm font-medium">No Response Yet</p>
                <p className="text-[11px] mt-1 text-muted-foreground/30">Send a request to see the response here.</p>
            </div>
        );
    }

    const responseHeaders = response.headers || {};
    const headerEntries = Object.entries(responseHeaders);

    const copyHeaderValue = (key: string, value: string) => {
        navigator.clipboard.writeText(value);
        setCopiedHeader(key);
        setTimeout(() => setCopiedHeader(null), 1500);
    };

    const downloadResponse = () => {
        const data = response.data || response.error;
        const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `response_${response.status}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full w-full bg-background">
            {/* ─── Status Bar ─── */}
            <div className="px-4 py-2.5 border-b border-border/50 bg-url-bar-bg flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={cn("status-badge", getStatusBadgeClass(response.status))}>
                        {response.status} {response.statusText || ""}
                    </span>
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1.5" title="Response time">
                            <Clock className="h-3 w-3" />
                            <span className="text-[11px] font-mono">{formatDuration(response.duration || 0)}</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Response size">
                            <FileJson className="h-3 w-3" />
                            <span className="text-[11px] font-mono">{getSizeString(response.data)}</span>
                        </div>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={downloadResponse}
                    title="Download response"
                >
                    <Download className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* ─── Response Tabs ─── */}
            <Tabs defaultValue="body" className="flex-1 flex flex-col min-h-0">
                <div className="border-b border-border/50 px-3 bg-url-bar-bg/30">
                    <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-0">
                        <TabsTrigger
                            value="body"
                            className="data-[state=active]:border-indigo-500 data-[state=active]:text-foreground data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-2 text-xs font-medium tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Body
                        </TabsTrigger>
                        <TabsTrigger
                            value="headers"
                            className="data-[state=active]:border-indigo-500 data-[state=active]:text-foreground data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-2 text-xs font-medium tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Headers
                            {headerEntries.length > 0 && (
                                <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-normal">
                                    {headerEntries.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger
                            value="tests"
                            className="data-[state=active]:border-indigo-500 data-[state=active]:text-foreground data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-2 text-xs font-medium tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <FlaskConical className="h-3 w-3 mr-1" />
                            Tests
                            {currentRequest.testResults.length > 0 && (
                                <span className={cn(
                                    "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                                    currentRequest.testResults.every(r => r.passed)
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : "bg-red-500/10 text-red-400"
                                )}>
                                    {currentRequest.testResults.filter(r => r.passed).length}/{currentRequest.testResults.length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="body" className="flex-1 mt-0 overflow-hidden">
                    <ResponseFormatter
                        data={response.data || response.error}
                        status={response.status}
                    />
                </TabsContent>

                <TabsContent value="headers" className="flex-1 mt-0 overflow-auto">
                    <div className="divide-y divide-border/30">
                        {headerEntries.map(([key, value]) => (
                            <div
                                key={key}
                                className="flex items-start gap-3 px-4 py-2 hover:bg-muted/30 transition-colors group"
                            >
                                <span className="text-[11px] font-mono font-semibold text-indigo-400 min-w-[160px] shrink-0 pt-0.5 select-all">{key}</span>
                                <span className="text-[11px] font-mono text-muted-foreground break-all flex-1 select-all leading-relaxed">{String(value)}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => copyHeaderValue(key, String(value))}
                                >
                                    {copiedHeader === key
                                        ? <Check className="h-3 w-3 text-green-500" />
                                        : <Copy className="h-3 w-3 text-muted-foreground" />
                                    }
                                </Button>
                            </div>
                        ))}
                        {headerEntries.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40">
                                <p className="text-xs italic">No response headers available.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="tests" className="flex-1 mt-0 overflow-auto p-4">
                    <TestResultsPanel
                        results={currentRequest.testResults}
                        logs={response?.scriptLogs}
                        error={response?.scriptError}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
