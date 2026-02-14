"use client";

import React from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface CodeEditorProps {
    value: string;
    onChange?: (value: string) => void;
    language: string;
    readOnly?: boolean;
    className?: string;
    minimap?: boolean;
    lineNumbers?: boolean;
}

export function CodeEditor({
    value,
    onChange,
    language,
    readOnly = false,
    className,
    minimap = false,
    lineNumbers = true
}: CodeEditorProps) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    const handleEditorWillMount = (monaco: any) => {
        monaco.editor.defineTheme('api-hunter-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'c678dd' },
                { token: 'string', foreground: '98c379' },
                { token: 'number', foreground: 'd19a66' },
                { token: 'regexp', foreground: 'e5c07b' },
                { token: 'operator', foreground: '56b6c2' },
                { token: 'namespace', foreground: 'e5c07b' },
                { token: 'type', foreground: 'e5c07b' },
                { token: 'struct', foreground: 'e5c07b' },
                { token: 'class', foreground: 'e5c07b' },
                { token: 'interface', foreground: 'e5c07b' },
                { token: 'function', foreground: '61afef' },
                { token: 'variable', foreground: 'abb2bf' },
                { token: 'variable.predefined', foreground: 'e06c75' },
                { token: 'property', foreground: 'e06c75' },
                { token: 'key', foreground: 'e06c75' }, // JSON keys
                { token: 'identifier', foreground: 'abb2bf' },
                { token: 'delimiter', foreground: 'abb2bf' },
            ],
            colors: {
                'editor.background': '#00000000', // Transparent to match app theme
                'editor.foreground': '#abb2bf',
                'editorLineNumber.foreground': '#5c6370',
                'editorCursor.foreground': '#528bff',
                'editor.selectionBackground': '#3e4451',
                'editor.inactiveSelectionBackground': '#3e4451',
            }
        });
    };

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        // Optional: Custom configurations after mount
    };

    return (
        <div className={cn("relative h-full w-full overflow-hidden rounded-lg border border-border/50 bg-background/50", className)}>
            <Editor
                height="100%"
                defaultLanguage={language}
                language={language}
                value={value}
                onChange={(val) => onChange?.(val || "")}
                theme={isDark ? "api-hunter-dark" : "light"}
                beforeMount={handleEditorWillMount}
                onMount={handleEditorDidMount}
                options={{
                    readOnly,
                    minimap: { enabled: minimap },
                    lineNumbers: lineNumbers ? "on" : "off",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: "on",
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 12,
                    padding: { top: 12, bottom: 12 },
                    renderLineHighlight: "all",
                    folding: true,
                    contextmenu: false, // Cleaner UI
                }}
            />
        </div>
    );
}
