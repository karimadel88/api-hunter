import Dexie, { type Table } from 'dexie';

export interface Collection {
    id?: number;
    name: string;
    parentId?: number; // For nested folders
    environmentId?: number;
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
    bodyType?: 'json' | 'form-data' | 'urlencoded';
    bodyRawLanguage?: 'json' | 'xml' | 'html' | 'text';
    bodyFormData?: { key: string; value: string; type: 'text' | 'file'; file?: File; fileName?: string }[];
    bodyFormUrlEncoded?: { key: string; value: string }[];
    auth?: { type: string;[key: string]: any };
    environmentId?: number;
    createdAt: number;
}

export interface HistoryItem {
    id?: number;
    method: string;
    url: string;
    status: number;
    duration: number;
    environmentId?: number;
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

// ── Phase 4: Mock Server ──

export interface MockRoute {
    id?: number;
    method: string;
    path: string;              // e.g. "/api/users/:id"
    responseStatus: number;
    responseHeaders: Record<string, string>;
    responseBody: string;
    delay: number;             // simulated latency in ms
    enabled: boolean;
    description?: string;
    createdAt: number;
}

export class ApiHunterDB extends Dexie {
    collections!: Table<Collection>;
    requests!: Table<RequestItem>;
    history!: Table<HistoryItem>;
    environments!: Table<Environment>;
    testScenarios!: Table<TestScenario>;
    testRuns!: Table<TestRunResult>;
    mockRoutes!: Table<MockRoute>;

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
        this.version(3).stores({
            collections: '++id, parentId, name',
            requests: '++id, collectionId, name',
            history: '++id, createdAt',
            environments: '++id, name',
            testScenarios: '++id, name, createdAt',
            testRuns: '++id, scenarioId, startTime',
            mockRoutes: '++id, method, path, enabled',
        });
        this.version(4).stores({
            collections: '++id, parentId, name, environmentId',
            requests: '++id, collectionId, name, environmentId',
            history: '++id, createdAt, environmentId',
            environments: '++id, name',
            testScenarios: '++id, name, createdAt',
            testRuns: '++id, scenarioId, startTime',
            mockRoutes: '++id, method, path, enabled',
        });
    }
}

export const db = new ApiHunterDB();
