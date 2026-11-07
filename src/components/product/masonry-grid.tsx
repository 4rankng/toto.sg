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
// row to close. Below `lg` the panels stack in a single column and the spans
// are cleared, leaving normal grid flow.
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
    // changes), the panels may have resized and the spans need re-measuring.
    useLayoutEffect(() => {
        const grid = ref.current;
        if (!grid) return;

        const query = window.matchMedia(COLUMNS_QUERY);
        let frame = 0;

        const panels = () => Array.from(grid.children).filter((child): child is HTMLElement => child instanceof HTMLElement);

        const pack = () => {
            frame = 0;
            const items = panels();

            if (!query.matches) {
                grid.style.gridAutoRows = "";
                grid.style.gridAutoFlow = "";
                grid.style.rowGap = "";
                for (const item of items) item.style.gridRowEnd = "";
                return;
            }

            // Measure before reshaping: every panel still reports the height its
            // content needs at the width its column span gives it. Widths do not
            // change when the spans are applied, so those heights stay valid.
            const heights = items.map((item) => item.getBoundingClientRect().height);

            grid.style.gridAutoRows = "1px";
            grid.style.gridAutoFlow = "row dense";
            grid.style.rowGap = "0px";

            // The span includes the gap, so the next panel in the same column
            // starts exactly 12px below this one.
            items.forEach((item, index) => {
                item.style.gridRowEnd = `span ${Math.ceil(heights[index]) + GAP_PX}`;
            });
        };

        const schedule = () => {
            if (frame !== 0) return;
            frame = window.requestAnimationFrame(pack);
        };

        pack();

        // Watch the container (a width change reflows every chart) and every
        // panel (a chart can re-render when the data or the hover state
        // changes). ResizeObserver only fires on size changes, and packing does
        // not alter a panel's own box, so this cannot feed back into itself.
        const observer = new ResizeObserver(schedule);
        observer.observe(grid);
        for (const item of panels()) observer.observe(item);

        // Web fonts land after first paint and can nudge the measured heights.
        document.fonts?.ready.then(schedule).catch(() => {});
        query.addEventListener("change", schedule);

        return () => {
            observer.disconnect();
            query.removeEventListener("change", schedule);
            if (frame !== 0) cancelAnimationFrame(frame);
        };
    });

    return (
        <div ref={ref} className={cx("grid items-start gap-3 lg:grid-cols-12", className)}>
            {children}
        </div>
    );
}
