
import { Collection, RequestItem } from "./db";

export interface ImportResult {
    collections: Partial<Collection>[];
    requests: Partial<RequestItem & { _tempCollectionId?: string }>[];
}

export function parseImportData(data: any): ImportResult {
    const result: ImportResult = { collections: [], requests: [] };

    if (!data) return result;

    // 1. ApiHunter Format
    if (data.source === "ApiHunter") {
        if (Array.isArray(data.collections)) result.collections = data.collections;
        if (Array.isArray(data.requests)) result.requests = data.requests;
        return result;
    }

    // 2. Postman Format (v2.1)
    if (data.info && data.item) {
        // Create a root collection for the file itself
        const rootId = crypto.randomUUID();
        const rootName = data.info.name || "Imported Collection";

        result.collections.push({
            id: rootId as any,
            name: rootName
        });

        // Parse items, setting rootId as parent for top-level items
        parsePostmanItems(data.item, rootId, result, rootName);
        return result;
    }

    return result;
}

function parsePostmanItems(items: any[], parentCollectionId: string, result: ImportResult, parentNamePrefix = "") {
    if (!Array.isArray(items)) return;

    items.forEach((item: any) => {
        if (item.item && !item.request) {
            // Folder -> Collection
            const tempId = crypto.randomUUID();
            // Name should be just the folder name, not flattened path
            const collectionName = item.name;

            const collection: any = {
                id: tempId,
                name: collectionName,
                // We'll use this temp ID during import to map parent relationships
                _tempParentId: parentCollectionId
            };
            result.collections.push(collection);

            // Recurse, using this new collection as parent for children
            parsePostmanItems(item.item, tempId, result, collectionName);
        } else if (item.request) {
            // Request -> Add to parent collection
            const req: any = {
                name: item.name,
                method: item.request.method,
                url: typeof item.request.url === 'string' ? item.request.url : item.request.url?.raw,
                headers: parsePostmanHeaders(item.request.header),
                // Handle Body
                ...parsePostmanBody(item.request.body),
                _tempCollectionId: parentCollectionId
            };
            result.requests.push(req);
        }
    });
}

function parsePostmanHeaders(headers: any[]): Record<string, string> {
    if (!Array.isArray(headers)) return {};
    return headers.reduce((acc, h) => {
        if (h.key) acc[h.key] = h.value;
        return acc;
    }, {});
}

function parsePostmanBody(body: any): Partial<RequestItem> {
    if (!body) return {};
    const res: Partial<RequestItem> = {};

    if (body.mode === 'raw') {
        res.body = body.raw || "";
        res.bodyType = 'json'; // Default
        // Check language options
        if (body.options?.raw?.language === 'json') res.bodyRawLanguage = 'json';
        else if (body.options?.raw?.language === 'xml') res.bodyRawLanguage = 'xml';
        else if (body.options?.raw?.language === 'html') res.bodyRawLanguage = 'html';
        else res.bodyRawLanguage = 'text';
    } else if (body.mode === 'formdata') {
        res.bodyType = 'form-data';
        res.bodyFormData = (body.formdata || []).map((f: any) => ({
            key: f.key,
            value: f.value,
            type: f.type === 'file' ? 'file' : 'text'
        }));
    } else if (body.mode === 'urlencoded') {
        res.bodyType = 'urlencoded';
        res.bodyFormUrlEncoded = (body.urlencoded || []).map((u: any) => ({
            key: u.key,
            value: u.value
        }));
    }
    return res;
}
