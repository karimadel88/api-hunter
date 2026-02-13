"use client";

import { useCallback, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { RequestPanel } from "@/components/RequestPanel";
import { ResponsePanel } from "@/components/ResponsePanel";
import { RequestTabs } from "@/components/RequestTabs";
import { TestRunner } from "@/components/TestRunner";
import { ResizeHandle } from "@/components/ResizeHandle";
import { Button } from "@/components/ui/button";
import { Columns2, Rows2, Send, FlaskConical } from "lucide-react";
import { useAppStore, useCurrentRequest } from "@/lib/store";

export type LayoutOrientation = "vertical" | "horizontal";

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 280;

const RESPONSE_MIN_W = 300;
const RESPONSE_MIN_H = 150;

export default function Home() {
  const currentRequest = useCurrentRequest();
  const { activeTabId, updateTab } = useAppStore();
  const [layout, setLayout] = useState<LayoutOrientation>("vertical");
  const [view, setView] = useState<"api" | "testing">("api");

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [responseWidth, setResponseWidth] = useState(420);
  const [responseHeight, setResponseHeight] = useState<number | null>(null);

  const handleResponse = useCallback((response: any) => {
    updateTab(activeTabId, { response });
  }, [activeTabId, updateTab]);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(prev => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, prev + delta)));
  }, []);

  const handleResponseResizeH = useCallback((delta: number) => {
    setResponseWidth(prev => Math.max(RESPONSE_MIN_W, prev - delta));
  }, []);

  const handleResponseResizeV = useCallback((delta: number) => {
    setResponseHeight(prev => {
      const current = prev || (window.innerHeight / 2);
      return Math.max(RESPONSE_MIN_H, current - delta);
    });
  }, []);

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* ─── Sidebar ─── */}
      <div style={{ width: sidebarWidth, minWidth: SIDEBAR_MIN, maxWidth: SIDEBAR_MAX }} className="flex-shrink-0">
        <Sidebar />
      </div>
      <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {/* ─── View Toggle + Layout Toggle ─── */}
        <div className="absolute top-1 right-2 z-20 flex items-center gap-1">
          {/* View Toggle */}
          <div className="flex items-center gap-0.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg p-0.5 shadow-sm">
            <Button
              variant={view === "api" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6"
              onClick={() => setView("api")}
              title="API Client"
            >
              <Send className="h-3 w-3" />
            </Button>
            <Button
              variant={view === "testing" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6"
              onClick={() => setView("testing")}
              title="Automated Testing"
            >
              <FlaskConical className="h-3 w-3" />
            </Button>
          </div>

          {/* Layout Toggle (only in API view) */}
          {view === "api" && (
            <div className="flex items-center gap-0.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg p-0.5 shadow-sm">
              <Button
                variant={layout === "vertical" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => setLayout("vertical")}
                title="Side by side"
              >
                <Columns2 className="h-3 w-3" />
              </Button>
              <Button
                variant={layout === "horizontal" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => setLayout("horizontal")}
                title="Stacked"
              >
                <Rows2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {view === "testing" ? (
          <TestRunner />
        ) : (
          <>
            {/* ─── Request Tabs ─── */}
            <RequestTabs />

            {layout === "vertical" ? (
              <div className="flex flex-1 min-h-0">
                <div className="flex-1 flex flex-col min-w-0">
                  <RequestPanel onResponse={handleResponse} />
                </div>
                <ResizeHandle direction="horizontal" onResize={handleResponseResizeH} />
                <div style={{ width: responseWidth, minWidth: RESPONSE_MIN_W }} className="flex-shrink-0">
                  <ResponsePanel response={currentRequest.response} orientation="vertical" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 flex flex-col">
                  <RequestPanel onResponse={handleResponse} />
                </div>
                <ResizeHandle direction="vertical" onResize={handleResponseResizeV} />
                <div style={{ height: responseHeight || "50%", minHeight: RESPONSE_MIN_H }} className="flex-shrink-0 flex flex-col">
                  <ResponsePanel response={currentRequest.response} orientation="horizontal" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
