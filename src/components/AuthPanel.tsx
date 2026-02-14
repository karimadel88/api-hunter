"use client";

import React from "react";
import { useAppStore, useCurrentRequest, AuthConfig } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function AuthPanel() {
    const { updateTab, activeTabId } = useAppStore();
    const { auth } = useCurrentRequest();

    const handleTypeChange = (type: AuthConfig['type']) => {
        const newAuth: AuthConfig = { type };
        if (type === 'basic') newAuth.basic = { username: '', password: '' };
        if (type === 'bearer') newAuth.bearer = { token: '' };
        if (type === 'apikey') newAuth.apikey = { key: '', value: '', addTo: 'header' };
        updateTab(activeTabId, { auth: newAuth });
    };

    const updateAuth = (updates: Partial<AuthConfig>) => {
        updateTab(activeTabId, { auth: { ...auth, ...updates } });
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Authentication Type</Label>
                <Select value={auth.type} onValueChange={(v) => handleTypeChange(v as any)}>
                    <SelectTrigger className="w-[200px] h-10 bg-background/50 border-border/50 focus:ring-0 focus:ring-offset-0 outline-none">
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">No Auth</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                        <SelectItem value="bearer">Bearer Token</SelectItem>
                        <SelectItem value="apikey">API Key</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">The authentication settings will be applied when the request is sent.</p>
            </div>

            <div className="p-5 border border-border/50 rounded-xl bg-muted/10 relative overflow-hidden">
                {auth.type === 'none' && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-sm font-medium text-muted-foreground/80">No Authentication</p>
                        <p className="text-[11px] mt-1 text-muted-foreground/50">This request will be sent without any authorization headers or tokens.</p>
                    </div>
                )}

                {auth.type === 'basic' && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-medium ml-1">Username</Label>
                                <Input
                                    className="h-9 text-xs font-mono bg-background border-border/40 focus:border-indigo-500/50"
                                    placeholder="Username"
                                    value={auth.basic?.username || ''}
                                    onChange={(e) => updateAuth({ basic: { ...auth.basic!, username: e.target.value } })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-medium ml-1">Password</Label>
                                <Input
                                    type="password"
                                    className="h-9 text-xs font-mono bg-background border-border/40 focus:border-indigo-500/50"
                                    placeholder="Password"
                                    value={auth.basic?.password || ''}
                                    onChange={(e) => updateAuth({ basic: { ...auth.basic!, password: e.target.value } })}
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic bg-background/50 p-2 rounded border border-border/30">
                            Basic Auth encodes credentials to a Base64 string and sends them in the `Authorization` header.
                        </p>
                    </div>
                )}

                {auth.type === 'bearer' && (
                    <div className="space-y-3">
                        <Label className="text-[11px] font-medium ml-1">Token</Label>
                        <div className="relative">
                            <Input
                                className="h-10 text-xs font-mono bg-background border-border/40 focus:border-indigo-500/50 pr-10"
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                value={auth.bearer?.token || ''}
                                onChange={(e) => updateAuth({ bearer: { token: e.target.value } })}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground bg-background/50 p-2 rounded border border-border/30">
                            The token will be added as `Authorization: Bearer &lt;token&gt;`.
                        </p>
                    </div>
                )}

                {auth.type === 'apikey' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-medium ml-1">Key Name</Label>
                                <Input
                                    className="h-9 text-xs font-mono bg-background border-border/40 focus:border-indigo-500/50"
                                    placeholder="X-API-Key"
                                    value={auth.apikey?.key || ''}
                                    onChange={(e) => updateAuth({ apikey: { ...auth.apikey!, key: e.target.value } })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-medium ml-1">Value</Label>
                                <Input
                                    className="h-9 text-xs font-mono bg-background border-border/40 focus:border-indigo-500/50"
                                    placeholder="your-secret-key"
                                    value={auth.apikey?.value || ''}
                                    onChange={(e) => updateAuth({ apikey: { ...auth.apikey!, value: e.target.value } })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2 pt-1">
                            <Label className="text-[11px] font-medium ml-1">Add Authentication to</Label>
                            <RadioGroup
                                value={auth.apikey?.addTo || 'header'}
                                onValueChange={(v) => updateAuth({ apikey: { ...auth.apikey!, addTo: v as any } })}
                                className="flex gap-6 bg-background/30 p-3 rounded border border-border/20 w-fit"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="header" id="header" className="border-indigo-500 text-indigo-500" />
                                    <Label htmlFor="header" className="text-xs cursor-pointer">HTTP Header</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="query" id="query" className="border-indigo-500 text-indigo-500" />
                                    <Label htmlFor="query" className="text-xs cursor-pointer">Query Params</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
