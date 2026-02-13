"use client";

import React, { useRef, useState } from "react";
import { useAppStore, RequestTab } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const METHOD_DOT_COLORS: Record<string, string> = {
    GET: "bg-emerald-400",
    POST: "bg-amber-400",
    PUT: "bg-blue-400",
    DELETE: "bg-red-400",
    PATCH: "bg-purple-400",
};

export function RequestTabs() {
    const { tabs, activeTabId, setActiveTab, addTab, closeTab } = useAppStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleMiddleClick = (e: React.MouseEvent, id: string) => {
        if (e.button === 1) {
            e.preventDefault();
            closeTab(id);
        }
    };

    return (
        <div className="flex items-center border-b border-border/50 bg-url-bar-bg/50 min-h-[36px]">
            <div
                ref={scrollRef}
                className="flex-1 flex items-center overflow-x-auto scrollbar-none"
            >
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        onMouseDown={(e) => handleMiddleClick(e, tab.id)}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-border/30 min-w-0 max-w-[200px] transition-colors select-none",
                            tab.id === activeTabId
                                ? "bg-background text-foreground border-b-2 border-b-indigo-500"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                    >
                        {/* method dot */}
                        <span className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            METHOD_DOT_COLORS[tab.method] || METHOD_DOT_COLORS.GET
                        )} />
                        {/* label */}
                        <span className="text-[11px] font-medium truncate">
                            {tab.label || "New Request"}
                        </span>
                        {/* dirty indicator */}
                        {tab.isDirty && (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                        )}
                        {/* close button */}
                        {tabs.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                                className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity shrink-0"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            {/* add tab */}
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 mx-1 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => addTab()}
                title="New tab"
            >
                <Plus className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}
