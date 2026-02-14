"use client";

import { useCallback, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { RequestPanel } from "@/components/RequestPanel";
import { ResponsePanel } from "@/components/ResponsePanel";
import { RequestTabs } from "@/components/RequestTabs";
import { TestRunner } from "@/components/TestRunner";
import { MockServer } from "@/components/MockServer";
import { ResizeHandle } from "@/components/ResizeHandle";
import { Button } from "@/components/ui/button";
import { Columns2, Rows2, Send, FlaskConical, Server } from "lucide-react";
import { useAppStore, useCurrentRequest } from "@/lib/store";
import { cn } from "@/lib/utils";

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
  const [view, setView] = useState<"api" | "testing" | "mock">("api");

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
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* ─── Top Bar: Tabs + View/Layout Toggles ─── */}
        <div className="flex items-center border-b border-border/50 bg-url-bar-bg/50 min-h-[36px]">
          {/* Tabs (only in API view) */}
          {view === "api" && (
            <div className="flex-1 min-w-0">
              <RequestTabs />
            </div>
          )}
          {view !== "api" && (
            <div className="flex-1" />
          )}

          {/* Right-side controls */}
          <div className="flex items-center gap-1.5 px-2 shrink-0">
            {/* View Toggle */}
            <div className="flex items-center bg-muted/40 rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => setView("api")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all",
                  view === "api"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Send className="h-3 w-3" />
                API
              </button>
              <button
                onClick={() => setView("testing")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all",
                  view === "testing"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FlaskConical className="h-3 w-3" />
                Tests
              </button>
              <button
                onClick={() => setView("mock")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all",
                  view === "mock"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Server className="h-3 w-3" />
                Mock
              </button>
            </div>

            {/* Layout Toggle (only in API view) */}
            {view === "api" && (
              <div className="flex items-center bg-muted/40 rounded-md p-0.5 gap-0.5">
                <button
                  onClick={() => setLayout("vertical")}
                  className={cn(
                    "p-1 rounded transition-all",
                    layout === "vertical"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Side by side"
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setLayout("horizontal")}
                  className={cn(
                    "p-1 rounded transition-all",
                    layout === "horizontal"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Stacked"
                >
                  <Rows2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Content ─── */}
        {view === "testing" ? (
          <TestRunner />
        ) : view === "mock" ? (
          <MockServer />
        ) : (
          <>
            {layout === "vertical" ? (
              <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  <RequestPanel onResponse={handleResponse} />
                </div>
                <ResizeHandle direction="horizontal" onResize={handleResponseResizeH} />
                <div style={{ width: responseWidth, minWidth: RESPONSE_MIN_W }} className="flex-shrink-0 bg-background border-l border-border/50 relative z-10">
                  <ResponsePanel response={currentRequest.response} orientation="vertical" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <RequestPanel onResponse={handleResponse} />
                </div>
                <ResizeHandle direction="vertical" onResize={handleResponseResizeV} />
                <div style={{ height: responseHeight || "50%", minHeight: RESPONSE_MIN_H }} className="flex-shrink-0 flex flex-col bg-background border-t border-border/50 relative z-10">
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
