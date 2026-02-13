"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
    direction: "horizontal" | "vertical"; // horizontal = left-right drag, vertical = up-down drag
    onResize: (delta: number) => void;
    onResizeEnd?: () => void;
    className?: string;
}

export function ResizeHandle({ direction, onResize, onResizeEnd, className }: ResizeHandleProps) {
    const [isDragging, setIsDragging] = useState(false);
    const lastPos = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        lastPos.current = direction === "horizontal" ? e.clientX : e.clientY;
    }, [direction]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
            const delta = currentPos - lastPos.current;
            lastPos.current = currentPos;
            onResize(delta);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            onResizeEnd?.();
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [isDragging, direction, onResize, onResizeEnd]);

    return (
        <div
            onMouseDown={handleMouseDown}
            className={cn(
                "group relative flex-shrink-0 transition-colors",
                direction === "horizontal"
                    ? "w-[5px] cursor-col-resize hover:bg-indigo-500/30"
                    : "h-[5px] cursor-row-resize hover:bg-indigo-500/30",
                isDragging && "bg-indigo-500/50",
                className
            )}
        >
            {/* Visual indicator line */}
            <div className={cn(
                "absolute transition-opacity",
                direction === "horizontal"
                    ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-8 rounded-full"
                    : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[2px] w-8 rounded-full",
                isDragging ? "bg-indigo-500 opacity-100" : "bg-muted-foreground/20 opacity-0 group-hover:opacity-100"
            )} />
        </div>
    );
}
