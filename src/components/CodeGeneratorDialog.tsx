"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore, useCurrentRequest } from "@/lib/store";
import { Code, X, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Lang = "curl" | "javascript" | "python" | "go" | "php";

const LANGUAGES: { id: Lang; label: string }[] = [
    { id: "curl", label: "cURL" },
    { id: "javascript", label: "JavaScript" },
    { id: "python", label: "Python" },
    { id: "go", label: "Go" },
    { id: "php", label: "PHP" },
];

function generateCode(
    lang: Lang,
    method: string,
    url: string,
    headers: { key: string; value: string }[] = [],
    body: string = ""
): string {
    const activeHeaders = (headers || []).filter(h => h.key);
    const hasBody = body && method !== "GET" && method !== "HEAD";

    switch (lang) {
        case "curl": {
            let lines = [`curl -X ${method} '${url}'`];
            activeHeaders.forEach(h => lines.push(`  -H '${h.key}: ${h.value}'`));
            if (hasBody) lines.push(`  -d '${body}'`);
            return lines.join(" \\\n");
        }
        case "javascript": {
            let code = "";
            if (activeHeaders.length > 0 || hasBody) {
                code += `const response = await fetch('${url}', {\n`;
                code += `  method: '${method}',\n`;
                if (activeHeaders.length > 0) {
                    code += `  headers: {\n`;
                    activeHeaders.forEach(h => {
                        code += `    '${h.key}': '${h.value}',\n`;
                    });
                    code += `  },\n`;
                }
                if (hasBody) {
                    code += `  body: JSON.stringify(${body}),\n`;
                }
                code += `});\n\n`;
            } else {
                code += `const response = await fetch('${url}');\n\n`;
            }
            code += `const data = await response.json();\nconsole.log(data);`;
            return code;
        }
        case "python": {
            let code = `import requests\n\n`;
            if (activeHeaders.length > 0) {
                code += `headers = {\n`;
                activeHeaders.forEach(h => {
                    code += `    '${h.key}': '${h.value}',\n`;
                });
                code += `}\n\n`;
            }
            const args = [`'${url}'`];
            if (activeHeaders.length > 0) args.push(`headers=headers`);
            if (hasBody) args.push(`json=${body}`);
            code += `response = requests.${method.toLowerCase()}(${args.join(', ')})\n`;
            code += `print(response.json())`;
            return code;
        }
        case "go": {
            let code = `package main\n\nimport (\n\t"fmt"\n\t"net/http"\n\t"io"\n`;
            if (hasBody) code += `\t"strings"\n`;
            code += `)\n\nfunc main() {\n`;
            if (hasBody) {
                code += `\tbody := strings.NewReader(\`${body}\`)\n`;
                code += `\treq, _ := http.NewRequest("${method}", "${url}", body)\n`;
            } else {
                code += `\treq, _ := http.NewRequest("${method}", "${url}", nil)\n`;
            }
            activeHeaders.forEach(h => {
                code += `\treq.Header.Set("${h.key}", "${h.value}")\n`;
            });
            code += `\tresp, _ := http.DefaultClient.Do(req)\n`;
            code += `\tdefer resp.Body.Close()\n`;
            code += `\tdata, _ := io.ReadAll(resp.Body)\n`;
            code += `\tfmt.Println(string(data))\n}`;
            return code;
        }
        case "php": {
            let code = `<?php\n\n$ch = curl_init();\n`;
            code += `curl_setopt($ch, CURLOPT_URL, '${url}');\n`;
            code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');\n`;
            code += `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`;
            if (activeHeaders.length > 0) {
                code += `curl_setopt($ch, CURLOPT_HTTPHEADER, [\n`;
                activeHeaders.forEach(h => {
                    code += `    '${h.key}: ${h.value}',\n`;
                });
                code += `]);\n`;
            }
            if (hasBody) {
                code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${body}');\n`;
            }
            code += `\n$response = curl_exec($ch);\ncurl_close($ch);\n\necho $response;\n?>`;
            return code;
        }
    }
}

export function CodeGeneratorDialog() {
    const [open, setOpen] = useState(false);
    const [lang, setLang] = useState<Lang>("curl");
    const [copied, setCopied] = useState(false);
    const currentRequest = useCurrentRequest();

    const code = useMemo(
        () => generateCode(lang, currentRequest.method, currentRequest.url, currentRequest.headers, currentRequest.body),
        [lang, currentRequest.method, currentRequest.url, currentRequest.headers, currentRequest.body]
    );

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!open) {
        return (
            <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setOpen(true)}
                title="Generate code"
            >
                <Code className="h-3 w-3" />
                Code
            </Button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background border border-border rounded-xl shadow-2xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <Code className="h-4 w-4 text-indigo-400" />
                        <h2 className="text-sm font-semibold">Generate Code</h2>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Language selector */}
                <div className="flex items-center gap-1 px-5 pt-4 flex-wrap">
                    {LANGUAGES.map(l => (
                        <button
                            key={l.id}
                            onClick={() => setLang(l.id)}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                lang === l.id
                                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            {l.label}
                        </button>
                    ))}
                </div>

                {/* Code output */}
                <div className="p-5 flex-1 min-h-0">
                    <div className="relative group h-full">
                        <pre className="h-full overflow-auto p-4 rounded-lg bg-muted/30 border border-border/50 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all">
                            {code}
                        </pre>
                        <Button
                            variant="outline"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/70 backdrop-blur-sm"
                            onClick={handleCopy}
                        >
                            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end px-5 py-3 border-t border-border/50">
                    <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
