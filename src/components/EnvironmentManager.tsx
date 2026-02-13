"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash, Plus, Settings } from "lucide-react";

export function EnvironmentManager() {
    const environments = useLiveQuery(() => db.environments.toArray());
    const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null);
    const [newEnvName, setNewEnvName] = useState("");

    const selectedEnv = environments?.find((e: any) => e.id === selectedEnvId);

    const handleCreateEnv = async () => {
        if (!newEnvName.trim()) return;
        const id = await db.environments.add({
            name: newEnvName,
            variables: []
        });
        setNewEnvName("");
        setSelectedEnvId(id as number);
    };

    const handleDeleteEnv = async (id: number) => {
        await db.environments.delete(id);
        if (selectedEnvId === id) setSelectedEnvId(null);
    };

    const updateVariable = async (index: number, field: "key" | "value" | "enabled", value: any) => {
        if (!selectedEnv || !selectedEnv.id) return;
        const newVars = [...selectedEnv.variables];
        newVars[index] = { ...newVars[index], [field]: value };
        await db.environments.update(selectedEnv.id, { variables: newVars });
    };

    const addVariable = async () => {
        if (!selectedEnv || !selectedEnv.id) return;
        const newVars = [...selectedEnv.variables, { key: "", value: "", enabled: true }];
        await db.environments.update(selectedEnv.id, { variables: newVars });
    };

    const removeVariable = async (index: number) => {
        if (!selectedEnv || !selectedEnv.id) return;
        const newVars = selectedEnv.variables.filter((_, i) => i !== index);
        await db.environments.update(selectedEnv.id, { variables: newVars });
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Manage Environments">
                    <Settings className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Environments</DialogTitle>
                    <DialogDescription>
                        Configure environment variables to reuse across requests.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 gap-4 overflow-hidden mt-4">
                    {/* Sidebar List */}
                    <div className="w-1/4 border-r pr-4 flex flex-col gap-2">
                        <div className="flex gap-2 mb-2">
                            <Input
                                placeholder="New Env Name"
                                value={newEnvName}
                                onChange={e => setNewEnvName(e.target.value)}
                            />
                            <Button size="icon" onClick={handleCreateEnv}><Plus className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1">
                            {environments?.map((env: any) => (
                                <div key={env.id} className={`flex items-center justify-between p-2 rounded cursor-pointer ${selectedEnvId === env.id ? 'bg-secondary' : 'hover:bg-muted'}`} onClick={() => setSelectedEnvId(env.id as number)}>
                                    <span className="truncate text-sm font-medium">{env.name}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleDeleteEnv(env.id as number); }}>
                                        <Trash className="h-3 w-3 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {selectedEnv ? (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold">{selectedEnv.name}</h3>
                                </div>
                                <div className="flex-1 overflow-auto border rounded-md">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="p-2 text-left w-10"></th>
                                                <th className="p-2 text-left">Variable</th>
                                                <th className="p-2 text-left">Value</th>
                                                <th className="p-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedEnv.variables.map((v: any, i: number) => (
                                                <tr key={i} className="border-b">
                                                    <td className="p-2">
                                                        <input type="checkbox" checked={v.enabled} onChange={(e) => updateVariable(i, "enabled", e.target.checked)} />
                                                    </td>
                                                    <td className="p-2">
                                                        <Input className="h-8" value={v.key} onChange={(e) => updateVariable(i, "key", e.target.value)} placeholder="Key" />
                                                    </td>
                                                    <td className="p-2">
                                                        <Input className="h-8" value={v.value} onChange={(e) => updateVariable(i, "value", e.target.value)} placeholder="Value" />
                                                    </td>
                                                    <td className="p-2">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeVariable(i)}>
                                                            <Trash className="h-3 w-3" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-2">
                                    <Button variant="outline" size="sm" onClick={addVariable}>Add Variable</Button>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Select an environment to edit
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
