"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { Button } from "./ui/button";
import { Plus, History, Folder, ChevronRight, Zap, Search, Trash2, Clock } from "lucide-react";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { useAppStore } from "../lib/store";
import { EnvironmentManager } from "./EnvironmentManager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ModeToggle } from "./mode-toggle";

function getMethodClass(method: string) {
    switch (method) {
        case "GET": return "method-badge-get";
        case "POST": return "method-badge-post";
        case "PUT": return "method-badge-put";
        case "DELETE": return "method-badge-delete";
        case "PATCH": return "method-badge-patch";
        default: return "method-badge-get";
    }
}

function getStatusColor(status: number) {
    if (status >= 200 && status < 300) return "text-emerald-400";
    if (status >= 300 && status < 400) return "text-blue-400";
    if (status >= 400 && status < 500) return "text-amber-400";
    return "text-red-400";
}

function formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(ts: number) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Sidebar() {
    const collections = useLiveQuery(() => db.collections.toArray());
    const requests = useLiveQuery(() => db.requests.toArray());
    const history = useLiveQuery(() => db.history.reverse().limit(30).toArray());
    const environments = useLiveQuery(() => db.environments.toArray());

    const { addTab, activeEnvironmentId, setActiveEnvironmentId } = useAppStore();

    const [historySearch, setHistorySearch] = useState("");

    const loadRequest = (req: any) => {
        const paramsArr = Object.entries(req.params || {}).map(([key, value]) => ({ key, value: value as string }));
        if (paramsArr.length === 0) paramsArr.push({ key: "", value: "" });
        const headersArr = Object.entries(req.headers || {}).map(([key, value]) => ({ key, value: value as string }));
        if (headersArr.length === 0) headersArr.push({ key: "", value: "" });

        addTab({
            method: req.method,
            url: req.url,
            params: paramsArr,
            headers: headersArr,
            body: req.body || "",
            label: req.name || req.url,
        });
    };

    const loadHistoryItem = (item: any) => {
        addTab({
            method: item.method,
            url: item.url,
            label: (() => {
                try {
                    const u = new URL(item.url);
                    return u.pathname === "/" ? u.hostname : u.pathname;
                } catch { return item.url?.slice(0, 30) || "History"; }
            })(),
        });
    };

    const clearHistory = async () => {
        await db.history.clear();
    };

    const filteredHistory = history?.filter(item => {
        if (!historySearch) return true;
        const s = historySearch.toLowerCase();
        return item.url?.toLowerCase().includes(s) || item.method?.toLowerCase().includes(s);
    });

    return (
        <div className="w-full bg-sidebar-bg h-screen flex flex-col border-r border-border/50">
            {/* ─── Brand Header ─── */}
            <div className="p-4 border-b border-border/50">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
                            <Zap className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-sm tracking-tight">API Hunter</h1>
                            <p className="text-[10px] text-muted-foreground">v1.0 · Advanced Testing</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <ModeToggle />
                        <EnvironmentManager />
                    </div>
                </div>

                {/* Environment Selector */}
                <Select value={activeEnvironmentId?.toString() || "none"} onValueChange={(val) => setActiveEnvironmentId(val === "none" ? null : parseInt(val))}>
                    <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50">
                        <SelectValue placeholder="No Environment" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">No Environment</SelectItem>
                        {environments?.map((env: any) => (
                            <SelectItem key={env.id} value={env.id?.toString() || ""}>{env.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* ─── Main Scrollable ─── */}
            <div className="flex-1 overflow-y-auto">
                {/* Collections */}
                <div className="p-3">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Collections</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 rounded">
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="space-y-0.5">
                        {collections?.map((col: any) => (
                            <div key={col.id}>
                                <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent/50 transition-colors text-left">
                                    <Folder className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                    <span className="truncate text-xs font-medium">{col.name}</span>
                                    <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                                </button>
                                <div className="ml-4 pl-2 border-l border-border/30 space-y-0.5 mt-0.5">
                                    {requests?.filter((r: any) => r.collectionId === col.id).map((req: any) => (
                                        <button
                                            key={req.id}
                                            onClick={() => loadRequest(req)}
                                            className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-accent/50 transition-colors text-left"
                                        >
                                            <span className={cn("method-badge shrink-0", getMethodClass(req.method))}>{req.method}</span>
                                            <span className="truncate text-muted-foreground">{req.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Uncategorized */}
                        {requests?.filter((r: any) => !r.collectionId).map((req: any) => (
                            <button
                                key={req.id}
                                onClick={() => loadRequest(req)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent/50 transition-colors text-left"
                            >
                                <span className={cn("method-badge shrink-0", getMethodClass(req.method))}>{req.method}</span>
                                <span className="truncate text-muted-foreground">{req.name}</span>
                            </button>
                        ))}

                        {!collections?.length && !requests?.length && (
                            <p className="text-xs text-muted-foreground/60 px-2 py-4 text-center italic">No collections yet. Send a request and save it!</p>
                        )}
                    </div>
                </div>

                {/* History */}
                <div className="p-3 border-t border-border/30">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                            <History className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">History</span>
                            {history?.length ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-medium">{history.length}</span>
                            ) : null}
                        </div>
                        {history && history.length > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 rounded text-muted-foreground hover:text-destructive"
                                onClick={clearHistory}
                                title="Clear history"
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>

                    {/* Search */}
                    {history && history.length > 3 && (
                        <div className="relative mb-2">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                                className="h-7 text-[11px] pl-7 bg-background/50 border-border/30"
                                placeholder="Search history..."
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="space-y-0.5">
                        {filteredHistory?.map((item: any) => (
                            <button
                                key={item.id}
                                onClick={() => loadHistoryItem(item)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent/50 transition-colors text-left group"
                            >
                                <span className={cn("method-badge shrink-0", getMethodClass(item.method))}>{item.method}</span>
                                <span className="truncate text-muted-foreground flex-1 min-w-0">{item.url}</span>
                                <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.status && (
                                        <span className={cn("text-[10px] font-mono font-medium", getStatusColor(item.status))}>
                                            {item.status}
                                        </span>
                                    )}
                                    {item.duration && (
                                        <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                                            <Clock className="h-2.5 w-2.5" />
                                            {formatDuration(item.duration)}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                        {!history?.length && (
                            <p className="text-xs text-muted-foreground/60 px-2 py-4 text-center italic">No history yet.</p>
                        )}
                        {history?.length && filteredHistory?.length === 0 ? (
                            <p className="text-xs text-muted-foreground/60 px-2 py-2 text-center italic">No matching history.</p>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
