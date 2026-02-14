"use client";

import React, { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import formatXML from "xml-formatter";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileText, Image as ImageIcon } from "lucide-react";
import { CodeEditor } from "@/components/CodeEditor";

interface ResponseFormatterProps {
    data: any;
    contentType?: string;
    status?: number;
}

export function ResponseFormatter({ data, contentType = "", status }: ResponseFormatterProps) {
    const { resolvedTheme } = useTheme();
    const [copied, setCopied] = useState(false);
    const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");

    const isImage = contentType.includes("image/");
    const isPdf = contentType.includes("application/pdf");
    const isBinary = isImage || isPdf;

    const { formattedContent, language } = useMemo(() => {
        if (!data) return { formattedContent: "", language: "text" };

        // If it's an image/binary and we're in preview mode, we don't need formatted text
        if (isBinary && viewMode === "preview") {
            return { formattedContent: "", language: "text" };
        }

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
            // Try parsing string as JSON just in case (for binary it will be base64)
            if (!isBinary) {
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
        }

        return { formattedContent: String(data), language: "text" };
    }, [data, isBinary, viewMode]);

    const handleCopy = () => {
        navigator.clipboard.writeText(formattedContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const renderPreview = () => {
        if (isImage) {
            return (
                <div className="flex items-center justify-center h-full p-4 bg-muted/20">
                    <img
                        src={`data:${contentType};base64,${data}`}
                        alt="Response Body"
                        className="max-w-full max-h-full object-contain shadow-lg rounded border border-border"
                    />
                </div>
            );
        }

        if (isPdf) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground p-8">
                    <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400">
                        <FileText className="h-10 w-10" />
                    </div>
                    <p className="text-sm font-medium">PDF Document Received</p>
                    <Button
                        variant="outline"
                        onClick={() => {
                            const link = document.createElement('a');
                            link.href = `data:${contentType};base64,${data}`;
                            link.download = `document_${Date.now()}.pdf`;
                            link.click();
                        }}
                    >
                        Download PDF
                    </Button>
                    <p className="text-[10px] max-w-[200px] text-center">Previewing large PDFs directly might slow down the UI; download to view locally.</p>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="relative group h-full flex flex-col">
            {/* ─── Toolbar ─── */}
            <div className="absolute top-2 right-4 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isBinary && (
                    <div className="flex bg-background/80 backdrop-blur-sm rounded border border-border/50 shadow-sm p-0.5 mr-1">
                        <Button
                            variant={viewMode === "preview" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1"
                            onClick={() => setViewMode("preview")}
                        >
                            <ImageIcon className="h-3 w-3" /> Preview
                        </Button>
                        <Button
                            variant={viewMode === "raw" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1"
                            onClick={() => setViewMode("raw")}
                        >
                            <FileText className="h-3 w-3" /> Raw
                        </Button>
                    </div>
                )}
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded border border-border/50 shadow-sm">
                    {language}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="h-7 w-7 bg-background/80 backdrop-blur-sm border-border/50 shadow-sm"
                    title="Copy response"
                    disabled={isBinary && viewMode === "preview"}
                >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {isBinary && viewMode === "preview" ? (
                    renderPreview()
                ) : (
                    <CodeEditor
                        value={formattedContent}
                        language={language}
                        readOnly={true}
                        minimap={false}
                        className="border-0 bg-transparent"
                    />
                )}
            </div>
        </div>
    );
}
