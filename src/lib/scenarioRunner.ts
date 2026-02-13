import axios from 'axios';
import { TestStep, TestAssertion, TestStepResult, TestIterationResult, TestScenario } from './db';

/**
 * Run a single test scenario, executing each step in sequence.
 * Supports data-driven testing: if dataSource is provided, the scenario runs once per data row.
 * Variables from {{variable}} syntax are substituted from the data row and extracted variables.
 */

export async function runScenario(
    scenario: TestScenario,
    onProgress?: (iteration: number, stepIndex: number, total: number) => void
): Promise<TestIterationResult[]> {
    const dataRows = scenario.dataSource?.data?.length
        ? scenario.dataSource.data
        : [{}]; // at least one iteration with no data

    const results: TestIterationResult[] = [];

    for (let i = 0; i < dataRows.length; i++) {
        const dataRow = dataRows[i];
        const variables: Record<string, string> = { ...dataRow };
        const stepResults: TestStepResult[] = [];
        let shouldSkip = false;

        for (let s = 0; s < scenario.steps.length; s++) {
            const step = scenario.steps[s];
            onProgress?.(i, s, scenario.steps.length);

            if (shouldSkip) {
                stepResults.push({
                    stepId: step.id,
                    stepName: step.name,
                    status: 'skipped',
                    assertionResults: [],
                });
                continue;
            }

            const result = await executeStep(step, variables);
            stepResults.push(result);

            if (result.status === 'error' || result.status === 'failed') {
                shouldSkip = true;
            }
        }

        results.push({
            index: i,
            dataRow: Object.keys(dataRow).length > 0 ? dataRow : undefined,
            steps: stepResults,
        });
    }

    return results;
}

function substituteVars(text: string, vars: Record<string, string>): string {
    if (!text) return text;
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function getJsonPath(obj: any, path: string): any {
    if (!path) return obj;
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
}

async function executeStep(step: TestStep, variables: Record<string, string>): Promise<TestStepResult> {
    const startTime = Date.now();

    try {
        const url = substituteVars(step.url, variables);
        const body = step.body ? substituteVars(step.body, variables) : undefined;
        const headers: Record<string, string> = {};
        Object.entries(step.headers || {}).forEach(([k, v]) => {
            if (k) headers[substituteVars(k, variables)] = substituteVars(v, variables);
        });

        const res = await axios.post('/api/proxy', {
            method: step.method || 'GET',
            url,
            headers,
            body: (step.method !== 'GET' && step.method !== 'HEAD') ? body : undefined,
        });

        const duration = Date.now() - startTime;
        const responseData = res.data;

        // Extract variables
        if (step.extractVariables) {
            for (const ext of step.extractVariables) {
                if (ext.source === 'body') {
                    const parsed = typeof responseData.data === 'string'
                        ? (() => { try { return JSON.parse(responseData.data); } catch { return responseData.data; } })()
                        : responseData.data;
                    const val = getJsonPath(parsed, ext.path);
                    if (val !== undefined) variables[ext.name] = String(val);
                } else if (ext.source === 'header') {
                    const val = responseData.headers?.[ext.path.toLowerCase()];
                    if (val) variables[ext.name] = String(val);
                }
            }
        }

        // Run assertions
        const assertionResults = step.assertions.map(a => evaluateAssertion(a, responseData, duration));
        const allPassed = assertionResults.every(r => r.passed);

        return {
            stepId: step.id,
            stepName: step.name,
            status: allPassed ? 'passed' : 'failed',
            responseStatus: responseData.status,
            duration,
            assertionResults,
        };
    } catch (error: any) {
        return {
            stepId: step.id,
            stepName: step.name,
            status: 'error',
            duration: Date.now() - startTime,
            assertionResults: [],
            error: error.message || String(error),
        };
    }
}

function evaluateAssertion(
    assertion: TestAssertion,
    response: any,
    duration: number
): { assertion: TestAssertion; passed: boolean; actual?: string; error?: string } {
    try {
        let actual: any;

        switch (assertion.field) {
            case 'status':
                actual = response.status;
                break;
            case 'responseTime':
                actual = duration;
                break;
            case 'body': {
                const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                actual = body;
                break;
            }
            case 'header':
                actual = response.headers?.[assertion.key?.toLowerCase() || ''];
                break;
            case 'jsonPath': {
                const parsed = typeof response.data === 'string'
                    ? (() => { try { return JSON.parse(response.data); } catch { return response.data; } })()
                    : response.data;
                actual = getJsonPath(parsed, assertion.key || '');
                break;
            }
        }

        const expected = assertion.expected;
        const actualStr = typeof actual === 'object' ? JSON.stringify(actual) : String(actual ?? '');
        let passed = false;

        switch (assertion.operator) {
            case 'equals':
                passed = actualStr === expected || Number(actual) === Number(expected);
                break;
            case 'notEquals':
                passed = actualStr !== expected && Number(actual) !== Number(expected);
                break;
            case 'contains':
                passed = actualStr.includes(expected);
                break;
            case 'notContains':
                passed = !actualStr.includes(expected);
                break;
            case 'gt':
                passed = Number(actual) > Number(expected);
                break;
            case 'lt':
                passed = Number(actual) < Number(expected);
                break;
            case 'gte':
                passed = Number(actual) >= Number(expected);
                break;
            case 'lte':
                passed = Number(actual) <= Number(expected);
                break;
            case 'exists':
                passed = actual !== undefined && actual !== null;
                break;
            case 'type':
                passed = typeof actual === expected;
                break;
        }

        return { assertion, passed, actual: actualStr };
    } catch (error: any) {
        return { assertion, passed: false, error: error.message };
    }
}
