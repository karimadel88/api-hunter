"use client";

import React, { useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import formatXML from "xml-formatter";
import { Button } from "./ui/button";
import { Copy, Check, WrapText } from "lucide-react";

interface ResponseFormatterProps {
    data: any;
    contentType?: string;
    status?: number;
}

export function ResponseFormatter({ data, contentType, status }: ResponseFormatterProps) {
    const { resolvedTheme } = useTheme();
    const [copied, setCopied] = useState(false);
    const [wordWrap, setWordWrap] = useState(false);

    const { formattedContent, language } = useMemo(() => {
        if (!data) return { formattedContent: "", language: "text" };

        // Handle JSON
        if (typeof data === "object") {
            return {
                formattedContent: JSON.stringify(data, null, 2),
                language: "json"
            };
        }

        // Handle XML/HTML string
        if (typeof data === "string") {
            const trimmed = data.trim();
            if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
                try {
                    return {
                        formattedContent: formatXML(data, { collapseContent: true }),
                        language: "xml"
                    };
                } catch (e) {
                    return { formattedContent: data, language: "xml" };
                }
            }
            // Try parsing string as JSON just in case
            try {
                const parsed = JSON.parse(data);
                return {
                    formattedContent: JSON.stringify(parsed, null, 2),
                    language: "json"
                };
            } catch (e) {
                // Not JSON
            }
        }

        return { formattedContent: String(data), language: "text" };
    }, [data]);

    const handleCopy = () => {
        navigator.clipboard.writeText(formattedContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isDark = resolvedTheme === "dark";

    return (
        <div className="relative group h-full flex flex-col">
            {/* ─── Toolbar ─── */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-background/70 backdrop-blur-sm px-2 py-1 rounded border border-border/50">
                    {language}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setWordWrap(!wordWrap)}
                    className={`h-7 w-7 bg-background/70 backdrop-blur-sm border-border/50 ${wordWrap ? "text-indigo-400" : ""}`}
                    title="Toggle word wrap"
                >
                    <WrapText className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="h-7 w-7 bg-background/70 backdrop-blur-sm border-border/50"
                    title="Copy response"
                >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
            </div>
            <div className="flex-1 overflow-auto">
                <SyntaxHighlighter
                    language={language}
                    style={isDark ? oneDark : oneLight}
                    customStyle={{
                        margin: 0,
                        minHeight: "100%",
                        fontSize: "12px",
                        lineHeight: "1.6",
                        background: "transparent",
                        padding: "12px 16px",
                    }}
                    showLineNumbers={true}
                    wrapLines={true}
                    wrapLongLines={wordWrap}
                    lineNumberStyle={{
                        minWidth: "2.5em",
                        paddingRight: "1em",
                        color: isDark ? "hsl(215,20%,30%)" : "hsl(215,20%,80%)",
                        fontSize: "11px",
                        userSelect: "none",
                    }}
                >
                    {formattedContent}
                </SyntaxHighlighter>
            </div>
        </div>
    );
}
