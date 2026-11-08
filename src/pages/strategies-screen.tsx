import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Award01, Calendar, ChevronDown, ChevronRight, Coins01, Grid01 } from "@untitledui/icons";
import { useNavigate, useSearchParams } from "react-router";
import { Ball } from "@/components/balls";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Panel } from "@/components/panel";
import { FamilyChip } from "@/components/product/family-chip";
import { KpiCard } from "@/components/product/kpi-card";
import { PageHeader } from "@/components/product/page-header";
import { RecentHits } from "@/components/product/recent-hits";
import { DataLoading, PageHeaderSkeleton, RowsSkeleton } from "@/components/product/skeleton";
import { type Draw, type StrategiesFile, type StrategyRow, formatDate, formatNumber, formatSgd, formatSigned, useJson } from "@/lib/data";
import { ballPayoutStats, type BallPayoutStats } from "@/lib/insights-correlations";
import { lineAcValue } from "@/lib/ticket-xray";
import { usePageTitle } from "@/pages/layout";
import { useLineBuilder } from "@/providers/line-builder-provider";
import { cx } from "@/utils/cx";

type SortKey = "score" | "hits" | "prizes" | "recent12" | "g3Ev";

const SORTS: { id: SortKey; label: string }[] = [
    { id: "score", label: "Score" },
    { id: "hits", label: "Hits" },
    { id: "prizes", label: "Prizes" },
    { id: "recent12", label: "Recent 12" },
    { id: "g3Ev", label: "G3 EV" },
];

const strategyG3Ev = (row: StrategyRow, ballPayouts: BallPayoutStats | null) => {
    if (!ballPayouts || !row.currentPick.length) return 0;
    const sumDelta = row.currentPick.reduce((acc, n) => {
        const ballRow = ballPayouts.rows[n - 1];
        return acc + (ballRow?.deltaVsEra ?? 0);
    }, 0);
    return Math.round(sumDelta / row.currentPick.length);
};

const strategyMeanG3 = (row: StrategyRow, ballPayouts: BallPayoutStats | null) => {
    if (!ballPayouts || !row.currentPick.length) return 1750;
    const sumG3 = row.currentPick.reduce((acc, n) => {
        const ballRow = ballPayouts.rows[n - 1];
        return acc + (ballRow?.meanG3 ?? 1750);
    }, 0);
    return Math.round(sumG3 / row.currentPick.length);
};

const LeagueSkeleton = () => (
    <DataLoading label="Loading the strategies">
        <PageHeaderSkeleton />
        <RowsSkeleton count={10} />
    </DataLoading>
);

/** The expanded body of a strategy with Ticket X-Ray diagnostics. */
const StrategyDetail = ({
    row,
    ballPayouts,
    onLoadInPlaySlip,
    className,
}: {
    row: StrategyRow;
    ballPayouts: BallPayoutStats | null;
    onLoadInPlaySlip: (numbers: number[]) => void;
    className?: string;
}) => {
    const sorted = [...row.currentPick].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const ac = lineAcValue(sorted);
    const span = sorted.length > 0 ? sorted[sorted.length - 1] - sorted[0] : 0;
    const bdays = sorted.filter((n) => n <= 31).length;
    const estG3 = strategyMeanG3(row, ballPayouts);
    const g3Delta = strategyG3Ev(row, ballPayouts);

    return (
        <div className={cx("min-w-0 flex flex-col gap-3", className)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                    <p className="text-[13px] leading-5 text-ink-muted">{row.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <FamilyChip family={row.family} />
                        <span className="font-mono text-[11px] text-ink-subtle tabular-nums">{row.id}</span>
                    </div>
                </div>
                <Button
                    color="secondary"
                    size="sm"
                    iconTrailing={ArrowRight}
                    onPress={() => onLoadInPlaySlip(row.currentPick)}
                    className="shrink-0"
                >
                    Load in Play Slip →
                </Button>
            </div>

            {/* Current Pick X-Ray Diagnostic Badges */}
            <div className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">
                        Current Pick X-Ray Diagnostics
                    </p>
                    <span className="font-mono text-[10px] text-ink-subtle">
                        {sorted.join(" · ")}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div className="rounded border border-line-soft bg-surface px-2 py-1 text-center">
                        <p className="text-[10px] text-ink-subtle uppercase">Sum</p>
                        <p className="font-mono text-xs font-semibold text-ink tabular-nums">{sum}</p>
                    </div>
                    <div className="rounded border border-line-soft bg-surface px-2 py-1 text-center">
                        <p className="text-[10px] text-ink-subtle uppercase">AC Value</p>
                        <p className="font-mono text-xs font-semibold text-primary tabular-nums">{ac} / 10</p>
                    </div>
                    <div className="rounded border border-line-soft bg-surface px-2 py-1 text-center">
                        <p className="text-[10px] text-ink-subtle uppercase">Span</p>
                        <p className="font-mono text-xs font-semibold text-ink tabular-nums">{span}</p>
                    </div>
                    <div className="rounded border border-line-soft bg-surface px-2 py-1 text-center">
                        <p className="text-[10px] text-ink-subtle uppercase">Birthday ≤31</p>
                        <p className={cx("font-mono text-xs font-semibold tabular-nums", bdays >= 5 ? "text-heat-hot" : "text-ink")}>{bdays} / 6</p>
                    </div>
                    <div className="col-span-2 rounded border border-line-soft bg-surface px-2 py-1 text-center sm:col-span-1">
                        <p className="text-[10px] text-ink-subtle uppercase">Est. G3 Share</p>
                        <p className={cx("font-mono text-xs font-semibold tabular-nums", g3Delta >= 0 ? "text-primary" : "text-heat-hot")}>
                            {formatSgd(estG3)} ({g3Delta >= 0 ? "+" : ""}{g3Delta})
                        </p>
                    </div>
                </div>
            </div>

            {/* Backtest League Math */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Draws tested</dt>
                    <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{formatNumber(row.evaluatedDraws)}</dd>
                </div>
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Numbers matched</dt>
                    <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{row.totalHits}</dd>
                </div>
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Matched per draw</dt>
                    <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{row.meanHits.toFixed(3)}</dd>
                </div>
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Random pick average</dt>
                    <dd className="mt-0.5 font-mono text-sm text-ink-muted tabular-nums">{row.expectedHits.toFixed(3)}</dd>
                </div>
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Prizes</dt>
                    <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{formatNumber(row.totalPrizes ?? 0)}</dd>
                </div>
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Matched, last 12 draws</dt>
                    <dd className="mt-0.5">
                        <RecentHits hits={row.recent12 ?? 0} draws={12} expectedPerLine={row.expectedHits} />
                    </dd>
                </div>
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Profit per draw</dt>
                    <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{formatSigned(row.pnlPerDraw ?? 0, 2)}</dd>
                </div>
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Score</dt>
                    <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{row.score.toFixed(1)}</dd>
                </div>
            </dl>
        </div>
    );
};


export const StrategiesScreen = () => {
    const [title, setTitle] = useState("Strategy league");
    usePageTitle(title);

    const navigate = useNavigate();
    const { setLine } = useLineBuilder();

    const { data, isLoading, error } = useJson<StrategiesFile>("/data/strategies.json");
    const { data: draws } = useJson<Draw[]>("/data/draws.json");
    const ballPayouts = useMemo(() => (draws ? ballPayoutStats(draws) : null), [draws]);

    const handleLoadInPlaySlip = (numbers: number[]) => {
        setLine(numbers);
        navigate("/");
    };

    const [searchParams, setSearchParams] = useSearchParams();
    const [query, setQuery] = useState("");
    const [family, setFamily] = useState("all");
    const [sort, setSort] = useState<SortKey>("score");
    const [expanded, setExpanded] = useState<string | null>(null);
    // The family the page has already reacted to. A family the page set
    // itself must not close the row it just opened.
    const appliedFamily = useRef<string | null>(null);

    // A link from an Insights panel arrives with ?family=… — open on that family.
    const requestedFamily = searchParams.get("family");
    useEffect(() => {
        if (!requestedFamily) return;
        // Only honour a family the league actually has; an unknown one would
        // leave the filter pointing at nothing.
        if (!data?.meta.families.includes(requestedFamily)) return;
        if (appliedFamily.current === requestedFamily) return;
        appliedFamily.current = requestedFamily;
        setFamily(requestedFamily);
        setExpanded(null);
    }, [requestedFamily, data]);

    // The league's size is part of the page title, and it changes with the data.
    useEffect(() => {
        if (data) setTitle(`Strategy league — ${data.strategies.length} strategies vs random`);
    }, [data]);

    const familyOptions = useMemo(
        () => [{ id: "all", label: "All types" }, ...(data?.meta.families ?? []).map((name) => ({ id: name, label: name }))],
        [data],
    );

    const rows = useMemo(() => {
        if (!data) return [];
        const needle = query.trim().toLowerCase();

        const filtered = data.strategies.filter((row) => {
            if (family !== "all" && row.family !== family) return false;
            if (!needle) return true;
            return row.name.toLowerCase().includes(needle) || row.id.toLowerCase().includes(needle) || row.description.toLowerCase().includes(needle);
        });

        const value = (row: StrategyRow) => {
            switch (sort) {
                case "prizes":
                    return row.effPrizes;
                case "hits":
                    return row.totalHits;
                case "recent12":
                    return row.recent12 ?? 0;
                case "g3Ev":
                    return strategyG3Ev(row, ballPayouts);
                case "score":
                default:
                    return row.score;
            }
        };
        return [...filtered].sort((a, b) => value(b) - value(a));
    }, [data, query, family, sort, ballPayouts]);



    if (isLoading) return <LeagueSkeleton />;

    if (error || !data) {
        return (
            <Panel title="Strategy league unavailable" description={error?.message ?? "The league file is missing."}>
                <p className="text-sm text-ink-muted">Run `npm run refresh`, then reload.</p>
            </Panel>
        );
    }

    const { meta } = data;
    const toggle = (id: string) => setExpanded((current) => (current === id ? null : id));

    const filters = (
        <div className="scrollbar-hide flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto sm:w-auto">
            <Input
                value={query}
                onChange={(value) => {
                    setQuery(value);
                    setExpanded(null);
                }}
                placeholder="Search"
                size="sm"
                className="min-w-28 flex-1 sm:w-40 sm:flex-none"
                aria-label="Search strategies"
            />
            <Select
                items={familyOptions}
                selectedKey={family}
                onSelectionChange={(key) => {
                    const next = String(key);
                    appliedFamily.current = next;
                    setFamily(next);
                    setExpanded(null);
                    setSearchParams(next === "all" ? {} : { family: next }, { replace: true });
                }}
                placeholder="All types"
                size="sm"
                className="w-28 shrink-0"
                aria-label="Filter by type"
            >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
            <div role="group" aria-label="Sort strategies" className="flex shrink-0 items-center gap-0.5 rounded-lg bg-surface-inset p-0.5">
                {SORTS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={sort === option.id}
                        onClick={() => setSort(option.id)}
                        className={cx(
                            "min-h-8 rounded-md px-2 text-[11px] font-semibold transition-colors duration-100",
                            sort === option.id ? "bg-surface text-ink shadow-xs ring-1 ring-line/70" : "text-ink-subtle hover:text-ink",
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-3">
            <PageHeader
                kicker="Strategies"
                title="Strategy league"
                description={`Score of 45 is chance. Matches count only when at least two numbers hit.`}
                meta={
                    <>
                        <span>
                            <span className="font-mono text-ink-muted tabular-nums">{formatNumber(data.strategies.length)}</span> strategies
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{meta.folds} draws each</span>
                        <span aria-hidden="true">·</span>
                        <span>Updated {formatDate(meta.generatedAt.slice(0, 10))}</span>
                    </>
                }
            />

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <KpiCard label="Strategies" value={formatNumber(data.strategies.length)} hint={`${meta.folds} draws each`} icon={Grid01} tone="primary" />
                <KpiCard
                    label="Top score"
                    value={data.strategies.reduce((best, row) => Math.max(best, row.score), 0).toFixed(1)}
                    hint={[...data.strategies].sort((a, b) => b.score - a.score)[0]?.name}
                    icon={Award01}
                    tone="gold"
                />
                <KpiCard label="Prizes / 100" value={meta.chance.prizesPer100Draws.toFixed(1)} hint="random picks" icon={Coins01} tone="secondary" />
                <KpiCard label="Next draw" value={meta.nextDraw} hint="picks below" icon={Calendar} tone="neutral" />
            </div>



            <Panel
                isFlush
                title="All strategies"
                description={`${rows.length} of ${data.strategies.length} · picks for draw ${meta.nextDraw}`}
                actions={filters}
            >
                <ol className="grid grid-cols-1 gap-px bg-line-soft xl:grid-cols-2">
                    {rows.map((row) => {
                        const isOpen = expanded === row.id;

                        return (
                            <li key={row.id} className={cx("bg-surface transition-colors duration-100", isOpen && "bg-surface-2/50")}>
                                <button
                                    type="button"
                                    aria-expanded={isOpen}
                                    onClick={() => toggle(row.id)}
                                    className="group flex w-full flex-col gap-1.5 px-4 py-2.5 text-left transition-colors duration-100 hover:bg-surface-2/60"
                                >
                                    {/* Line 1 — identity, score and the stat. */}
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <span className="w-6 shrink-0 text-right font-mono text-[11px] text-ink-subtle tabular-nums">{row.rank}</span>
                                        {isOpen ? (
                                            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
                                        ) : (
                                            <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
                                        )}
                                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink group-hover:text-accent">{row.name}</span>
                                        <span className="hidden shrink-0 text-[10px] text-ink-subtle sm:inline">{row.family}</span>
                                        <span className="shrink-0 font-mono text-[13px] font-semibold text-ink tabular-nums">{row.score.toFixed(1)}</span>
                                        <span className="w-20 shrink-0 text-right font-mono text-[11px] text-ink-subtle tabular-nums">
                                            {sort === "recent12"
                                                ? `${row.recent12 ?? 0} (L12)`
                                                : sort === "g3Ev"
                                                  ? `${strategyG3Ev(row, ballPayouts) >= 0 ? "+" : ""}${strategyG3Ev(row, ballPayouts)} G3`
                                                  : sort === "hits"
                                                    ? `${row.totalHits} hits`
                                                    : `${row.effPrizes} prizes`}
                                        </span>
                                    </span>

                                    {/* Line 2 — the sequence, on its own line, at full size. */}
                                    <span className="flex flex-wrap items-center gap-1 pl-8">
                                        {row.currentPick.map((n) => (
                                            <Ball key={n} n={n} size="lg" />
                                        ))}
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="border-t border-line-soft bg-surface-2/40 px-4 py-3">
                                        <StrategyDetail
                                            row={row}
                                            ballPayouts={ballPayouts}
                                            onLoadInPlaySlip={handleLoadInPlaySlip}
                                        />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>

                {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-muted">No strategy matches that filter.</p>}
            </Panel>

            <p className="px-1 text-[11px] leading-4 text-ink-subtle">
                Every line has the same Group 1 chance: <span className="font-mono text-ink-muted tabular-nums">1 in 13,983,816</span>.
            </p>
        </div>
    );
};
