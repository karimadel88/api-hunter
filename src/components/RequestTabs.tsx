"use client";

import React, { useRef } from "react";
import { useAppStore, RequestTab } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DndContext, DragEndEvent, closestCenter, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";

const METHOD_DOT_COLORS: Record<string, string> = {
    GET: "bg-emerald-400",
    POST: "bg-amber-400",
    PUT: "bg-blue-400",
    DELETE: "bg-red-400",
    PATCH: "bg-purple-400",
};

interface SortableTabProps {
    tab: RequestTab;
    isActive: boolean;
    onClick: (id: string) => void;
    onClose: (id: string) => void;
    onMiddleClick: (e: React.MouseEvent, id: string) => void;
    canClose: boolean;
    onDuplicate: (id: string) => void;
    onCloseOthers: (id: string) => void;
    onCloseAll: () => void;
}

function SortableTab({ tab, isActive, onClick, onClose, onMiddleClick, canClose, onDuplicate, onCloseOthers, onCloseAll }: SortableTabProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div
                    ref={setNodeRef}
                    style={style}
                    {...attributes}
                    {...listeners}
                    onMouseDown={(e) => onMiddleClick(e, tab.id)}
                    onClick={() => onClick(tab.id)}
                    className={cn(
                        "group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-border/30 min-w-0 max-w-[200px] transition-colors select-none touch-none h-full",
                        isActive
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
                    {canClose && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                            className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity shrink-0"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onSelect={() => onDuplicate(tab.id)}>Duplicate Tab</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => onClose(tab.id)} disabled={!canClose}>Close Tab</ContextMenuItem>
                <ContextMenuItem onSelect={() => onCloseOthers(tab.id)} disabled={!canClose}>Close Other Tabs</ContextMenuItem>
                <ContextMenuItem onSelect={onCloseAll}>Close All Tabs</ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

export function RequestTabs() {
    const { tabs, activeTabId, setActiveTab, addTab, closeTab, reorderTabs, duplicateTab, closeOtherTabs, closeAllTabs } = useAppStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = tabs.findIndex((t) => t.id === active.id);
        const newIndex = tabs.findIndex((t) => t.id === over.id);
        reorderTabs(oldIndex, newIndex);
    };

    const handleMiddleClick = (e: React.MouseEvent, id: string) => {
        if (e.button === 1) {
            e.preventDefault();
            closeTab(id);
        }
    };

    return (
        <div className="flex items-center min-h-[36px] w-full border-b border-border/30 bg-muted/10">
            <div
                ref={scrollRef}
                className="flex-1 flex items-center overflow-x-auto scrollbar-none h-[36px]"
            >
                <DndContext id="tabs-dnd-context" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                        <div className="flex h-full">
                            {tabs.map((tab) => (
                                <SortableTab
                                    key={tab.id}
                                    tab={tab}
                                    isActive={tab.id === activeTabId}
                                    onClick={setActiveTab}
                                    onClose={closeTab}
                                    onMiddleClick={handleMiddleClick}
                                    canClose={tabs.length > 1}
                                    onDuplicate={duplicateTab}
                                    onCloseOthers={closeOtherTabs}
                                    onCloseAll={closeAllTabs}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
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
