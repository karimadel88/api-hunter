
"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function ExportDialog() {
    const { activeEnvironmentId } = useAppStore();
    const collections = useLiveQuery(() => db.collections.toArray());
    const requests = useLiveQuery(() => db.requests.toArray());

    const [open, setOpen] = useState(false);
    const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    const filteredCollections = collections?.filter(c => (c.environmentId || null) === (activeEnvironmentId || null)) || [];

    const handleOpen = (val: boolean) => {
        setOpen(val);
        if (val) {
            // Select all by default
            setSelectedCollectionIds(filteredCollections.map(c => c.id as number));
        }
    };

    const toggleCollection = (id: number) => {
        setSelectedCollectionIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedCollectionIds.length === filteredCollections.length) {
            setSelectedCollectionIds([]);
        } else {
            setSelectedCollectionIds(filteredCollections.map(c => c.id as number));
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        // UX Delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `api-hunter-export-${timestamp}.json`;

        // 1. Get selected collections
        const exportCollections = filteredCollections.filter(c => selectedCollectionIds.includes(c.id as number));

        // 2. Get requests belonging to selected collections
        const exportRequests = requests?.filter(r => {
            if (r.collectionId) {
                return selectedCollectionIds.includes(r.collectionId);
            }
            return false;
        }) || [];

        const data = {
            version: 1,
            source: "ApiHunter",
            environmentId: activeEnvironmentId,
            collections: exportCollections,
            requests: exportRequests
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        setIsExporting(false);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            <DialogTrigger asChild>
                <button title="Export Collections" className="p-1.5 hover:bg-muted/50 rounded-md transition-colors">
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Export Collections</DialogTitle>
                    <DialogDescription>
                        Select the collections you want to export.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                    <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-border/50">
                        <Checkbox
                            id="select-all"
                            checked={filteredCollections.length > 0 && selectedCollectionIds.length === filteredCollections.length}
                            onCheckedChange={toggleAll}
                        />
                        <label
                            htmlFor="select-all"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Select All
                        </label>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-3">
                        {filteredCollections.map(col => (
                            <div key={col.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`col-${col.id}`}
                                    checked={selectedCollectionIds.includes(col.id as number)}
                                    onCheckedChange={() => toggleCollection(col.id as number)}
                                />
                                <label
                                    htmlFor={`col-${col.id}`}
                                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {col.name}
                                </label>
                            </div>
                        ))}
                        {filteredCollections.length === 0 && (
                            <p className="text-sm text-muted-foreground italic">No collections in this environment.</p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isExporting}>Cancel</Button>
                    <Button onClick={handleExport} disabled={selectedCollectionIds.length === 0 || isExporting}>
                        {isExporting ? "Exporting..." : "Export Selected"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
