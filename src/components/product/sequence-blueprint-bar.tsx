// toto.sg — clickable ball chip for the insights indicator panels.
//
// Bound to LineBuilderProvider (`useLineBuilder()`): tapping a chip toggles
// that ball in the shared line, which the home page's play slip renders.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, ChevronRight, MagicWand01, Trash02 } from "@untitledui/icons";
import { useJson } from "@/lib/data";
import type { Draw } from "@/lib/data";
import {
    computeHawkesPointProcessStats,
    computeSubgraphCohesionStats,
    evaluateCandidateSequenceDeepScan,
    mahalanobisD2,
} from "@/lib/insights-sequence-dynamics";
import { evaluateCandidateLineEnvelope } from "@/lib/insights-sequence-blueprint";
import { LINE_SIZES, useLineBuilder } from "@/providers/line-builder-provider";
import type { LineSize } from "@/providers/line-builder-provider";
import { cx } from "@/utils/cx";

interface CandidateBallChipProps {
    number: number;
    sublabel?: string;
    score?: string | number;
    rank?: number;
    className?: string;
}

export function CandidateBallChip({
    number,
    sublabel,
    score,
    rank,
    className,
}: CandidateBallChipProps) {
    const { line, toggle } = useLineBuilder();
    const isSelected = line.includes(number);

    return (
        <button
            type="button"
            onClick={() => toggle(number)}
            title={`Toggle ball ${number} in sequence builder`}
            className={cx(
                "group relative inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-xs transition-all",
                isSelected
                    ? "border-primary bg-accent text-white dark:text-canvas shadow-sm"
                    : "border-line bg-surface hover:border-primary hover:bg-surface-2 text-ink",
                className,
            )}
        >
            {rank !== undefined && (
                <span
                    className={cx(
                        "text-[9px] font-bold uppercase",
                        isSelected ? "text-white/80 dark:text-canvas/80" : "text-ink-subtle",
                    )}
                >
                    #{rank}
                </span>
            )}
            <span className="font-bold tabular-nums">{number}</span>
            {score !== undefined && (
                <span
                    className={cx(
                        "text-[10px] tabular-nums",
                        isSelected ? "text-white/90 dark:text-canvas/90" : "text-ink-muted",
                    )}
                >
                    {score}
                </span>
            )}
            {sublabel && (
                <span
                    className={cx(
                        "text-[9px]",
                        isSelected ? "text-white/80 dark:text-canvas/80" : "text-ink-subtle",
                    )}
                >
                    {sublabel}
                </span>
            )}
        </button>
    );
}

/* ------------------------------------------------------------------ *
 * The Live Sequence Blueprint Workbench
 * ------------------------------------------------------------------ */

/** One one-tap preset: a name, a short note, and the six balls it loads. */
interface BlueprintPreset {
    id: string;
    label: string;
    note: string;
    line: number[];
}

interface SequenceBlueprintWorkbenchProps {
    /**
     * The archive the presets read. When omitted the workbench fetches
     * /data/draws.json itself, so it stays usable outside /insights.
     */
    draws?: Draw[];
    /** The latest draw — the envelope evaluator reads it for the repeater filter. */
    latestDraw?: Draw;
    /** The 8-signal confluence line, when the page has already computed it. */
    confluenceLine?: number[];
}

/**
 * The six balls closest to the order-statistic mean vector mu — the
 * "centroid" of the 6/49 line space. A greedy assignment followed by a
 * short swap refinement, so the result really does minimise D^2.
 */
const mahalanobisCentroidLine = (): number[] => {
    const targets = [7.14, 14.29, 21.43, 28.57, 35.71, 42.86];
    const used = new Set<number>();
    const line: number[] = [];

    for (const target of targets) {
        let best = -1;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let ball = 1; ball <= 49; ball += 1) {
            if (used.has(ball)) continue;
            const distance = Math.abs(ball - target);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = ball;
            }
        }
        used.add(best);
        line.push(best);
    }

    // Swap refinement: try every replacement that lowers the distance.
    let current = mahalanobisD2(line);
    for (let pass = 0; pass < 3; pass += 1) {
        let improved = false;
        for (let slot = 0; slot < line.length; slot += 1) {
            for (let candidate = 1; candidate <= 49; candidate += 1) {
                if (line.includes(candidate)) continue;
                const trial = [...line];
                trial[slot] = candidate;
                const score = mahalanobisD2(trial);
                if (score < current - 1e-9) {
                    line[slot] = candidate;
                    current = score;
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }

    return [...line].sort((a, b) => a - b);
};

/** The six balls with the strongest positive co-occurrence cohesion. */
const subgraphCliqueLine = (draws: Draw[]): number[] => {
    const cohesion = computeSubgraphCohesionStats(draws);
    const latest = cohesion.rows[cohesion.rows.length - 1];
    if (!latest) return [];

    // The pair Z table is rebuilt from the same trailing window the panel uses.
    const window = draws.slice(-250);
    const counts = new Map<string, number>();
    for (const draw of window) {
        const sorted = [...draw.numbers].sort((a, b) => a - b);
        for (let i = 0; i < sorted.length; i += 1) {
            for (let j = i + 1; j < sorted.length; j += 1) {
                const key = `${sorted[i]}-${sorted[j]}`;
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }
    }
    const expected = (window.length * 15) / 1176;
    const sd = Math.sqrt(Math.max(1e-9, window.length * (15 / 1176) * (1 - 15 / 1176)));
    const zOf = (a: number, b: number) => {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        return ((counts.get(key) ?? 0) - expected) / sd;
    };

    const chosen: number[] = [];
    while (chosen.length < 6) {
        let best = -1;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (let ball = 1; ball <= 49; ball += 1) {
            if (chosen.includes(ball)) continue;
            const score = chosen.reduce((acc, picked) => acc + Math.max(0, zOf(picked, ball)), 0);
            if (score > bestScore) {
                bestScore = score;
                best = ball;
            }
        }
        if (best === -1) break;
        chosen.push(best);
    }

    return [...chosen].sort((a, b) => a - b);
};

/**
 * The sticky console bar that turns any ball tapped anywhere on /insights
 * into a fully diagnosed candidate sequence: the 8-filter envelope verdict,
 * six deep sequence metrics, four archive-derived presets and a hand-off to
 * the play slip.
 */
export function SequenceBlueprintWorkbench({ draws, latestDraw, confluenceLine }: SequenceBlueprintWorkbenchProps) {
    const { line, size, setSize, setLine, clear } = useLineBuilder();
    const navigate = useNavigate();

    const [collapsed, setCollapsed] = useState(false);
    const [scanOpen, setScanOpen] = useState(false);

    // The archive: the page's own copy when it has one, a fetch otherwise.
    const { data: fetchedDraws } = useJson<Draw[]>("/data/draws.json");
    const archive = draws ?? fetchedDraws ?? [];

    const sortedLine = useMemo(() => [...line].sort((a, b) => a - b), [line]);
    const core = sortedLine.slice(0, 6);

    const envelope = useMemo(() => evaluateCandidateLineEnvelope(core, latestDraw), [core, latestDraw]);
    const deepScan = useMemo(() => evaluateCandidateSequenceDeepScan(core, archive), [core, archive]);

    const presets = useMemo<BlueprintPreset[]>(() => {
        if (archive.length === 0) return [];

        const hawkes = computeHawkesPointProcessStats(archive);
        const hawkesLine = [...hawkes.rows].sort((a, b) => b.intensity - a.intensity).slice(0, 6).map((row) => row.ball).sort((a, b) => a - b);

        const clique = subgraphCliqueLine(archive);
        const centroid = mahalanobisCentroidLine();

        const confluence = confluenceLine && confluenceLine.length > 0 ? [...confluenceLine].sort((a, b) => a - b) : [];

        return [
            {
                id: "confluence",
                label: "8-Signal Confluence",
                note: "the eight live signals agree",
                line: confluence.length > 0 ? confluence : centroid,
            },
            {
                id: "hawkes",
                label: "Hawkes Intensity Top-6",
                note: "the six hottest self-exciting balls",
                line: hawkesLine,
            },
            {
                id: "mahalanobis",
                label: "Mahalanobis Centroid",
                note: "the six balls nearest the order-statistic mean",
                line: centroid,
            },
            {
                id: "clique",
                label: "Subgraph Clique",
                note: "the six strongest co-occurring balls",
                line: clique.length > 0 ? clique : centroid,
            },
        ];
    }, [archive, confluenceLine]);

    const verdictTone =
        envelope.verdict === "Optimal Sweet-Spot"
            ? "text-success-primary"
            : envelope.verdict === "Extreme Tail"
              ? "text-warning-primary"
              : "text-secondary";

    return (
        <section
            aria-label="Live sequence blueprint workbench"
            className="sticky top-2 z-30 flex flex-col gap-2 rounded-lg border border-line bg-surface/95 p-2.5 shadow-float backdrop-blur-sm"
        >
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setCollapsed((prev) => !prev)}
                    aria-expanded={!collapsed}
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-semibold text-ink transition-colors duration-100 hover:text-accent"
                >
                    {collapsed ? <ChevronRight aria-hidden="true" className="size-3.5" /> : <ChevronDown aria-hidden="true" className="size-3.5" />}
                    Sequence Blueprint Workbench
                </button>

                <span className="font-mono text-[10px] text-ink-subtle tabular-nums">
                    {line.length} / {size} balls
                </span>

                {!collapsed && (
                    <>
                        {/* The System 6 | 7 | 8 switcher */}
                        <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-line bg-surface-2 p-0.5">
                            {LINE_SIZES.map((option: LineSize) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setSize(option)}
                                    aria-pressed={size === option}
                                    className={cx(
                                        "cursor-pointer rounded px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors duration-100",
                                        size === option
                                            ? "bg-primary-soft text-primary"
                                            : "text-ink-muted hover:text-ink",
                                    )}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>

                        {/* The sorted active balls */}
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                            {sortedLine.length === 0 ? (
                                <span className="text-[11px] text-ink-subtle italic">
                                    Tap any ball chip on a panel to start a line.
                                </span>
                            ) : (
                                sortedLine.map((ball, index) => (
                                    <span
                                        key={ball}
                                        className="inline-flex items-center gap-1 rounded-md border border-primary bg-accent px-1.5 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums dark:text-canvas"
                                    >
                                        {ball}
                                        <span className="text-[9px] font-normal opacity-70">#{index + 1}</span>
                                    </span>
                                ))
                            )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                            <button
                                type="button"
                                onClick={clear}
                                disabled={line.length === 0}
                                className="flex cursor-pointer items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-muted transition-colors duration-100 hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Trash02 aria-hidden="true" className="size-3.5" />
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate("/")}
                                disabled={line.length === 0}
                                className="rounded-md border border-primary bg-primary-soft px-2 py-1 text-[11px] font-semibold text-primary transition-colors duration-100 hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Open in Play Slip →
                            </button>
                        </div>
                    </>
                )}
            </div>

            {!collapsed && (
                <>
                    {/* The one-tap presets */}
                    {presets.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-2">
                            <span className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
                                <MagicWand01 aria-hidden="true" className="size-3" />
                                Presets
                            </span>
                            {presets.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setLine(preset.line)}
                                    title={preset.note}
                                    className="cursor-pointer rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink transition-colors duration-100 hover:border-primary hover:text-primary"
                                >
                                    {preset.label}
                                    <span className="ml-1.5 font-mono text-[10px] font-normal text-ink-subtle">
                                        {preset.line.join(" ")}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* The deep-scan drawer */}
                    <div className="border-t border-line/60 pt-2">
                        <button
                            type="button"
                            onClick={() => setScanOpen((prev) => !prev)}
                            aria-expanded={scanOpen}
                            className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
                        >
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
                                {scanOpen ? <ChevronDown aria-hidden="true" className="size-3.5" /> : <ChevronRight aria-hidden="true" className="size-3.5" />}
                                Live Sequence Deep-Scan
                            </span>
                            <span className="flex items-center gap-2">
                                <span className={cx("font-mono text-[10px] font-semibold", verdictTone)}>{envelope.verdict}</span>
                                <span className="font-mono text-[10px] text-ink-subtle tabular-nums">
                                    {envelope.totalPassed}/8 filters
                                </span>
                            </span>
                        </button>

                        {scanOpen && (
                            <div className="mt-2 grid gap-3 lg:grid-cols-2">
                                {/* The eight envelope filters */}
                                <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2 p-2.5">
                                    <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
                                        8-filter envelope
                                    </p>
                                    {envelope.filters.map((filter) => (
                                        <div key={filter.id} className="flex items-baseline justify-between gap-2 border-b border-line/50 pb-1 last:border-b-0">
                                            <span className="text-[11px] text-ink-muted">{filter.label}</span>
                                            <span className="flex items-baseline gap-2">
                                                <span className="font-mono text-[11px] font-semibold text-ink tabular-nums">{filter.currentValue}</span>
                                                <span className="font-mono text-[10px] text-ink-subtle tabular-nums">{filter.targetRange}</span>
                                                <span
                                                    className={cx(
                                                        "font-mono text-[10px] font-bold",
                                                        filter.passed ? "text-success-primary" : "text-heat-hot",
                                                    )}
                                                >
                                                    {filter.passed ? "PASS" : "MISS"}
                                                </span>
                                            </span>
                                        </div>
                                    ))}
                                    {envelope.adjustments.length > 0 && (
                                        <ul className="mt-1 flex flex-col gap-1">
                                            {envelope.adjustments.slice(0, 4).map((adjustment) => (
                                                <li key={adjustment} className="text-[10px] leading-4 text-ink-muted">
                                                    · {adjustment}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* The six deep sequence metrics */}
                                <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2 p-2.5">
                                    <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
                                        Sequence deep-scan
                                    </p>
                                    {deepScan.isReady ? (
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                            <DeepMetric label="Mahalanobis D²" value={deepScan.mahalanobisD2.toFixed(2)} hint={`${deepScan.mahalanobisTypicalPct.toFixed(0)}% typical`} />
                                            <DeepMetric label="Curvature κ" value={deepScan.curvatureKappa.toFixed(2)} hint={deepScan.curvatureRegime} />
                                            <DeepMetric label="Zigzag flips" value={`${deepScan.zigzagFlips} / 3`} hint="sign flips" />
                                            <DeepMetric label="Sidon |A+A|" value={`${deepScan.sidonSumset} / 21`} hint={`${deepScan.sidonCollisions} collisions`} />
                                            <DeepMetric label="MST length" value={deepScan.mstLength.toFixed(2)} hint={`gyration ${deepScan.gyrationRadius.toFixed(2)}`} />
                                            <DeepMetric label="Coprime pairs" value={`${deepScan.coprimePairs} / 15`} hint={`torus gap ${deepScan.torusMaxGap}`} />
                                            <DeepMetric label="Sub-graph pair Z" value={deepScan.subgraphPairZ.toFixed(2)} hint="internal cohesion" />
                                            <DeepMetric label="Markov lift" value={`${deepScan.incomingMarkovLift}`} hint="lag-1 incoming" />
                                            <DeepMetric label="Union-5 carry" value={`${deepScan.union5Carry}`} hint="recycled" />
                                            <DeepMetric label="Union-5 fresh" value={`${deepScan.union5Fresh}`} hint="cold pool" />
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-ink-subtle italic">
                                            Select six or more balls to scan the sequence geometry.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}

/** One metric inside the deep-scan drawer. */
function DeepMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
    return (
        <div className="min-w-0">
            <p className="font-mono text-[9px] leading-3 font-semibold tracking-[0.12em] text-ink-subtle uppercase">{label}</p>
            <p className="font-mono text-[12px] leading-4 font-semibold text-ink tabular-nums">{value}</p>
            <p className="truncate text-[9px] leading-3 text-ink-subtle">{hint}</p>
        </div>
    );
}
