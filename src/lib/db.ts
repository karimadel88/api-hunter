import Dexie, { type Table } from 'dexie';

export interface Collection {
    id?: number;
    name: string;
    parentId?: number; // For nested folders
    createdAt: number;
}

export interface RequestItem {
    id?: number;
    collectionId?: number; // If part of a collection
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    params: Record<string, string>;
    body?: string;
    auth?: { type: string;[key: string]: any };
    createdAt: number;
}

export interface HistoryItem {
    id?: number;
    method: string;
    url: string;
    status: number;
    duration: number;
    createdAt: number;
}

export interface Environment {
    id?: number;
    name: string;
    variables: { key: string; value: string; enabled: boolean }[];
}

// ── Phase 3: Test Scenarios ──

export interface TestAssertion {
    field: 'status' | 'responseTime' | 'body' | 'header' | 'jsonPath';
    key?: string;            // header name or JSON path
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'type';
    expected: string;
}

export interface TestStep {
    id: string;
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    assertions: TestAssertion[];
    extractVariables?: { name: string; source: 'body' | 'header'; path: string }[];
}

export interface TestScenario {
    id?: number;
    name: string;
    steps: TestStep[];
    dataSource?: {
        type: 'json' | 'csv';
        data: Record<string, string>[];   // rows of key-value pairs
        fileName?: string;
    };
    createdAt: number;
    updatedAt: number;
}

export interface TestRunResult {
    id?: number;
    scenarioId: number;
    status: 'passed' | 'failed' | 'error';
    startTime: number;
    duration: number;
    iterations: TestIterationResult[];
}

export interface TestIterationResult {
    index: number;
    dataRow?: Record<string, string>;
    steps: TestStepResult[];
}

export interface TestStepResult {
    stepId: string;
    stepName: string;
    status: 'passed' | 'failed' | 'error' | 'skipped';
    responseStatus?: number;
    duration?: number;
    assertionResults: { assertion: TestAssertion; passed: boolean; actual?: string; error?: string }[];
    error?: string;
}

export class ApiHunterDB extends Dexie {
    collections!: Table<Collection>;
    requests!: Table<RequestItem>;
    history!: Table<HistoryItem>;
    environments!: Table<Environment>;
    testScenarios!: Table<TestScenario>;
    testRuns!: Table<TestRunResult>;

    constructor() {
        super('ApiHunterDB');
        this.version(1).stores({
            collections: '++id, parentId, name',
            requests: '++id, collectionId, name',
            history: '++id, createdAt',
            environments: '++id, name',
        });
        this.version(2).stores({
            collections: '++id, parentId, name',
            requests: '++id, collectionId, name',
            history: '++id, createdAt',
            environments: '++id, name',
            testScenarios: '++id, name, createdAt',
            testRuns: '++id, scenarioId, startTime',
        });
    }
}

export const db = new ApiHunterDB();
