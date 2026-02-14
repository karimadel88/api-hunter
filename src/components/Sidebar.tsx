"use client";

import React, { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Collection } from "../lib/db";
import { Button } from "./ui/button";
import { Plus, History, Folder, ChevronRight, ChevronDown, Zap, Search, Trash2, Clock, X, Check, Pencil, FilePlus, Download, Upload } from "lucide-react";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { useAppStore } from "../lib/store";
import { EnvironmentManager } from "./EnvironmentManager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ModeToggle } from "./mode-toggle";
import { DndContext, useDraggable, useDroppable, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { ExportDialog } from "./ExportDialog";
import { parseImportData } from "../lib/importUtils";

// --- Helper Functions ---
function getMethodClass(method: string) {
    switch (method) {
        case "GET": return "method-badge-get";
        case "POST": return "method-badge-post";
        case "PUT": return "method-badge-put";
        case "DELETE": return "method-badge-delete";
        case "PATCH": return "method-badge-patch";
        default: return "method-badge-get";
    }
}

function getStatusColor(status: number) {
    if (status >= 200 && status < 300) return "text-emerald-400";
    if (status >= 300 && status < 400) return "text-blue-400";
    if (status >= 400 && status < 500) return "text-amber-400";
    return "text-red-400";
}

function formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

// --- Sub-Components ---

function DraggableRequestItem({ request, onClick, onDelete }: { request: any, onClick: () => void, onDelete: (id: number) => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `req-${request.id}`,
        data: { type: 'request', request }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.8 : 1,
    } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="group/req relative flex items-center touch-none pl-4">
            <button
                onClick={onClick}
                className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-accent/50 transition-colors text-left min-w-0"
            >
                <span className={cn("method-badge shrink-0", getMethodClass(request.method))}>{request.method}</span>
                <span className="truncate text-muted-foreground flex-1">{request.name}</span>
            </button>
            <button
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover/req:opacity-100 hover:bg-red-500/10 hover:text-red-400 rounded transition-all"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete(request.id); }}
            >
                <Trash2 className="h-3 w-3" />
            </button>
        </div>
    );
}

interface CollectionNode extends Collection {
    children: CollectionNode[];
    requests: any[];
}

function CollectionItem({
    node,
    editingId, startEditing,
    editingName, setEditingName, onUpdate, onCancelEdit,
    onDelete, onLoadRequest, onDeleteRequest, onQuickAdd
}: any) {
    const [expanded, setExpanded] = useState(true);
    const { isOver, setNodeRef } = useDroppable({
        id: `col-${node.id}`,
        data: { type: 'collection', collection: node }
    });

    return (
        <div ref={setNodeRef} className={cn("group/col rounded-md transition-colors", isOver && "bg-indigo-500/10 ring-1 ring-indigo-500/30")}>
            {editingId === node.id ? (
                <div className="px-2 py-1 mb-1 flex items-center gap-1">
                    <Input
                        autoFocus
                        className="h-7 text-xs px-2"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter") onUpdate(node.id);
                            if (e.key === "Escape") onCancelEdit();
                        }}
                    />
                    <Button size="icon" className="h-7 w-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => onUpdate(node.id)}>
                        <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={onCancelEdit}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                <div className="flex items-center group/item hover:bg-accent/30 rounded-md">
                    <button
                        className="p-1 hover:bg-accent/50 rounded mr-1"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 flex items-center gap-2 py-1.5 text-sm transition-colors text-left min-w-0 cursor-default">
                        <Folder className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate text-xs font-medium">{node.name}</span>
                        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <div
                                role="button"
                                title="Quick Add Request"
                                className="p-1 hover:bg-emerald-500/10 hover:text-emerald-400 rounded cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); onQuickAdd(node.id); }}
                            >
                                <Plus className="h-3 w-3" />
                            </div>
                            <div
                                role="button"
                                className="p-1 hover:bg-indigo-500/10 hover:text-indigo-400 rounded cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); startEditing(node); }}
                            >
                                <Pencil className="h-3 w-3" />
                            </div>
                            <div
                                role="button"
                                className="p-1 hover:bg-red-500/10 hover:text-red-400 rounded cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                            >
                                <Trash2 className="h-3 w-3" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {expanded && (
                <div className="ml-2 pl-2 border-l border-border/30 space-y-0.5 mt-0.5 mb-1">
                    {/* Sub-Collections */}
                    {node.children.map((child: any) => (
                        <CollectionItem
                            key={child.id}
                            node={child}
                            editingId={editingId}
                            startEditing={startEditing}
                            editingName={editingName}
                            setEditingName={setEditingName}
                            onUpdate={onUpdate}
                            onCancelEdit={onCancelEdit}
                            onDelete={onDelete}
                            onLoadRequest={onLoadRequest}
                            onDeleteRequest={onDeleteRequest}
                            onQuickAdd={onQuickAdd}
                        />
                    ))}

                    {/* Requests */}
                    {node.requests?.map((req: any) => (
                        <DraggableRequestItem
                            key={req.id}
                            request={req}
                            onClick={() => onLoadRequest(req)}
                            onDelete={onDeleteRequest}
                        />
                    ))}

                    {node.children.length === 0 && node.requests.length === 0 && (
                        <div className="px-2 py-1 text-[10px] text-muted-foreground/40 italic">Empty</div>
                    )}
                </div>
            )}
        </div>
    );
}

// --- Main Sidebar Component ---

export function Sidebar() {
    const collections = useLiveQuery(() => db.collections.toArray());
    const requests = useLiveQuery(() => db.requests.toArray());
    const history = useLiveQuery(() => db.history.reverse().limit(30).toArray());
    const environments = useLiveQuery(() => db.environments.toArray());

    const { addTab, activeEnvironmentId, setActiveEnvironmentId, closeTab, tabs } = useAppStore();
    const [historySearch, setHistorySearch] = useState("");

    // Collection Management State
    const [isCreatingCollection, setIsCreatingCollection] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState("");
    const [editingCollectionId, setEditingCollectionId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        })
    );

    // --- Data Processing (Tree Build) ---

    const treeData = useMemo(() => {
        if (!collections || !requests) return { roots: [], uncategorized: [] };

        const relevantColls = collections.filter(c => (c.environmentId || null) === (activeEnvironmentId || null));
        const relevantReqs = requests.filter(r => {
            if (r.collectionId) return true; // We'll filter by collection existence later
            return (r.environmentId || null) === (activeEnvironmentId || null);
        });

        // Map Collections
        const colMap = new Map<number, CollectionNode>();
        relevantColls.forEach(c => {
            colMap.set(c.id as number, { ...c, children: [], requests: [] });
        });

        const roots: CollectionNode[] = [];

        // Build Tree
        relevantColls.forEach(c => {
            const node = colMap.get(c.id as number)!;
            if (c.parentId && colMap.has(c.parentId)) {
                colMap.get(c.parentId)!.children.push(node);
            } else {
                roots.push(node);
            }
        });

        // Distribute Requests
        const uncategorized: any[] = [];
        relevantReqs.forEach(r => {
            if (r.collectionId && colMap.has(r.collectionId)) {
                colMap.get(r.collectionId)!.requests.push(r);
            } else if (!r.collectionId) {
                uncategorized.push(r);
            }
        });

        return { roots, uncategorized };
    }, [collections, requests, activeEnvironmentId]);

    // --- Handlers ---

    const handleCreateCollection = async () => {
        if (!newCollectionName.trim()) return;
        await db.collections.add({
            name: newCollectionName.trim(),
            environmentId: activeEnvironmentId || undefined,
            createdAt: Date.now()
        });
        setNewCollectionName("");
        setIsCreatingCollection(false);
    };

    const startEditingCollection = (col: any) => {
        setEditingCollectionId(col.id);
        setEditingName(col.name);
    };

    const handleUpdateCollection = async (id: number) => {
        if (!editingName.trim()) return;
        await db.collections.update(id, { name: editingName.trim() });
        setEditingCollectionId(null);
    };

    const deleteCollection = async (id: number) => {
        if (confirm("Are you sure you want to delete this collection and all its contents?")) {
            // Recursive delete of sub-collections not handled here for brevity, 
            // but we should delete children. For now, just requests.
            // TODO: Recursive delete.
            const idsToDelete = [id];
            // Simple approach: Delete requests in this collection
            await db.requests.where('collectionId').equals(id).delete();
            await db.collections.delete(id);
        }
    };

    const deleteRequest = async (id: number) => {
        if (confirm("Delete this request?")) {
            await db.requests.delete(id);
        }
    };

    const handleQuickAddRequest = async (collectionId: number) => {
        const id = await db.requests.add({
            name: "New Request",
            method: "GET",
            url: "",
            collectionId,
            environmentId: activeEnvironmentId || undefined,
            createdAt: Date.now(),
            params: {}, headers: {}, body: ""
        });
        const req = await db.requests.get(id as number);
        if (req) loadRequest(req);
    };

    const loadRequest = (req: any) => {
        const paramsArr = Object.entries(req.params || {}).map(([key, value]) => ({ key, value: value as string }));
        if (paramsArr.length === 0) paramsArr.push({ key: "", value: "" });
        const headersArr = Object.entries(req.headers || {}).map(([key, value]) => ({ key, value: value as string }));
        if (headersArr.length === 0) headersArr.push({ key: "", value: "" });

        addTab({
            method: req.method,
            url: req.url,
            params: paramsArr,
            headers: headersArr,
            body: req.body || "",
            bodyType: req.bodyType || 'json',
            bodyRawLanguage: req.bodyRawLanguage || 'json',
            bodyFormData: req.bodyFormData,
            bodyFormUrlEncoded: req.bodyFormUrlEncoded,
            label: req.name || req.url || "New Request",
            id: req.id?.toString()
        });
    };

    const loadHistoryItem = (item: any) => {
        addTab({
            method: item.method,
            url: item.url,
            label: item.url?.slice(0, 30) || "History",
        });
    };

    const clearHistory = async () => {
        await db.history.clear();
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeIdStr = active.id as string;
        const overIdStr = over.id as string;

        if (activeIdStr.startsWith("req-") && overIdStr.startsWith("col-")) {
            const reqId = parseInt(activeIdStr.replace("req-", ""));
            const colId = parseInt(overIdStr.replace("col-", ""));
            await db.requests.update(reqId, { collectionId: colId });
        }
    };

    // --- Import / Export ---
    const [isLoading, setIsLoading] = useState(false);

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const text = ev.target?.result as string;
                // Artificial delay to show loader (optional, but good for UX if fast)
                await new Promise(resolve => setTimeout(resolve, 500));

                const data = JSON.parse(text);

                const { collections: newCollections, requests: newRequests } = parseImportData(data);

                if (newCollections.length === 0 && newRequests.length === 0) {
                    alert("No valid collections or requests found in the file.");
                } else {
                    const idMap = new Map<string | number, number>();

                    // 1. Import Collections (Sorted by dependency?)
                    // The list from importUtils is topologically sorted (parents first) by nature of recursion.
                    for (const col of newCollections) {
                        const { id: oldId, _tempParentId, ...rest } = col as any;

                        let parentId = undefined;
                        if (_tempParentId && idMap.has(_tempParentId)) {
                            parentId = idMap.get(_tempParentId);
                        }

                        const newColId = await db.collections.add({
                            ...rest,
                            parentId,
                            environmentId: activeEnvironmentId || undefined,
                            createdAt: Date.now()
                        });
                        if (oldId) idMap.set(oldId, newColId as number);
                    }

                    // 2. Import Requests
                    for (const req of newRequests) {
                        const { _tempCollectionId, ...rest } = req as any;
                        let collectionId = undefined;

                        // Try to map collection ID
                        if (_tempCollectionId && idMap.has(_tempCollectionId)) {
                            collectionId = idMap.get(_tempCollectionId);
                        } else if (req.collectionId && idMap.has(req.collectionId)) {
                            collectionId = idMap.get(req.collectionId);
                        }

                        await db.requests.add({
                            ...rest,
                            collectionId,
                            environmentId: activeEnvironmentId || undefined,
                            createdAt: Date.now()
                        });
                    }
                    alert(`Import successful! Added ${newCollections.length} collections and ${newRequests.length} requests.`);
                }
            } catch (err) {
                console.error(err);
                alert("Failed to import file: " + (err as Error).message);
            } finally {
                setIsLoading(false);
                e.target.value = "";
            }
        };
        reader.readAsText(file);
    };

    const filteredHistory = history?.filter(item => {
        if ((activeEnvironmentId && item.environmentId !== activeEnvironmentId) || (!activeEnvironmentId && item.environmentId)) return false;
        if (!historySearch) return true;
        const s = historySearch.toLowerCase();
        return item.url?.toLowerCase().includes(s) || item.method?.toLowerCase().includes(s);
    });

    return (
        <div className="w-full bg-sidebar-bg h-screen flex flex-col border-r border-border/50 relative">
            {isLoading && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center flex-col gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                    <p className="text-sm text-muted-foreground font-medium">Processing...</p>
                </div>
            )}

            {/* Header */}
            <div className="p-4 border-b border-border/50">
                <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2">
                        {/* Logo */}
                        <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center shadow-md relative">
                            <img src="/logo.png" alt="Logo" className="object-cover h-full w-full" />
                        </div>
                        <div>
                            <h1 className="font-bold text-sm tracking-tight">Api Hunter</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <label title="Import Collections" className="cursor-pointer p-1.5 hover:bg-muted/50 rounded-md transition-colors">
                            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                        </label>
                        <ExportDialog />
                    </div>
                </div>

                <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-0.5">
                        <ModeToggle />
                        <EnvironmentManager />
                    </div>
                    <Select value={activeEnvironmentId?.toString() || "none"} onValueChange={(val) => setActiveEnvironmentId(val === "none" ? null : parseInt(val))}>
                        <SelectTrigger className="h-7 text-[10px] bg-background/50 border-border/50 w-32">
                            <SelectValue placeholder="No Environment" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No Environment</SelectItem>
                            {environments?.map((env: any) => (
                                <SelectItem key={env.id} value={env.id?.toString() || ""}>{env.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <div className="p-3">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Collections</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 rounded hover:bg-indigo-500/10 hover:text-indigo-400"
                                onClick={() => setIsCreatingCollection(true)}
                                title="New Collection"
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        <div className="space-y-0.5">
                            {isCreatingCollection && (
                                <div className="px-2 py-1 mb-1">
                                    <div className="flex items-center gap-1">
                                        <Input
                                            autoFocus
                                            className="h-7 text-xs px-2"
                                            placeholder="Name"
                                            value={newCollectionName}
                                            onChange={e => setNewCollectionName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") handleCreateCollection();
                                                if (e.key === "Escape") setIsCreatingCollection(false);
                                            }}
                                        />
                                        <Button size="icon" className="h-7 w-7 bg-indigo-600 hover:bg-indigo-700" onClick={handleCreateCollection}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setIsCreatingCollection(false)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* ROOTS */}
                            {treeData.roots.map((node) => (
                                <CollectionItem
                                    key={node.id}
                                    node={node}
                                    editingId={editingCollectionId}
                                    startEditing={startEditingCollection}
                                    editingName={editingName}
                                    setEditingName={setEditingName}
                                    onUpdate={handleUpdateCollection}
                                    onCancelEdit={() => setEditingCollectionId(null)}
                                    onDelete={deleteCollection}
                                    onLoadRequest={loadRequest}
                                    onDeleteRequest={deleteRequest}
                                    onQuickAdd={handleQuickAddRequest}
                                />
                            ))}

                            {/* Uncategorized */}
                            {treeData.uncategorized.length > 0 && (
                                <div className="mt-2 px-2 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Uncategorized</div>
                            )}

                            {treeData.uncategorized.map((req) => (
                                <DraggableRequestItem
                                    key={req.id}
                                    request={req}
                                    onClick={() => loadRequest(req)}
                                    onDelete={deleteRequest}
                                />
                            ))}

                            {treeData.roots.length === 0 && treeData.uncategorized.length === 0 && (
                                <p className="text-xs text-muted-foreground/60 px-2 py-4 text-center italic">No items in this environment.</p>
                            )}
                        </div>
                    </div>
                </DndContext>

                {/* History */}
                <div className="p-3 border-t border-border/30">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                            <History className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">History</span>
                            {filteredHistory?.length ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-medium">{filteredHistory.length}</span>
                            ) : null}
                        </div>
                        {history && history.length > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 rounded text-muted-foreground hover:text-destructive"
                                onClick={clearHistory}
                                title="Clear history"
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>

                    {history && history.length > 5 && (
                        <div className="relative mb-2">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                                className="h-7 text-[11px] pl-7 bg-background/50 border-border/30"
                                placeholder="Search history..."
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="space-y-0.5">
                        {filteredHistory?.map((item: any) => (
                            <button
                                key={item.id}
                                onClick={() => loadHistoryItem(item)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent/50 transition-colors text-left group"
                            >
                                <span className={cn("method-badge shrink-0", getMethodClass(item.method))}>{item.method}</span>
                                <span className="truncate text-muted-foreground flex-1 min-w-0">{item.url}</span>
                                <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.status && (
                                        <span className={cn("text-[10px] font-mono font-medium", getStatusColor(item.status))}>
                                            {item.status}
                                        </span>
                                    )}
                                    {item.duration && (
                                        <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                                            <Clock className="h-2.5 w-2.5" />
                                            {formatDuration(item.duration)}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
