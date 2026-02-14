"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Collection } from "../lib/db";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useAppStore, useCurrentRequest } from "../lib/store";
import { Save } from "lucide-react";

interface SaveRequestDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function SaveRequestDialog({ open: externalOpen, onOpenChange: externalOnOpenChange }: SaveRequestDialogProps) {
    const currentRequest = useCurrentRequest();
    const collections = useLiveQuery(() => db.collections.toArray());

    const [internalOpen, setInternalOpen] = useState(false);
    const open = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = externalOnOpenChange !== undefined ? externalOnOpenChange : setInternalOpen;

    const [name, setName] = useState("");
    const [collectionId, setCollectionId] = useState<string>("none"); // "none" or number as string
    const [newCollectionName, setNewCollectionName] = useState("");
    const [isCreatingCollection, setIsCreatingCollection] = useState(false);

    // Initialize name when dialog opens
    React.useEffect(() => {
        if (open) {
            setName(currentRequest.label || "");
        }
    }, [open, currentRequest.label]);

    const handleSave = async () => {
        const { activeEnvironmentId, updateTab, activeTabId } = useAppStore.getState();
        try {
            let targetCollectionId: number | undefined = undefined;

            if (isCreatingCollection && newCollectionName.trim()) {
                const id = await db.collections.add({
                    name: newCollectionName,
                    environmentId: activeEnvironmentId || undefined,
                    createdAt: Date.now()
                });
                targetCollectionId = id as number;
            } else if (collectionId !== "none") {
                targetCollectionId = parseInt(collectionId);
            }

            // Check if the current request is already saved (has an ID that corresponds to a DB item)
            const isSaved = !isNaN(Number(activeTabId));

            const requestData = {
                name: name || "Untitled Request",
                collectionId: targetCollectionId,
                method: currentRequest.method,
                url: currentRequest.url,
                params: currentRequest.params.reduce((acc, p) => (p.key ? { ...acc, [p.key]: p.value } : acc), {}),
                headers: currentRequest.headers.reduce((acc, h) => (h.key ? { ...acc, [h.key]: h.value } : acc), {}),
                body: currentRequest.body,
                bodyType: currentRequest.bodyType,
                bodyRawLanguage: currentRequest.bodyRawLanguage,
                bodyFormData: currentRequest.bodyFormData,
                bodyFormUrlEncoded: currentRequest.bodyFormUrlEncoded,
                auth: currentRequest.auth,
                environmentId: activeEnvironmentId || undefined,
            };

            if (isSaved) {
                await db.requests.update(Number(activeTabId), requestData);
                updateTab(activeTabId, {
                    label: name || "Untitled Request",
                    isDirty: false,
                });
            } else {
                // If it's a new request, add it to the database
                const newRequestId = await db.requests.add({
                    ...requestData,
                    createdAt: Date.now()
                });

                // Update the current tab to reflect the saved request's ID and label
                updateTab(activeTabId, {
                    label: name || "Untitled Request",
                    isDirty: false,
                    id: newRequestId.toString()
                });
            }

            setOpen(false);
            setName("");
            setNewCollectionName("");
            setIsCreatingCollection(false);
        } catch (error) {
            console.error("Failed to save request:", error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {!externalOpen && (
                    <Button variant="secondary">
                        <Save className="mr-2 h-4 w-4" />
                        Save
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Save Request</DialogTitle>
                    <DialogDescription>
                        Save this request to a collection for future use.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Request"
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="collection" className="text-right">
                            Collection
                        </Label>
                        <div className="col-span-3">
                            {!isCreatingCollection ? (
                                <div className="flex gap-2">
                                    <Select value={collectionId} onValueChange={setCollectionId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a collection" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Collection (Root)</SelectItem>
                                            {collections?.map((col: any) => (
                                                <SelectItem key={col.id} value={col.id?.toString() || ""}>
                                                    {col.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" onClick={() => setIsCreatingCollection(true)} title="New Collection">
                                        <span className="text-lg">+</span>
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="New Collection Name"
                                        value={newCollectionName}
                                        onChange={(e) => setNewCollectionName(e.target.value)}
                                    />
                                    <Button variant="ghost" size="sm" onClick={() => setIsCreatingCollection(false)}>Cancel</Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
