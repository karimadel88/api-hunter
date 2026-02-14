"use client";

import React, { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import formatXML from "xml-formatter";
import { Button } from "@/components/ui/button";
import { Copy, Check, WrapText } from "lucide-react";
import { CodeEditor } from "@/components/CodeEditor";

interface ResponseFormatterProps {
    data: any;
    contentType?: string;
    status?: number;
}

export function ResponseFormatter({ data, contentType, status }: ResponseFormatterProps) {
    const { resolvedTheme } = useTheme();
    const [copied, setCopied] = useState(false);

    // We can rely on Monaco's built-in word wrap, but we might want to toggle it.
    // However, Monaco's word wrap is an option passed to the editor. 
    // We'll simplisticly toggle a state that we pass to CodeEditor if we want to support that, 
    // but the previous implementation had a toggle button. let's keep it.
    // Update: CodeEditor doesn't currently accept wordWrap prop, but it defaults to 'on'.
    // Let's assume word wrap is always on for response to ensure readability, or we can update CodeEditor later.
    // For now, let's keep the toolbar but maybe remove the wrap toggle if Monaco handles it well automatically.
    // Actually, let's keep it simple and just rely on Monaco's default 'on'.

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

    return (
        <div className="relative group h-full flex flex-col">
            {/* ─── Toolbar ─── */}
            <div className="absolute top-2 right-4 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded border border-border/50 shadow-sm">
                    {language}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="h-7 w-7 bg-background/80 backdrop-blur-sm border-border/50 shadow-sm"
                    title="Copy response"
                >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <CodeEditor
                    value={formattedContent}
                    language={language}
                    readOnly={true}
                    minimap={false}
                    className="border-0 bg-transparent"
                />
            </div>
        </div>
    );
}
