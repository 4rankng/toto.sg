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

/**
 * The largest shortfall the packer will hide by growing a card.
 *
 * The band planner balances most bands to the pixel, but coarse card heights
 * can leave a band with no near-equal split (e.g. a six-card band at 1024px
 * whose best split is still >100px). Growing the last card by that shortfall
 * is the only way to keep the columns flush there, so the cap sits above the
 * worst coarse case instead of creating a bare canvas well.
 */
const MAX_FLUSH_PX = 140;

/**
 * The column shortfall the planner treats as already balanced. A split within
 * this distance is closed by the small flush nudge; a planner that instead
 * minimised card moves would happily leave a 100px shortfall for the nudge to
 * paper over, which is exactly the hollow card this work removes.
 */
const SNAP_PX = 40;

interface MasonryGridProps {
    className?: string;
    children: ReactNode;
}

/**
 * Plan a two-column band: keep the cards in their reading order and find the
 * smallest set of "move this card to the other column" flips that balances
 * the two columns.
 *
 * A greedy shortest-column pass keeps the visual order but drifts by hundreds
 * of pixels on a long band; a free exact partition is gapless but scrambles
 * the card order. This is a subset-sum over the flip count: the DP minimises
 * how many cards leave the greedy side while keeping the column-height
 * difference inside the small `MAX_FLUSH_PX` nudge. Cards keep DOM order
 * inside each column.
 */
/** Visual-order inversions and height difference for one column assignment. */
const scoreAssignment = (heights: number[], left: boolean[]) => {
    const n = heights.length;
    const ys = new Array<number>(n);
    const xs = new Array<number>(n);
    let yl = 0;
    let yr = 0;
    for (let i = 0; i < n; i += 1) {
        if (left[i]) {
            ys[i] = yl;
            xs[i] = 0;
            yl += heights[i];
        } else {
            ys[i] = yr;
            xs[i] = 1;
            yr += heights[i];
        }
    }
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => ys[a] - ys[b] || xs[a] - xs[b]);
    let inversions = 0;
    for (let a = 0; a < n; a += 1) {
        for (let b = a + 1; b < n; b += 1) {
            if (order[a] > order[b]) inversions += 1;
        }
    }
    return { diff: Math.abs(yl - yr), inversions };
};

const planTwoColumnBand = (heights: number[]): boolean[] => {
    const n = heights.length;

    // Baseline: the reading order a greedy packer would produce (near-zero inversions).
    const baseline = new Array<boolean>(n);
    let leftHeight = 0;
    let rightHeight = 0;
    for (let i = 0; i < n; i += 1) {
        const goLeft = leftHeight <= rightHeight;
        baseline[i] = goLeft;
        if (goLeft) leftHeight += heights[i];
        else rightHeight += heights[i];
    }

    const total = heights.reduce((sum, h) => sum + h, 0);
    const target = Math.floor(total / 2);
    const INF = 0x3fffffff;

    // dp[s] = fewest flips that put sum s in the left column.
    let dp = new Int32Array(target + 1).fill(INF);
    dp[0] = 0;
    const parents: Uint8Array[] = [];

    for (let i = 0; i < n; i += 1) {
        const next = new Int32Array(target + 1).fill(INF);
        const take = new Uint8Array(target + 1);
        const h = heights[i];
        for (let s = 0; s <= target; s += 1) {
            if (dp[s] === INF) continue;
            // Card goes right — a flip when the baseline put it left.
            const costRight = dp[s] + (baseline[i] ? 1 : 0);
            if (costRight < next[s]) {
                next[s] = costRight;
                take[s] = 0;
            }
            // Card goes left — a flip when the baseline put it right.
            if (s + h <= target) {
                const costLeft = dp[s] + (baseline[i] ? 0 : 1);
                if (costLeft < next[s + h]) {
                    next[s + h] = costLeft;
                    take[s + h] = 1;
                }
            }
        }
        parents.push(take);
        dp = next;
    }

    // Prefer the fewest flips among splits whose shortfall the flush pass can
    // absorb; fall back to the closest split if no such split exists.
    let bestSum = -1;
    let bestFlips = INF;
    let bestDiff = INF;
    for (let s = target; s >= 0; s -= 1) {
        if (dp[s] === INF) continue;
        const diff = total - 2 * s;
        if (diff > SNAP_PX) continue;
        if (dp[s] < bestFlips || (dp[s] === bestFlips && diff < bestDiff)) {
            bestFlips = dp[s];
            bestSum = s;
            bestDiff = diff;
        }
    }
    if (bestSum < 0) {
        for (let s = target; s >= 0; s -= 1) {
            if (dp[s] !== INF) {
                bestSum = s;
                break;
            }
        }
    }

    const left = new Array<boolean>(n).fill(false);
    let remaining = bestSum;
    for (let i = n; i > 0; i -= 1) {
        if (parents[i - 1][remaining] === 1) {
            left[i - 1] = true;
            remaining -= heights[i - 1];
        }
    }

    // The subset-sum DP minimises moved cards, not reading-order inversions.
    // Walk the assignment locally: single flips and pair swaps that keep the
    // columns balanced but reduce how far the visual order drifts from the
    // numbered reading order.
    let best = left;
    let bestScore = scoreAssignment(heights, left);
    const better = (candidate: { diff: number; inversions: number }, current: { diff: number; inversions: number }) =>
        candidate.diff <= SNAP_PX &&
        (candidate.inversions < current.inversions || (candidate.inversions === current.inversions && candidate.diff < current.diff));

    for (let pass = 0; pass < 6; pass += 1) {
        let improved = false;
        for (let i = 0; i < n; i += 1) {
            const candidate = best.slice();
            candidate[i] = !candidate[i];
            const score = scoreAssignment(heights, candidate);
            if (better(score, bestScore)) {
                best = candidate;
                bestScore = score;
                improved = true;
            }
        }
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                if (best[i] === best[j]) continue;
                const candidate = best.slice();
                candidate[i] = !candidate[i];
                candidate[j] = !candidate[j];
                const score = scoreAssignment(heights, candidate);
                if (better(score, bestScore)) {
                    best = candidate;
                    bestScore = score;
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }
    return best;
};

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

                if (band.every((b) => b.span === 6)) {
                    // Two equal columns: the balanced split with the fewest
                    // cards moved out of reading order.
                    const left = planTwoColumnBand(band.map((b) => b.h));
                    let yl = base;
                    let yr = base;
                    band.forEach((b, i) => {
                        if (left[i]) {
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

                // Close the band flat where the shortfall is small: growing a
                // card a few dozen pixels reads as padding, but stretching it
                // by hundreds leaves a hollow well under its content. Large
                // shortfalls are left as a ragged column end instead.
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
                    if (deficit > 0 && deficit <= MAX_FLUSH_PX && Number.isFinite(deficit)) {
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
