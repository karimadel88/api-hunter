"use client";

import React, { useState, useCallback, useRef } from "react";
import {
    TestScenario, TestStep, TestAssertion, TestRunResult, TestIterationResult, db
} from "@/lib/db";
import { runScenario } from "@/lib/scenarioRunner";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    Plus, Trash2, Play, ChevronDown, ChevronRight,
    GripVertical, CheckCircle2, XCircle, AlertTriangle,
    Upload, FileJson, FileSpreadsheet, X, Copy,
    Loader2, SkipForward, Save, FlaskConical
} from "lucide-react";
import { DndContext, DragEndEvent, closestCenter, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ═══════════════ Assertion Builder ═══════════════

const FIELDS = [
    { value: 'status', label: 'Status Code' },
    { value: 'responseTime', label: 'Response Time (ms)' },
    { value: 'body', label: 'Response Body' },
    { value: 'header', label: 'Response Header' },
    { value: 'jsonPath', label: 'JSON Path' },
] as const;

const OPERATORS = [
    { value: 'equals', label: '=' },
    { value: 'notEquals', label: '≠' },
    { value: 'contains', label: 'contains' },
    { value: 'notContains', label: '!contains' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'exists', label: 'exists' },
    { value: 'type', label: 'typeof' },
] as const;

function AssertionRow({ assertion, onChange, onRemove }: {
    assertion: TestAssertion;
    onChange: (a: TestAssertion) => void;
    onRemove: () => void;
}) {
    const needsKey = assertion.field === 'header' || assertion.field === 'jsonPath';
    const needsExpected = assertion.operator !== 'exists';

    return (
        <div className="flex items-center gap-1.5 text-xs group">
            <select
                value={assertion.field}
                onChange={e => onChange({ ...assertion, field: e.target.value as any })}
                className="h-7 rounded border bg-background px-2 text-xs outline-none"
            >
                {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            {needsKey && (
                <Input
                    className="h-7 w-28 text-xs font-mono"
                    placeholder={assertion.field === 'header' ? 'header-name' : 'data.id'}
                    value={assertion.key || ''}
                    onChange={e => onChange({ ...assertion, key: e.target.value })}
                />
            )}
            <select
                value={assertion.operator}
                onChange={e => onChange({ ...assertion, operator: e.target.value as any })}
                className="h-7 rounded border bg-background px-2 text-xs outline-none"
            >
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {needsExpected && (
                <Input
                    className="h-7 flex-1 text-xs font-mono"
                    placeholder="expected value"
                    value={assertion.expected}
                    onChange={e => onChange({ ...assertion, expected: e.target.value })}
                />
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={onRemove}>
                <X className="h-3 w-3" />
            </Button>
        </div>
    );
}

// ═══════════════ Step Builder ═══════════════

const METHOD_COLORS: Record<string, string> = {
    GET: "text-emerald-400",
    POST: "text-amber-400",
    PUT: "text-blue-400",
    DELETE: "text-red-400",
    PATCH: "text-purple-400",
};

function StepCard({ step, index, onChange, onRemove, dragHandleProps }: {
    step: TestStep;
    index: number;
    onChange: (s: TestStep) => void;
    onRemove: () => void;
    dragHandleProps?: any;
}) {
    const [open, setOpen] = useState(true);

    const addAssertion = () => {
        onChange({
            ...step,
            assertions: [...step.assertions, { field: 'status', operator: 'equals', expected: '200' }]
        });
    };

    const updateAssertion = (i: number, a: TestAssertion) => {
        const updated = [...step.assertions];
        updated[i] = a;
        onChange({ ...step, assertions: updated });
    };

    const removeAssertion = (i: number) => {
        onChange({ ...step, assertions: step.assertions.filter((_, idx) => idx !== i) });
    };

    const addExtract = () => {
        onChange({
            ...step,
            extractVariables: [...(step.extractVariables || []), { name: '', source: 'body', path: '' }]
        });
    };

    return (
        <div className="border border-border/50 rounded-lg bg-background/50 overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center gap-2 px-3 py-2 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <div {...dragHandleProps} onClick={e => e.stopPropagation()} className="cursor-grab hover:text-foreground touch-none">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{index + 1}</span>
                {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className={cn("text-xs font-bold", METHOD_COLORS[step.method] || "text-foreground")}>{step.method}</span>
                <span className="text-xs text-muted-foreground font-mono truncate flex-1">{step.url || 'Untitled Step'}</span>
                <span className="text-[10px] text-muted-foreground">
                    {step.assertions.length} assertion{step.assertions.length !== 1 ? 's' : ''}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>

            {/* Body */}
            {open && (
                <div className="p-3 space-y-3">
                    {/* Name + Method + URL */}
                    <div className="flex gap-2">
                        <Input
                            className="h-8 w-40 text-xs"
                            placeholder="Step name"
                            value={step.name}
                            onChange={e => onChange({ ...step, name: e.target.value })}
                        />
                        <select
                            value={step.method}
                            onChange={e => onChange({ ...step, method: e.target.value })}
                            className={cn("h-8 rounded border px-2 text-xs font-bold outline-none", METHOD_COLORS[step.method])}
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                        </select>
                        <Input
                            className="h-8 flex-1 text-xs font-mono"
                            placeholder="https://api.example.com/v1/{{resource}}"
                            value={step.url}
                            onChange={e => onChange({ ...step, url: e.target.value })}
                        />
                    </div>

                    {/* Headers */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Headers</span>
                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2"
                                onClick={() => {
                                    const newHeaders = { ...step.headers, '': '' };
                                    onChange({ ...step, headers: newHeaders });
                                }}>
                                <Plus className="h-2.5 w-2.5 mr-0.5" /> Add
                            </Button>
                        </div>
                        {Object.entries(step.headers).map(([k, v], i) => (
                            <div key={i} className="flex gap-1.5 mb-1 items-center group">
                                <Input className="h-7 flex-1 text-xs font-mono" placeholder="Header" value={k}
                                    onChange={e => {
                                        const entries = Object.entries(step.headers);
                                        entries[i] = [e.target.value, v];
                                        onChange({ ...step, headers: Object.fromEntries(entries) });
                                    }} />
                                <Input className="h-7 flex-1 text-xs font-mono" placeholder="Value" value={v}
                                    onChange={e => {
                                        const entries = Object.entries(step.headers);
                                        entries[i] = [k, e.target.value];
                                        onChange({ ...step, headers: Object.fromEntries(entries) });
                                    }} />
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                    onClick={() => {
                                        const entries = Object.entries(step.headers);
                                        entries.splice(i, 1);
                                        onChange({ ...step, headers: Object.fromEntries(entries) });
                                    }}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Body */}
                    {['POST', 'PUT', 'PATCH'].includes(step.method) && (
                        <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Body</span>
                            <textarea
                                className="w-full h-20 mt-1 p-2 border border-border/50 rounded text-xs font-mono bg-background/50 resize-none outline-none focus:ring-1 focus:ring-indigo-500/30"
                                value={step.body}
                                onChange={e => onChange({ ...step, body: e.target.value })}
                                placeholder='{ "key": "{{value}}" }'
                                spellCheck={false}
                            />
                        </div>
                    )}

                    {/* Assertions */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Assertions</span>
                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={addAssertion}>
                                <Plus className="h-2.5 w-2.5 mr-0.5" /> Add
                            </Button>
                        </div>
                        <div className="space-y-1.5">
                            {step.assertions.map((a, i) => (
                                <AssertionRow key={i} assertion={a} onChange={a => updateAssertion(i, a)} onRemove={() => removeAssertion(i)} />
                            ))}
                            {step.assertions.length === 0 && (
                                <p className="text-[10px] text-muted-foreground/50 italic">No assertions — step will pass if the request succeeds.</p>
                            )}
                        </div>
                    </div>

                    {/* Variable Extraction */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Extract Variables</span>
                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={addExtract}>
                                <Plus className="h-2.5 w-2.5 mr-0.5" /> Add
                            </Button>
                        </div>
                        {(step.extractVariables || []).map((ext, i) => (
                            <div key={i} className="flex gap-1.5 mb-1 items-center group text-xs">
                                <Input className="h-7 w-24 text-xs font-mono" placeholder="varName" value={ext.name}
                                    onChange={e => {
                                        const arr = [...(step.extractVariables || [])];
                                        arr[i] = { ...arr[i], name: e.target.value };
                                        onChange({ ...step, extractVariables: arr });
                                    }} />
                                <span className="text-muted-foreground">=</span>
                                <select className="h-7 rounded border bg-background px-2 text-xs outline-none" value={ext.source}
                                    onChange={e => {
                                        const arr = [...(step.extractVariables || [])];
                                        arr[i] = { ...arr[i], source: e.target.value as 'body' | 'header' };
                                        onChange({ ...step, extractVariables: arr });
                                    }}>
                                    <option value="body">JSON Path</option>
                                    <option value="header">Header</option>
                                </select>
                                <Input className="h-7 flex-1 text-xs font-mono" placeholder="data.id" value={ext.path}
                                    onChange={e => {
                                        const arr = [...(step.extractVariables || [])];
                                        arr[i] = { ...arr[i], path: e.target.value };
                                        onChange({ ...step, extractVariables: arr });
                                    }} />
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                    onClick={() => {
                                        const arr = (step.extractVariables || []).filter((_, idx) => idx !== i);
                                        onChange({ ...step, extractVariables: arr });
                                    }}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


function SortableStep({ step, index, onChange, onRemove }: { step: TestStep, index: number, onChange: (s: TestStep) => void, onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="touch-none">
            <StepCard
                step={step}
                index={index}
                onChange={onChange}
                onRemove={onRemove}
                dragHandleProps={{ ...attributes, ...listeners }}
            />
        </div>
    );
}

// ═══════════════ Results Viewer ═══════════════

function ResultsView({ results }: { results: TestIterationResult[] }) {
    const totalSteps = results.reduce((sum, it) => sum + it.steps.length, 0);
    const passedSteps = results.reduce((sum, it) => sum + it.steps.filter(s => s.status === 'passed').length, 0);
    const failedSteps = results.reduce((sum, it) => sum + it.steps.filter(s => s.status === 'failed').length, 0);
    const errorSteps = results.reduce((sum, it) => sum + it.steps.filter(s => s.status === 'error').length, 0);

    return (
        <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                <span className="text-xs font-semibold">{results.length} iteration{results.length !== 1 ? 's' : ''}</span>
                <span className="text-xs font-semibold">{totalSteps} steps</span>
                <div className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="text-xs font-medium">{passedSteps}</span>
                </div>
                {failedSteps > 0 && (
                    <div className="flex items-center gap-1 text-red-400">
                        <XCircle className="h-3 w-3" />
                        <span className="text-xs font-medium">{failedSteps}</span>
                    </div>
                )}
                {errorSteps > 0 && (
                    <div className="flex items-center gap-1 text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-xs font-medium">{errorSteps}</span>
                    </div>
                )}
                <div className={cn(
                    "ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold",
                    failedSteps === 0 && errorSteps === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                )}>
                    {failedSteps === 0 && errorSteps === 0 ? "ALL PASSED" : "FAILED"}
                </div>
            </div>

            {/* Iterations */}
            {results.map((iteration, i) => (
                <div key={i} className="border border-border/30 rounded-lg overflow-hidden">
                    {iteration.dataRow && (
                        <div className="px-3 py-1.5 bg-muted/20 text-[10px] text-muted-foreground font-mono border-b border-border/30">
                            Row {i + 1}: {JSON.stringify(iteration.dataRow)}
                        </div>
                    )}
                    <div className="divide-y divide-border/20">
                        {iteration.steps.map((step, s) => (
                            <div key={s} className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                    {step.status === 'passed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                                    {step.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                                    {step.status === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                                    {step.status === 'skipped' && <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />}
                                    <span className="text-xs font-medium">{step.stepName || `Step ${s + 1}`}</span>
                                    {step.responseStatus && (
                                        <span className={cn(
                                            "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                            step.responseStatus < 300 ? "bg-emerald-500/10 text-emerald-400"
                                                : step.responseStatus < 400 ? "bg-amber-500/10 text-amber-400"
                                                    : "bg-red-500/10 text-red-400"
                                        )}>{step.responseStatus}</span>
                                    )}
                                    {step.duration !== undefined && (
                                        <span className="text-[10px] text-muted-foreground font-mono ml-auto">{step.duration}ms</span>
                                    )}
                                </div>
                                {step.error && (
                                    <p className="text-[11px] text-red-400 font-mono mt-1 ml-6">{step.error}</p>
                                )}
                                {step.assertionResults.length > 0 && (
                                    <div className="ml-6 mt-1.5 space-y-0.5">
                                        {step.assertionResults.map((ar, a) => (
                                            <div key={a} className="flex items-center gap-1.5 text-[10px]">
                                                {ar.passed
                                                    ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                                                    : <XCircle className="h-2.5 w-2.5 text-red-400" />}
                                                <span className="text-muted-foreground">
                                                    {ar.assertion.field}{ar.assertion.key ? `.${ar.assertion.key}` : ''} {ar.assertion.operator} {ar.assertion.expected}
                                                </span>
                                                {!ar.passed && ar.actual && (
                                                    <span className="text-red-400/80 font-mono">
                                                        (got: {ar.actual.length > 60 ? ar.actual.slice(0, 60) + '...' : ar.actual})
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ═══════════════ Main TestRunner ═══════════════

function createStep(): TestStep {
    return {
        id: crypto.randomUUID(),
        name: '',
        method: 'GET',
        url: '',
        headers: {},
        body: '',
        assertions: [{ field: 'status', operator: 'equals', expected: '200' }],
    };
}

export function TestRunner() {
    const scenarios = useLiveQuery(() => db.testScenarios.toArray());

    const [activeId, setActiveId] = useState<number | null>(null);
    const [editScenario, setEditScenario] = useState<TestScenario | null>(null);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState('');
    const [results, setResults] = useState<TestIterationResult[] | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const activeScenario = editScenario || (scenarios?.find(s => s.id === activeId) ?? null);

    const createNew = () => {
        const scenario: TestScenario = {
            name: 'New Scenario',
            steps: [createStep()],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        setEditScenario(scenario);
        setActiveId(null);
        setResults(null);
    };

    const save = async () => {
        if (!editScenario) return;
        editScenario.updatedAt = Date.now();
        if (activeId) {
            const { id: _id, ...updates } = editScenario;
            await db.testScenarios.update(activeId, updates);
        } else {
            const id = await db.testScenarios.add(editScenario);
            setActiveId(id as number);
        }
        setEditScenario(null);
    };

    const deleteScenario = async (id: number) => {
        await db.testScenarios.delete(id);
        if (activeId === id) {
            setActiveId(null);
            setEditScenario(null);
            setResults(null);
        }
    };

    const loadScenario = (s: TestScenario) => {
        setEditScenario({ ...s });
        setActiveId(s.id ?? null);
        setResults(null);
    };

    const run = async () => {
        const scenario = editScenario || activeScenario;
        if (!scenario) return;

        // Auto-save before running
        if (editScenario) await save();

        setRunning(true);
        setResults(null);
        setProgress('Starting...');

        try {
            const iterResults = await runScenario(scenario, (iteration, stepIndex, total) => {
                setProgress(`Iteration ${iteration + 1} — Step ${stepIndex + 1}/${total}`);
            });
            setResults(iterResults);

            // Save run result
            const allPassed = iterResults.every(it => it.steps.every(s => s.status === 'passed'));
            const totalDuration = iterResults.reduce((sum, it) =>
                sum + it.steps.reduce((s2, st) => s2 + (st.duration || 0), 0), 0);

            if (activeId) {
                await db.testRuns.add({
                    scenarioId: activeId,
                    status: allPassed ? 'passed' : 'failed',
                    startTime: Date.now() - totalDuration,
                    duration: totalDuration,
                    iterations: iterResults,
                });
            }
        } catch (e: any) {
            setResults([{
                index: 0,
                steps: [{
                    stepId: 'error',
                    stepName: 'Runner Error',
                    status: 'error',
                    assertionResults: [],
                    error: e.message,
                }]
            }]);
        } finally {
            setRunning(false);
            setProgress('');
        }
    };

    // Data import
    const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editScenario) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            try {
                let data: Record<string, string>[];

                if (file.name.endsWith('.json')) {
                    data = JSON.parse(text);
                    if (!Array.isArray(data)) data = [data];
                } else {
                    // CSV
                    const lines = text.trim().split('\n');
                    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                    data = lines.slice(1).map(line => {
                        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                        const row: Record<string, string> = {};
                        headers.forEach((h, i) => { row[h] = values[i] || ''; });
                        return row;
                    });
                }

                setEditScenario({
                    ...editScenario,
                    dataSource: { type: file.name.endsWith('.json') ? 'json' : 'csv', data, fileName: file.name }
                });
            } catch {
                alert('Failed to parse file. Ensure it\'s valid JSON or CSV.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }, [editScenario]);

    const updateStep = (index: number, step: TestStep) => {
        if (!editScenario) return;
        const steps = [...editScenario.steps];
        steps[index] = step;
        setEditScenario({ ...editScenario, steps });
    };

    const removeStep = (index: number) => {
        if (!editScenario) return;
        setEditScenario({ ...editScenario, steps: editScenario.steps.filter((_, i) => i !== index) });
    };

    const addStep = () => {
        if (!editScenario) return;
        setEditScenario({ ...editScenario, steps: [...editScenario.steps, createStep()] });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!editScenario || !over || active.id === over.id) return;

        const oldIndex = editScenario.steps.findIndex(s => s.id === active.id);
        const newIndex = editScenario.steps.findIndex(s => s.id === over.id);

        setEditScenario({
            ...editScenario,
            steps: arrayMove(editScenario.steps, oldIndex, newIndex)
        });
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    return (
        <div className="flex h-full">
            {/* Left sidebar — Scenarios list */}
            <div className="w-56 border-r border-border/50 flex flex-col bg-sidebar-bg shrink-0">
                <div className="p-3 border-b border-border/50">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <FlaskConical className="h-3.5 w-3.5" /> Scenarios
                        </h3>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={createNew} title="New Scenario">
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1">
                    {scenarios?.map(s => (
                        <div key={s.id} className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer group transition-colors",
                            activeId === s.id ? "bg-indigo-500/10 text-indigo-400" : "hover:bg-muted/50 text-muted-foreground"
                        )}>
                            <button className="flex-1 text-left truncate" onClick={() => loadScenario(s)}>
                                {s.name}
                            </button>
                            <span className="text-[10px] text-muted-foreground/50">{s.steps.length}s</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => deleteScenario(s.id!)}>
                                <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                        </div>
                    ))}
                    {(!scenarios || scenarios.length === 0) && (
                        <div className="text-center text-[10px] text-muted-foreground/40 py-8">
                            No scenarios yet
                        </div>
                    )}
                </div>
            </div>

            {/* Main area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {!editScenario && !activeScenario ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
                        <FlaskConical className="h-10 w-10" />
                        <p className="text-sm font-medium">Automated Testing</p>
                        <p className="text-xs text-muted-foreground/30">Create a scenario to build and run automated test sequences</p>
                        <Button onClick={createNew} className="mt-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0">
                            <Plus className="h-4 w-4 mr-1" /> New Scenario
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Toolbar */}
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-url-bar-bg">
                            {editScenario ? (
                                <Input
                                    className="h-8 w-48 text-sm font-semibold"
                                    value={editScenario.name}
                                    onChange={e => setEditScenario({ ...editScenario, name: e.target.value })}
                                    placeholder="Scenario name"
                                />
                            ) : (
                                <h2 className="text-sm font-semibold">{activeScenario?.name}</h2>
                            )}
                            <div className="ml-auto flex items-center gap-2">
                                {editScenario && (
                                    <>
                                        <input ref={fileRef} type="file" accept=".json,.csv" className="hidden" onChange={handleFileImport} />
                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileRef.current?.click()}>
                                            <Upload className="h-3 w-3 mr-1" /> Import Data
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={save}>
                                            <Save className="h-3 w-3 mr-1" /> Save
                                        </Button>
                                    </>
                                )}
                                {!editScenario && activeScenario && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditScenario({ ...activeScenario })}>
                                        Edit
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    className="h-7 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0"
                                    onClick={run}
                                    disabled={running}
                                >
                                    {running ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                                    {running ? progress || 'Running...' : 'Run'}
                                </Button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {/* Data Source */}
                            {editScenario?.dataSource && (
                                <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {editScenario.dataSource.type === 'json'
                                                ? <FileJson className="h-4 w-4 text-indigo-400" />
                                                : <FileSpreadsheet className="h-4 w-4 text-indigo-400" />}
                                            <span className="text-xs font-medium text-indigo-300">
                                                {editScenario.dataSource.fileName || 'Data Source'}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {editScenario.dataSource.data.length} row{editScenario.dataSource.data.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6"
                                            onClick={() => setEditScenario({ ...editScenario, dataSource: undefined })}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    {editScenario.dataSource.data.length > 0 && (
                                        <div className="mt-2 overflow-x-auto">
                                            <table className="w-full text-[10px] font-mono">
                                                <thead>
                                                    <tr className="border-b border-indigo-500/20">
                                                        {Object.keys(editScenario.dataSource.data[0]).map(k => (
                                                            <th key={k} className="px-2 py-1 text-left text-indigo-400 font-medium">{k}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {editScenario.dataSource.data.slice(0, 5).map((row, i) => (
                                                        <tr key={i} className="border-b border-border/20">
                                                            {Object.values(row).map((v, j) => (
                                                                <td key={j} className="px-2 py-1 text-muted-foreground">{v}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {editScenario.dataSource.data.length > 5 && (
                                                <p className="text-[10px] text-muted-foreground/50 mt-1 text-center">
                                                    +{editScenario.dataSource.data.length - 5} more rows
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                                        Use {'{{variableName}}'} in step URLs, headers, and body to reference data columns.
                                    </p>
                                </div>
                            )}

                            {/* Steps */}
                            {editScenario && (
                                <>
                                    <div className="space-y-2">
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={editScenario.steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                                {editScenario.steps.map((step, i) => (
                                                    <SortableStep key={step.id} step={step} index={i} onChange={s => updateStep(i, s)} onRemove={() => removeStep(i)} />
                                                ))}
                                            </SortableContext>
                                        </DndContext>
                                    </div>
                                    <Button variant="outline" className="w-full h-9 text-xs border-dashed" onClick={addStep}>
                                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Step
                                    </Button>
                                </>
                            )}

                            {/* Results */}
                            {results && (
                                <div className="mt-4">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Results</h3>
                                    <ResultsView results={results} />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
