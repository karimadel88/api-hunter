import { TestResult } from './store';

/**
 * Sandboxed script runner with a Postman-compatible pm.* API.
 *
 * Runs user scripts inside a `new Function()` sandbox with a limited API surface.
 * Scripts can:
 *   - pm.environment.set(key, value) / get(key)
 *   - pm.variables.set(key, value) / get(key)
 *   - pm.request  (read-only request info)
 *   - pm.response  (read-only response info, post-script only)
 *   - pm.test(name, fn)  (register test assertions)
 *   - pm.expect(value)   (chai-style assertions)
 *   - console.log(...)   (captured)
 */

interface ScriptContext {
    request: {
        method: string;
        url: string;
        headers: Record<string, string>;
        body: string;
    };
    response?: {
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body: any;
        responseTime: number;
    };
    environmentVars: Record<string, string>;
}

interface ScriptResult {
    testResults: TestResult[];
    envUpdates: Record<string, string>;
    logs: string[];
    error?: string;
}

function createExpect(value: any) {
    const chain: any = {
        _value: value,
        _not: false,
    };

    const check = (condition: boolean, msg: string) => {
        if (chain._not ? condition : !condition) {
            throw new Error(msg);
        }
        return chain;
    };

    chain.to = chain;
    chain.be = chain;
    chain.been = chain;
    chain.a = chain;
    chain.an = chain;
    chain.have = chain;
    chain.is = chain;
    chain.that = chain;
    chain.which = chain;
    chain.and = chain;

    Object.defineProperty(chain, 'not', {
        get() {
            chain._not = !chain._not;
            return chain;
        }
    });

    chain.equal = (expected: any) => check(value === expected, `Expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`);
    chain.eql = (expected: any) => check(JSON.stringify(value) === JSON.stringify(expected), `Expected deep equality`);
    chain.above = (n: number) => check(value > n, `Expected ${value} to be above ${n}`);
    chain.below = (n: number) => check(value < n, `Expected ${value} to be below ${n}`);
    chain.least = (n: number) => check(value >= n, `Expected ${value} to be at least ${n}`);
    chain.most = (n: number) => check(value <= n, `Expected ${value} to be at most ${n}`);
    chain.include = (item: any) => {
        if (typeof value === 'string') return check(value.includes(item), `Expected string to include "${item}"`);
        if (Array.isArray(value)) return check(value.includes(item), `Expected array to include ${JSON.stringify(item)}`);
        return check(false, `Cannot use include on ${typeof value}`);
    };
    chain.contains = chain.include;
    chain.exist = check(value !== null && value !== undefined, `Expected value to exist`);

    Object.defineProperty(chain, 'ok', {
        get() { return check(!!value, `Expected value to be truthy`); }
    });
    Object.defineProperty(chain, 'true', {
        get() { return check(value === true, `Expected value to be true`); }
    });
    Object.defineProperty(chain, 'false', {
        get() { return check(value === false, `Expected value to be false`); }
    });
    Object.defineProperty(chain, 'null', {
        get() { return check(value === null, `Expected value to be null`); }
    });
    Object.defineProperty(chain, 'undefined', {
        get() { return check(value === undefined, `Expected value to be undefined`); }
    });
    Object.defineProperty(chain, 'empty', {
        get() {
            if (typeof value === 'string' || Array.isArray(value)) return check(value.length === 0, `Expected value to be empty`);
            if (typeof value === 'object' && value) return check(Object.keys(value).length === 0, `Expected object to be empty`);
            return check(false, `Cannot check empty on ${typeof value}`);
        }
    });

    chain.property = (name: string) => {
        check(value !== null && value !== undefined && name in value, `Expected object to have property "${name}"`);
        return createExpect(value?.[name]);
    };
    chain.length = (n: number) => check(value?.length === n, `Expected length ${n} but got ${value?.length}`);
    chain.match = (re: RegExp) => check(re.test(value), `Expected value to match ${re}`);
    chain.oneOf = (list: any[]) => check(list.includes(value), `Expected ${JSON.stringify(value)} to be one of ${JSON.stringify(list)}`);
    chain.string = (str: string) => check(typeof value === 'string' && value.includes(str), `Expected string to contain "${str}"`);

    // Type checks
    chain.type = (t: string) => check(typeof value === t, `Expected type "${t}" but got "${typeof value}"`);

    return chain;
}

export function runScript(script: string, context: ScriptContext): ScriptResult {
    const testResults: TestResult[] = [];
    const envUpdates: Record<string, string> = {};
    const logs: string[] = [];
    const localVars: Record<string, string> = {};

    if (!script.trim()) {
        return { testResults, envUpdates, logs };
    }

    // Build pm object
    const pm = {
        environment: {
            get: (key: string) => envUpdates[key] ?? context.environmentVars[key] ?? '',
            set: (key: string, value: string) => { envUpdates[key] = String(value); },
            toObject: () => ({ ...context.environmentVars, ...envUpdates }),
        },
        variables: {
            get: (key: string) => localVars[key] ?? '',
            set: (key: string, value: string) => { localVars[key] = String(value); },
        },
        request: {
            method: context.request.method,
            url: context.request.url,
            headers: { ...context.request.headers },
            body: context.request.body,
        },
        response: context.response ? {
            code: context.response.status,
            status: context.response.statusText,
            headers: { ...context.response.headers },
            responseTime: context.response.responseTime,
            json: () => {
                try { return typeof context.response!.body === 'string' ? JSON.parse(context.response!.body) : context.response!.body; }
                catch { return null; }
            },
            text: () => typeof context.response!.body === 'string' ? context.response!.body : JSON.stringify(context.response!.body),
        } : undefined,
        test: (name: string, fn: () => void) => {
            try {
                fn();
                testResults.push({ name, passed: true });
            } catch (e: any) {
                testResults.push({ name, passed: false, error: e.message || String(e) });
            }
        },
        expect: createExpect,
    };

    const consoleMock = {
        log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        warn: (...args: any[]) => logs.push('[warn] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        error: (...args: any[]) => logs.push('[error] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        info: (...args: any[]) => logs.push('[info] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    };

    try {
        const fn = new Function('pm', 'console', script);
        fn(pm, consoleMock);
    } catch (e: any) {
        return {
            testResults,
            envUpdates,
            logs,
            error: e.message || String(e),
        };
    }

    return { testResults, envUpdates, logs };
}
