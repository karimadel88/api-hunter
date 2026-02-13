"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ScriptEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const SNIPPETS = [
    { label: "Set env variable", code: `pm.environment.set("key", "value");` },
    { label: "Get env variable", code: `const val = pm.environment.get("key");` },
    { label: "Test status code", code: `pm.test("Status is 200", () => {\n  pm.expect(pm.response.code).to.equal(200);\n});` },
    { label: "Test response body", code: `pm.test("Has expected field", () => {\n  const json = pm.response.json();\n  pm.expect(json).to.have.property("id");\n});` },
    { label: "Test response time", code: `pm.test("Response < 500ms", () => {\n  pm.expect(pm.response.responseTime).to.be.below(500);\n});` },
    { label: "Log response", code: `console.log(pm.response.json());` },
];

export function ScriptEditor({ value, onChange, placeholder, className }: ScriptEditorProps) {
    return (
        <div className={cn("flex flex-col h-full gap-2", className)}>
            {/* Snippet buttons */}
            <div className="flex flex-wrap gap-1">
                {SNIPPETS.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => {
                            const newValue = value ? value + "\n\n" + s.code : s.code;
                            onChange(newValue);
                        }}
                        className="px-2 py-1 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                    >
                        + {s.label}
                    </button>
                ))}
            </div>

            {/* Editor */}
            <textarea
                className="flex-1 w-full p-3 border border-border/50 rounded-lg font-mono text-xs bg-background/50 resize-none outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all leading-relaxed tab-size-2"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || "// Write your script here...\n// Use pm.test(), pm.expect(), pm.environment, console.log()"}
                spellCheck={false}
                onKeyDown={(e) => {
                    // Tab support
                    if (e.key === "Tab") {
                        e.preventDefault();
                        const target = e.target as HTMLTextAreaElement;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const newValue = value.substring(0, start) + "  " + value.substring(end);
                        onChange(newValue);
                        // Restore cursor
                        requestAnimationFrame(() => {
                            target.selectionStart = target.selectionEnd = start + 2;
                        });
                    }
                }}
            />

            {/* Helper text */}
            <div className="text-[10px] text-muted-foreground/50 px-1">
                Available: <code className="text-muted-foreground/70">pm.test()</code> · <code className="text-muted-foreground/70">pm.expect()</code> · <code className="text-muted-foreground/70">pm.environment.set/get()</code> · <code className="text-muted-foreground/70">pm.response.json()</code> · <code className="text-muted-foreground/70">console.log()</code>
            </div>
        </div>
    );
}
