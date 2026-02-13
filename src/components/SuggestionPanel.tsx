"use client";

import React, { useEffect, useState } from "react";
import { useAppStore, useCurrentRequest } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lightbulb, AlertTriangle, Wand2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SuggestionPanel() {
    const { setBody, setHeaders } = useAppStore();
    const currentRequest = useCurrentRequest();
    const [suggestions, setSuggestions] = useState<any[]>([]);

    useEffect(() => {
        // Analyze request and generate suggestions
        const newSuggestions = [];

        // Rule 1: JSON Body for POST/PUT without proper header
        if (["POST", "PUT", "PATCH"].includes(currentRequest.method)) {
            const hasContentType = currentRequest.headers.some(h => h.key.toLowerCase() === "content-type");
            if (!hasContentType) {
                newSuggestions.push({
                    id: "missing-json-header",
                    type: "fix",
                    title: "Missing Content-Type Header",
                    description: "You are sending data but missing the Content-Type header.",
                    actionLabel: "Add Header",
                    action: () => {
                        setHeaders([...currentRequest.headers.filter(h => h.key), { key: "Content-Type", value: "application/json" }]);
                    }
                });
            }

            // Rule 2: Empty Body
            if (!currentRequest.body || currentRequest.body.trim() === "") {
                newSuggestions.push({
                    id: "empty-body",
                    type: "suggestion",
                    title: "Generate Mock Body",
                    description: "Would you like to generate a sample JSON body based on the URL?",
                    actionLabel: "Auto-Generate",
                    action: () => {
                        setBody(JSON.stringify({ name: "Sample Item", type: "Test", active: true }, null, 2));
                    }
                });
            }
        }

        // Rule 3: Auth hint
        if (currentRequest.url.includes("api") && !currentRequest.headers.some(h => h.key.toLowerCase() === "authorization")) {
            newSuggestions.push({
                id: "auth-missing",
                type: "info",
                title: "Authentication Recommendation",
                description: "This looks like a protected API endpoint. Consider adding a Bearer token.",
                actionLabel: "Add Auth Header",
                action: () => {
                    setHeaders([...currentRequest.headers.filter(h => h.key), { key: "Authorization", value: "Bearer YOUR_TOKEN" }]);
                }
            });
        }

        setSuggestions(newSuggestions);
    }, [currentRequest, setBody, setHeaders]);

    return (
        <div className="w-64 border-l bg-muted/10 h-screen flex flex-col overflow-y-auto">
            <div className="p-4 border-b">
                <h2 className="font-semibold flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-purple-500" />
                    AI Suggestions
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                    Intelligent tips based on your current request context.
                </p>
            </div>

            <div className="p-4 space-y-4">
                {suggestions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p className="text-xs">No improvements found. Your request looks good!</p>
                    </div>
                ) : (
                    suggestions.map((s) => (
                        <Card key={s.id} className="bg-background/50">
                            <CardHeader className="p-3 pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    {s.type === "fix" ? <AlertTriangle className="h-4 w-4 text-yellow-500" /> : <Lightbulb className="h-4 w-4 text-blue-500" />}
                                    {s.title}
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                    {s.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                                {s.actionLabel && (
                                    <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-2" onClick={s.action}>
                                        {s.actionLabel}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
