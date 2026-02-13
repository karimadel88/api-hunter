"use client";

import React from "react";
import { TestResult } from "@/lib/store";
import { CheckCircle2, XCircle, AlertTriangle, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestResultsPanelProps {
    results: TestResult[];
    logs?: string[];
    error?: string;
}

export function TestResultsPanel({ results, logs, error }: TestResultsPanelProps) {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    if (!results.length && !logs?.length && !error) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50">
                <Terminal className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs font-medium">No test results yet</p>
                <p className="text-[10px] mt-1">Add tests in the Scripts tab and send a request</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Summary bar */}
            {results.length > 0 && (
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{results.length} tests</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="text-xs font-medium">{passed} passed</span>
                    </div>
                    {failed > 0 && (
                        <div className="flex items-center gap-1 text-red-400">
                            <XCircle className="h-3 w-3" />
                            <span className="text-xs font-medium">{failed} failed</span>
                        </div>
                    )}
                    <div className={cn(
                        "ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold",
                        failed === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    )}>
                        {failed === 0 ? "ALL PASSED" : `${failed} FAILED`}
                    </div>
                </div>
            )}

            {/* Individual test results */}
            <div className="space-y-1">
                {results.map((r, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex items-start gap-2 px-3 py-2 rounded-md text-xs",
                            r.passed ? "bg-emerald-500/5" : "bg-red-500/5"
                        )}
                    >
                        {r.passed ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                            <span className={cn("font-medium", r.passed ? "text-emerald-300" : "text-red-300")}>
                                {r.name}
                            </span>
                            {r.error && (
                                <p className="text-red-400/80 text-[11px] mt-0.5 font-mono">{r.error}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Script error */}
            {error && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                    <div className="text-xs">
                        <span className="font-medium text-red-400">Script Error</span>
                        <p className="text-red-400/80 font-mono mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {/* Console output */}
            {logs && logs.length > 0 && (
                <div className="mt-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Terminal className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Console</span>
                    </div>
                    <div className="bg-muted/20 rounded-lg border border-border/30 p-2 space-y-0.5 max-h-40 overflow-auto">
                        {logs.map((log, i) => (
                            <div key={i} className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
