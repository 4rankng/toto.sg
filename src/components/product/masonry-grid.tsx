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
                item.style.minHeight = "";
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

            interface Box {
                item: HTMLElement;
                span: number;
                natural: number;
                h: number;
                x: number;
                y: number;
            }
            const boxes: Box[] = items.map((item) => {
                const r = item.getBoundingClientRect();
                const natural = Math.ceil(r.height);
                return {
                    item,
                    span: Math.max(1, Math.min(12, Math.round((r.width + GAP_PX) / step))),
                    natural,
                    h: natural + GAP_PX,
                    x: 0,
                    y: 0,
                };
            });

            // Bands: runs of partial-width panels between full-width rows.
            const placements: Box[] = [];
            let cursor = 0;
            let band: Box[] = [];

            const flushBand = () => {
                if (band.length === 0) return;
                const base = cursor;
                const placed: Box[] = [];

                if (band.every((b) => b.span === 6) && band.length <= 16) {
                    // Two equal columns: pick the split whose heights differ least.
                    const total = band.reduce((m, b) => m + b.h, 0);
                    let bestMask = 0;
                    let bestDiff = Number.POSITIVE_INFINITY;
                    const n = band.length;
                    for (let mask = 0; mask < 1 << n; mask += 1) {
                        let left = 0;
                        for (let i = 0; i < n; i += 1) if (mask & (1 << i)) left += band[i].h;
                        const diff = Math.abs(total - 2 * left);
                        if (diff < bestDiff) {
                            bestDiff = diff;
                            bestMask = mask;
                        }
                    }
                    let yl = base;
                    let yr = base;
                    band.forEach((b, i) => {
                        if (bestMask & (1 << i)) {
                            b.x = 0;
                            b.y = yl;
                            yl += b.h;
                        } else {
                            b.x = 6;
                            b.y = yr;
                            yr += b.h;
                        }
                        placed.push(b);
                    });
                } else {
                    // Mixed spans: shortest window of consecutive columns.
                    const heights = new Array(12).fill(base);
                    for (const b of band) {
                        let bestY = Number.POSITIVE_INFINITY;
                        for (let c = 0; c + b.span <= 12; c += 1) {
                            const yy = Math.max(...heights.slice(c, c + b.span));
                            if (yy < bestY - 0.5) {
                                bestY = yy;
                                b.x = c;
                            }
                        }
                        b.y = bestY;
                        for (let c = b.x; c < b.x + b.span; c += 1) heights[c] = b.y + b.h;
                        placed.push(b);
                    }
                }

                // Close the band flat: grow the last card of any short column
                // so every column ends on the same line and nothing hollow
                // opens before the next row.
                const bandBottom = Math.max(...placed.map((b) => b.y + b.h));
                for (let c = 0; c < 12; c += 1) {
                    let last: Box | null = null;
                    for (const b of placed) {
                        if (c >= b.x && c < b.x + b.span && (last === null || b.y + b.h > last.y + last.h)) last = b;
                    }
                    if (last === null) continue;
                    // Deficit is the smallest across the columns the card covers.
                    let deficit = Number.POSITIVE_INFINITY;
                    for (let cc = last.x; cc < last.x + last.span; cc += 1) {
                        let colBottom = 0;
                        for (const b of placed) {
                            if (cc >= b.x && cc < b.x + b.span) colBottom = Math.max(colBottom, b.y + b.h);
                        }
                        deficit = Math.min(deficit, bandBottom - colBottom);
                    }
                    if (deficit > 0 && Number.isFinite(deficit)) {
                        last.h += deficit;
                        last.natural += deficit;
                        last.item.style.minHeight = `${last.natural}px`;
                    }
                }

                cursor = Math.max(...placed.map((b) => b.y + b.h));
                placements.push(...placed);
                band = [];
            };

            for (const box of boxes) {
                if (box.span >= 12) {
                    flushBand();
                    box.x = 0;
                    box.y = cursor;
                    cursor += box.h;
                    placements.push(box);
                } else {
                    // A change between the two-column family (span 6) and any
                    // other split closes the band, so each run ends flush.
                    if (band.length > 0 && (band[0].span === 6) !== (box.span === 6)) flushBand();
                    band.push(box);
                }
            }
            flushBand();

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
