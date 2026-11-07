// toto.sg — the pointer tooltip every SVG chart on the site shares.
//
// Charts lay themselves out in CSS pixels — the viewBox width is the rendered
// width — so labels keep their size instead of shrinking with the panel. The
// tooltip follows the pointer and is a pointer-only affordance: the wrapper
// keeps role="img" plus a one-line summary, so a screen reader gets the shape
// of the data in a single stop and the tooltip never has to be
// keyboard-reachable.
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

export interface TooltipState {
    /** Pointer position inside the chart wrapper, in CSS pixels. */
    x: number;
    y: number;
    title: string;
    lines: string[];
}

/** Tooltip width in pixels — also the clamp margin at the chart edges. */
const TOOLTIP_WIDTH = 240;

/**
 * Pointer-driven tooltip shared by every chart in the site, plus the measured
 * width of the chart host.
 */
export function useChartTooltip(fallbackWidth = 980) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [tip, setTip] = useState<TooltipState | null>(null);
    const [width, setWidth] = useState(fallbackWidth);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        const observer = new ResizeObserver((entries) => {
            const next = entries[0]?.contentRect.width ?? 0;
            if (next > 0) setWidth(next);
        });
        observer.observe(host);
        setWidth(host.getBoundingClientRect().width);

        return () => observer.disconnect();
    }, []);

    const show = useCallback((event: ReactPointerEvent<Element>, title: string, lines: string[]) => {
        const host = hostRef.current;
        if (!host) return;
        const rect = host.getBoundingClientRect();
        const margin = Math.min(TOOLTIP_WIDTH / 2, rect.width / 2);
        const x = Math.min(Math.max(event.clientX - rect.left, margin), rect.width - margin);
        setTip({ x, y: event.clientY - rect.top, title, lines });
    }, []);

    const hide = useCallback(() => setTip(null), []);

    return { hostRef, tip, show, hide, width };
}

/** The floating readout that follows the pointer across a chart. */
export function ChartTooltip({ tip }: { tip: TooltipState }) {
    const below = tip.y < 96;

    return (
        <div
            className="pointer-events-none absolute z-20 w-max max-w-60 rounded-lg border border-line-strong bg-surface-3 px-2.5 py-1.5 shadow-float"
            style={{
                left: tip.x,
                top: tip.y,
                transform: below ? "translate(-50%, 12px)" : "translate(-50%, calc(-100% - 12px))",
            }}
        >
            <p className="text-xs font-medium text-ink">{tip.title}</p>
            {tip.lines.map((line) => (
                <p key={line} className="mt-0.5 font-mono text-xs text-ink-muted tabular-nums">
                    {line}
                </p>
            ))}
        </div>
    );
}
