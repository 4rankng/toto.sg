// Masonry layout for the Insights gallery.
//
// A plain 12-column grid with auto-placement leaves holes wherever a panel's
// span does not compose with its neighbours' heights. This packer removes
// them by construction: every panel is placed explicitly at the shortest
// position its column span allows, so no bare background ever opens between
// cards and no card is stretched to hide one. Full-width panels (span 12)
// reset the column baseline like a row break. Below `lg` the panels stack in
// a single column and the explicit placement is cleared.
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { cx } from "@/utils/cx";

/** Matches the gallery's `gap-3`: 0.75rem at a 16px root. */
const GAP_PX = 12;

/** The packing only applies once the gallery has its twelve columns. */
const COLUMNS_QUERY = "(min-width: 64rem)";

interface MasonryGridProps {
    className?: string;
    children: ReactNode;
}

export function MasonryGrid({ className, children }: MasonryGridProps) {
    const ref = useRef<HTMLDivElement>(null);

    // Run after every render: if the gallery re-renders (data arrives, theme
    // changes, charts resize), the panels may have resized and the placement
    // needs re-measuring.
    useLayoutEffect(() => {
        const grid = ref.current;
        if (!grid) return;

        const query = window.matchMedia(COLUMNS_QUERY);
        let disposed = false;
        let frame = 0;
        let packedState = "";

        const panels = () => Array.from(grid.children).filter((child): child is HTMLElement => child instanceof HTMLElement);

        /** The container width plus every panel's rendered box. */
        const layoutState = () => {
            const parts = [String(Math.round(grid.getBoundingClientRect().width))];
            for (const item of panels()) {
                const r = item.getBoundingClientRect();
                parts.push(`${Math.round(r.width)}x${Math.round(r.height)}`);
            }
            return parts.join("|");
        };

        /** Remove this packer's inline placement so natural sizes measure. */
        const clearPlacement = (items: HTMLElement[]) => {
            grid.style.gridAutoRows = "";
            grid.style.gridAutoFlow = "";
            grid.style.rowGap = "";
            for (const item of items) {
                item.style.gridArea = "";
            }
        };

        /**
         * Place every panel explicitly at the shortest position its span
         * fits, tracking a per-column height. Rows are 1px tall so a pixel
         * offset is a row index; the panel's own span covers its height plus
         * one gap so the next panel starts exactly GAP_PX below it.
         */
        const place = (items: HTMLElement[]) => {
            const width = grid.getBoundingClientRect().width;
            const colWidth = (width - GAP_PX * 11) / 12;
            if (colWidth <= 0) return;

            // Measure natural heights: no explicit placement, no stretch.
            clearPlacement(items);
            grid.style.gridAutoFlow = "row"; // plain order while measuring
            void grid.offsetHeight;

            const step = colWidth + GAP_PX;
            const heights = new Array(12).fill(0);
            const placements = [];

            for (const item of items) {
                const r = item.getBoundingClientRect();
                const span = Math.max(1, Math.min(12, Math.round((r.width + GAP_PX) / step)));
                const h = Math.ceil(r.height) + GAP_PX;

                let x = 0;
                let y = 0;
                if (span >= 12) {
                    // Full-width panel: a row break — everyone waits for it.
                    y = Math.max(...heights);
                    x = 0;
                    heights.fill(y + h);
                } else {
                    // Shortest window of `span` consecutive columns.
                    let bestY = Number.POSITIVE_INFINITY;
                    for (let c = 0; c + span <= 12; c += 1) {
                        const yy = Math.max(...heights.slice(c, c + span));
                        if (yy < bestY - 0.5) {
                            bestY = yy;
                            x = c;
                        }
                    }
                    y = bestY;
                    for (let c = x; c < x + span; c += 1) heights[c] = y + h;
                }
                placements.push({ item, x, y, span, h });
            }

            // Apply: 1px rows, no flow — every panel gets an explicit area.
            grid.style.gridAutoRows = "1px";
            grid.style.gridAutoFlow = "row";
            grid.style.rowGap = "0px";
            for (const p of placements) {
                p.item.style.gridArea = `${p.y + 1} / ${p.x + 1} / span ${p.h} / span ${p.span}`;
            }
            packedState = layoutState();
        };

        /** One synchronous pass; offsetHeight reads force settled layouts. */
        const run = () => {
            frame = 0;
            if (disposed) return;
            const items = panels();

            if (!query.matches) {
                clearPlacement(items);
                packedState = layoutState();
                return;
            }

            place(items);
            void grid.offsetHeight;
            packedState = layoutState();
        };

        const request = () => {
            if (disposed || frame !== 0) return;
            // The placement is still valid for what is on screen — our own
            // writes echo here, and must not rebuild themselves forever.
            if (layoutState() === packedState) return;
            frame = window.requestAnimationFrame(run);
        };

        run();

        // A resize or a chart re-measuring itself changes a panel's box; repack
        // when the layout the placement was built from is no longer current.
        const observer = new ResizeObserver(() => {
            if (disposed) return;
            request();
        });
        observer.observe(grid);
        for (const item of panels()) observer.observe(item);

        const onQueryChange = () => request();
        query.addEventListener("change", onQueryChange);
        // Web fonts land after first paint and can nudge the measured heights.
        document.fonts?.ready
            .then(() => {
                if (!disposed) request();
            })
            .catch(() => {});

        return () => {
            disposed = true;
            observer.disconnect();
            query.removeEventListener("change", onQueryChange);
            if (frame !== 0) cancelAnimationFrame(frame);
        };
    });

    return (
        <div ref={ref} className={cx("grid items-start gap-3 lg:grid-cols-12", className)}>
            {children}
        </div>
    );
}
