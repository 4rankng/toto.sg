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
            const placements = [];

            // Free-rectangle packing. A full-width (span-12) panel sweeps the
            // board flat; every other panel claims the highest free rectangle
            // its span and height fit in, left first. Leftover slivers are
            // split and reused by later panels, so no area a panel could
            // occupy is ever left bare.
            const free: { x: number; y: number; w: number; h: number }[] = [];
            const consume = (y: number) => {
                // Drop or trim every free rect above/at the sweep line, and
                // sink the rest below the sweep + one row.
                for (let i = free.length - 1; i >= 0; i -= 1) {
                    const f = free[i];
                    if (f.y + f.h <= y) continue;
                    if (f.y >= y) {
                        f.y = y;
                        f.h = Math.max(0, f.y + f.h - y);
                        if (f.h <= 0 || f.w <= 0) free.splice(i, 1);
                    } else {
                        const bottom = f.y + f.h;
                        f.h = y - f.y;
                        if (f.h > 0) free.splice(i + 1, 0, { x: f.x, y, w: f.w, h: bottom - y });
                        if (f.h <= 0) free.splice(i, 1);
                    }
                }
            };

            for (const item of items) {
                const r = item.getBoundingClientRect();
                const span = Math.max(1, Math.min(12, Math.round((r.width + GAP_PX) / step)));
                const h = Math.ceil(r.height) + GAP_PX;

                if (span >= 12) {
                    consume(0);
                    placements.push({ item, x: 0, y: 0, span: 12, h });
                    continue;
                }

                // Highest free rect wide enough, then tall enough; left first.
                let pick = -1;
                for (let i = 0; i < free.length; i += 1) {
                    if (free[i].w >= span && free[i].h >= h) {
                        if (pick === -1 || free[i].y < free[pick].y || (free[i].y === free[pick].y && free[i].x < free[pick].x)) pick = i;
                    }
                }
                if (pick === -1) {
                    // Nothing fits anywhere: start a fresh band at the bottom.
                    const y = Math.max(0, ...free.map((f) => f.y + f.h));
                    consume(y);
                    pick = free.push({ x: 0, y, w: 12, h: Number.POSITIVE_INFINITY }) - 1;
                }
                const rect = free[pick];
                const x = rect.x;
                const y = rect.y;

                // Claim the area: trim the chosen rect and split the remainders
                // (right of the panel, below it) as new free rects.
                free.splice(pick, 1);
                const rightW = rect.w - span;
                if (rightW > 0) free.push({ x: x + span, y: rect.y, w: rightW, h: rect.h });
                const belowH = rect.h - h;
                if (belowH > 0) free.push({ x, y: y + h, w: span, h: belowH });

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
