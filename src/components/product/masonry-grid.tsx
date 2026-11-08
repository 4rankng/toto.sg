// Masonry layout for the Insights gallery.
//
// A plain 12-column grid sizes every row to its tallest cell, so a short panel
// that sits beside a tall one leaves a hole of page background underneath it —
// the taller neighbour holds the whole row open. Panels in the gallery are
// deliberately uneven (a 6×6 matrix next to a 7-bar histogram), so those holes
// are the rule rather than the exception.
//
// This grid keeps the same 12 tracks but packs the panels masonry-style: every
// panel spans as many 1px rows as its content needs (plus the 12px gap) and
// dense auto-placement drops the next panel into the first gap its column span
// fits. Because the row unit is one pixel, a short panel can start exactly
// where a taller neighbour in the previous row ends instead of waiting for the
// row to close.
//
// Packing alone still leaves a ragged foot (and the odd mid-row hole) wherever
// a column ends short of its neighbours. One fill pass grows the panel above
// each hole until it meets the next one — the card gets taller, its chart stays
// its own size and is centred in the extra space, and no bare page background
// is left between cards. Below `lg` the panels stack in a single column, the
// spans and the fill are cleared, and normal grid flow takes over.
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { cx } from "@/utils/cx";

/** Matches the gallery's `gap-3`: 0.75rem at a 16px root. */
const GAP_PX = 12;

/** The packing only applies once the gallery has its twelve columns. */
const COLUMNS_QUERY = "(min-width: 64rem)";


/** Ignore rounding noise when deciding whether a column really is short. */
const MIN_STRETCH_PX = 2.5;

/** Cap the fill: a stretch above this stops reading as padding and becomes a
 *  hollow card — the honest leftover stays a section-foot gap instead. */
const MAX_STRETCH_PX = 96;


interface MasonryGridProps {
    className?: string;
    children: ReactNode;
}

export function MasonryGrid({ className, children }: MasonryGridProps) {
    const ref = useRef<HTMLDivElement>(null);

    // Run after every render: if the gallery re-renders (data arrives, theme
    // changes), the panels may have resized and the spans need re-measuring.
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

        /** Drop any height the fill pass added, so the natural height is measured. */
        const unstretch = (items: HTMLElement[]) => {
            for (const item of items) item.style.minHeight = "";
        };

        const setSpans = (items: HTMLElement[]) => {
            const heights = items.map((item) => item.getBoundingClientRect().height);
            grid.style.gridAutoRows = "1px";
            grid.style.gridAutoFlow = "row dense";
            grid.style.rowGap = "0px";
            // The span includes the gap, so the next panel in the same column
            // starts exactly 12px below this one.
            items.forEach((item, index) => {
                item.style.gridRowEnd = `span ${Math.ceil(heights[index]) + GAP_PX}`;
            });
            packedState = layoutState();
        };

        /**
         * Find every column hole and give its height to the panel above it.
         * Runs on one settled layout, so stretching a short panel in a row
         * cannot move its neighbours (the row is already as tall as they are);
         * bottom panels fill to the section foot.
         */
        const fillHoles = (items: HTMLElement[]) => {
            const gridRect = grid.getBoundingClientRect();
            const colWidth = (gridRect.width - GAP_PX * 11) / 12;
            if (colWidth <= 0) return false;

            const boxes = items.map((item) => {
                const r = item.getBoundingClientRect();
                return {
                    item,
                    x: Math.round((r.left - gridRect.left) / (colWidth + GAP_PX)),
                    span: Math.max(1, Math.round((r.width + GAP_PX) / (colWidth + GAP_PX))),
                    top: r.top - gridRect.top,
                    bottom: r.bottom - gridRect.top,
                    height: r.height,
                };
            });

            const gridBottom = Math.max(...boxes.map((box) => box.bottom));
            let changed = false;

            for (const box of boxes) {
                // The smallest free room across the box's columns is what it can
                // take without pushing into the panel below it.
                let room = Number.POSITIVE_INFINITY;
                for (let c = box.x; c < box.x + box.span; c += 1) {
                    let nextTop = Number.POSITIVE_INFINITY;
                    for (const other of boxes) {
                        if (other === box || c < other.x || c >= other.x + other.span) continue;
                        if (other.top >= box.bottom - 1 && other.top < nextTop) nextTop = other.top;
                    }
                    // A panel at the foot of a column fills to the section foot;
                    // one with a panel below it stops one gap short.
                    const ceiling = Number.isFinite(nextTop) ? nextTop - GAP_PX : gridBottom;
                    room = Math.min(room, ceiling - box.bottom);
                }

                if (room <= MIN_STRETCH_PX) continue;
                // Grow the card only, and only by a pad-sized amount; its header
                // and chart keep their places and the extra height reads as
                // padding at the foot of the panel, never a hollow card.
                box.item.style.minHeight = `${Math.ceil(box.height + Math.min(room, MAX_STRETCH_PX))}px`;
                changed = true;
            }

            return changed;
        };

        /**
         * Pack, fill and re-span in one synchronous pass. Reading offsetHeight
         * between the writes forces the intermediate layouts, so every
         * measurement sees a settled grid and a late chart re-render can never
         * be folded into a half-built packing.
         */
        const run = () => {
            frame = 0;
            if (disposed) return;
            const items = panels();

            if (!query.matches) {
                unstretch(items);
                grid.style.gridAutoRows = "";
                grid.style.gridAutoFlow = "";
                grid.style.rowGap = "";
                for (const item of items) item.style.gridRowEnd = "";
                packedState = layoutState();
                return;
            }

            unstretch(items);
            void grid.offsetHeight;
            setSpans(items);
            void grid.offsetHeight;
            if (fillHoles(items)) {
                setSpans(items);
                void grid.offsetHeight;
            }
            packedState = layoutState();
        };

        const request = () => {
            if (disposed || frame !== 0) return;
            // The spans are still valid for what is on screen — our own fill
            // pass echoes here, and must not rebuild itself forever.
            if (layoutState() === packedState) return;
            frame = window.requestAnimationFrame(run);
        };

        run();

        // A resize or a chart re-measuring itself changes a panel's box; repack
        // when the layout the spans were built from is no longer current.
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
