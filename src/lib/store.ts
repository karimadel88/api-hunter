import { create } from 'zustand';

interface KeyValue {
    key: string;
    value: string;
}

export interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

export interface RequestTab {
    id: string;
    label: string;
    method: string;
    url: string;
    params: KeyValue[];
    headers: KeyValue[];
    body: string;
    response: any;
    isDirty: boolean;
    preScript: string;
    postScript: string;
    testResults: TestResult[];
}

function createTab(partial?: Partial<RequestTab>): RequestTab {
    return {
        id: crypto.randomUUID(),
        label: 'New Request',
        method: 'GET',
        url: '',
        params: [{ key: '', value: '' }],
        headers: [{ key: '', value: '' }],
        body: '',
        response: null,
        isDirty: false,
        preScript: '',
        postScript: '',
        testResults: [],
        ...partial,
    };
}

interface AppState {
    // Sidebar
    sidebarOpen: boolean;
    toggleSidebar: () => void;

    // Environments
    activeEnvironmentId: number | null;
    setActiveEnvironmentId: (id: number | null) => void;

    // Tabs
    tabs: RequestTab[];
    activeTabId: string;
    addTab: (partial?: Partial<RequestTab>) => void;
    closeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    updateTab: (id: string, updates: Partial<RequestTab>) => void;

    // Legacy setters (update active tab)
    setMethod: (method: string) => void;
    setUrl: (url: string) => void;
    setParams: (params: KeyValue[]) => void;
    setHeaders: (headers: KeyValue[]) => void;
    setBody: (body: string) => void;
}

const defaultTab = createTab();

export const useAppStore = create<AppState>((set, get) => ({
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    activeEnvironmentId: null,
    setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }),

    // Tabs
    tabs: [defaultTab],
    activeTabId: defaultTab.id,

    addTab: (partial) => {
        const tab = createTab(partial);
        set((state) => ({
            tabs: [...state.tabs, tab],
            activeTabId: tab.id,
        }));
    },

    closeTab: (id) => {
        const { tabs, activeTabId } = get();
        if (tabs.length <= 1) return;
        const idx = tabs.findIndex(t => t.id === id);
        const newTabs = tabs.filter(t => t.id !== id);
        let newActiveId = activeTabId;
        if (activeTabId === id) {
            newActiveId = newTabs[Math.max(0, idx - 1)]?.id || newTabs[0].id;
        }
        set({ tabs: newTabs, activeTabId: newActiveId });
    },

    setActiveTab: (id) => set({ activeTabId: id }),

    updateTab: (id, updates) => {
        set((state) => ({
            tabs: state.tabs.map(t =>
                t.id === id ? { ...t, ...updates, isDirty: true } : t
            ),
        }));
    },

    // Legacy setters route to active tab
    setMethod: (method) => {
        const { activeTabId } = get();
        get().updateTab(activeTabId, { method });
    },
    setUrl: (url) => {
        const { activeTabId } = get();
        get().updateTab(activeTabId, { url, label: extractLabel(url) });
    },
    setParams: (params) => {
        const { activeTabId } = get();
        get().updateTab(activeTabId, { params });
    },
    setHeaders: (headers) => {
        const { activeTabId } = get();
        get().updateTab(activeTabId, { headers });
    },
    setBody: (body) => {
        const { activeTabId } = get();
        get().updateTab(activeTabId, { body });
    },
}));

/** Reactive hook to get the current active tab */
export function useCurrentRequest(): RequestTab {
    return useAppStore((state) => {
        return state.tabs.find(t => t.id === state.activeTabId) || state.tabs[0];
    });
}

function extractLabel(url: string): string {
    if (!url) return 'New Request';
    try {
        const u = new URL(url);
        const path = u.pathname === '/' ? u.hostname : u.pathname;
        return path.length > 30 ? '...' + path.slice(-27) : path;
    } catch {
        return url.length > 30 ? url.slice(0, 27) + '...' : url || 'New Request';
    }
}
