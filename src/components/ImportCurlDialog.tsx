"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { Terminal, X, Import } from "lucide-react";

function parseCurl(curlString: string) {
    const result: {
        method: string;
        url: string;
        headers: { key: string; value: string }[];
        body: string;
    } = {
        method: "GET",
        url: "",
        headers: [],
        body: "",
    };

    // Clean up: remove line continuation backslashes and newlines
    let cmd = curlString
        .replace(/\\\r?\n/g, " ")
        .replace(/\r?\n/g, " ")
        .trim();

    // Remove 'curl' prefix
    cmd = cmd.replace(/^curl\s+/i, "");

    const tokens: string[] = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < cmd.length; i++) {
        const ch = cmd[i];
        if (ch === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (ch === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        } else if (ch === " " && !inSingleQuote && !inDoubleQuote) {
            if (current) {
                tokens.push(current);
                current = "";
            }
        } else {
            current += ch;
        }
    }
    if (current) tokens.push(current);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token === "-X" || token === "--request") {
            result.method = tokens[++i]?.toUpperCase() || "GET";
        } else if (token === "-H" || token === "--header") {
            const header = tokens[++i] || "";
            const colonIdx = header.indexOf(":");
            if (colonIdx > 0) {
                result.headers.push({
                    key: header.slice(0, colonIdx).trim(),
                    value: header.slice(colonIdx + 1).trim(),
                });
            }
        } else if (token === "-d" || token === "--data" || token === "--data-raw" || token === "--data-binary") {
            result.body = tokens[++i] || "";
            if (!result.method || result.method === "GET") {
                result.method = "POST";
            }
        } else if (token.startsWith("http://") || token.startsWith("https://")) {
            result.url = token;
        } else if (!token.startsWith("-") && !result.url) {
            result.url = token;
        }
    }

    return result;
}

export function ImportCurlDialog() {
    const [open, setOpen] = useState(false);
    const [curlText, setCurlText] = useState("");
    const [error, setError] = useState("");
    const { addTab } = useAppStore();

    const handleImport = () => {
        try {
            const parsed = parseCurl(curlText);
            if (!parsed.url) {
                setError("Could not find a URL in the cURL command.");
                return;
            }
            addTab({
                method: parsed.method,
                url: parsed.url,
                headers: parsed.headers.length > 0 ? parsed.headers : [{ key: "", value: "" }],
                body: parsed.body,
                label: (() => {
                    try {
                        const u = new URL(parsed.url);
                        return u.pathname === "/" ? u.hostname : u.pathname;
                    } catch { return parsed.url.slice(0, 30); }
                })(),
            });
            setOpen(false);
            setCurlText("");
            setError("");
        } catch (e: any) {
            setError("Failed to parse cURL: " + e.message);
        }
    };

    if (!open) {
        return (
            <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setOpen(true)}
                title="Import cURL"
            >
                <Terminal className="h-3 w-3" />
                Import
            </Button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background border border-border rounded-xl shadow-2xl w-[560px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-indigo-400" />
                        <h2 className="text-sm font-semibold">Import cURL</h2>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setOpen(false); setError(""); }}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                {/* Body */}
                <div className="p-5 flex-1 flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">
                        Paste a cURL command below. It will be parsed into method, URL, headers, and body.
                    </p>
                    <textarea
                        className="flex-1 min-h-[160px] w-full p-3 border border-border/50 rounded-lg font-mono text-xs bg-muted/30 resize-none outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all leading-relaxed"
                        value={curlText}
                        onChange={(e) => { setCurlText(e.target.value); setError(""); }}
                        placeholder={`curl -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John"}'`}
                        spellCheck={false}
                        autoFocus
                    />
                    {error && (
                        <p className="text-xs text-red-400">{error}</p>
                    )}
                </div>
                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/50">
                    <Button variant="outline" size="sm" onClick={() => { setOpen(false); setError(""); }}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        disabled={!curlText.trim()}
                        className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0"
                        onClick={handleImport}
                    >
                        <Import className="h-3.5 w-3.5 mr-1.5" />
                        Import
                    </Button>
                </div>
            </div>
        </div>
    );
}
