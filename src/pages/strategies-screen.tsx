import { useEffect, useMemo, useState } from "react";
import { Award01, Calendar, ChevronDown, ChevronRight, Coins01, Grid01 } from "@untitledui/icons";
import { Ball } from "@/components/balls";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Panel } from "@/components/panel";
import { FamilyChip } from "@/components/product/family-chip";
import { KpiCard } from "@/components/product/kpi-card";
import { PageHeader } from "@/components/product/page-header";
import { RecentHits } from "@/components/product/recent-hits";
import { DataLoading, PageHeaderSkeleton, RowsSkeleton } from "@/components/product/skeleton";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { type StrategiesFile, type StrategyRow, formatDate, formatNumber, formatSigned, useJson } from "@/lib/data";
import { usePageTitle } from "@/pages/layout";
import { cx } from "@/utils/cx";

type SortKey = "score" | "prizes";

const SORTS: { id: SortKey; label: string }[] = [
    { id: "score", label: "Score" },
    { id: "prizes", label: "Prizes" },
];

const LeagueSkeleton = () => (
    <DataLoading label="Loading the strategies">
        <PageHeaderSkeleton />
        <RowsSkeleton count={10} />
    </DataLoading>
);

/** The expanded body of a strategy. */
const StrategyDetail = ({ row, className }: { row: StrategyRow; className?: string }) => (
    <div className={cx("min-w-0", className)}>
        <div className="max-w-3xl">
            <p className="text-[13px] leading-5 text-ink-muted">{row.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <FamilyChip family={row.family} />
                <span className="font-mono text-[11px] text-ink-subtle tabular-nums">{row.id}</span>
            </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 lg:grid-cols-8">
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
                <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{formatNumber(row.totalPrizes)}</dd>
            </div>
            <div>
                <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Matched, last 12 draws</dt>
                <dd className="mt-0.5">
                    <RecentHits hits={row.recent12} draws={12} expectedPerLine={row.expectedHits} />
                </dd>
            </div>
            <div>
                <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Profit per draw</dt>
                <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{formatSigned(row.pnlPerDraw, 2)}</dd>
            </div>
            <div>
                <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Score</dt>
                <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{row.score.toFixed(1)}</dd>
            </div>
        </dl>
    </div>
);

export const StrategiesScreen = () => {
    const [title, setTitle] = useState("Strategy league");
    usePageTitle(title);

    const { data, isLoading, error } = useJson<StrategiesFile>("/data/strategies.json");
    // Phones get the large control size so every filter stays tappable.
    const isCompact = !useBreakpoint("md");
    const [query, setQuery] = useState("");
    const [family, setFamily] = useState("all");
    const [sort, setSort] = useState<SortKey>("score");
    const [expanded, setExpanded] = useState<string | null>(null);

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

        const value = (row: StrategyRow) => (sort === "prizes" ? row.effPrizes : row.score);
        return [...filtered].sort((a, b) => value(b) - value(a));
    }, [data, query, family, sort]);

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
        <div className="flex flex-wrap items-center gap-1.5">
            <Input
                value={query}
                onChange={(value) => {
                    setQuery(value);
                    setExpanded(null);
                }}
                placeholder="Search strategies"
                size={isCompact ? "lg" : "sm"}
                className="w-44"
                aria-label="Search strategies"
            />
            <Select
                items={familyOptions}
                selectedKey={family}
                onSelectionChange={(key) => {
                    setFamily(String(key));
                    setExpanded(null);
                }}
                placeholder="All types"
                size={isCompact ? "lg" : "sm"}
                className="w-36"
                aria-label="Filter by type"
            >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
            <div role="group" aria-label="Sort strategies" className="flex items-center gap-0.5 rounded-lg bg-surface-inset p-0.5">
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
                description="204 strategies, each tested on 100 past draws. A score of 45 is random picking; higher means more numbers matched. Past results, not predictions."
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
                description={`${rows.length} of ${data.strategies.length} · the six numbers each strategy would play for draw ${meta.nextDraw} · a prize needs 3 or more matches`}
                actions={filters}
            >
                <ol className="divide-y divide-line-soft">
                    {rows.map((row) => {
                        const isOpen = expanded === row.id;

                        return (
                            <li key={row.id} className={cx("transition-colors duration-100", isOpen && "bg-surface-2/50")}>
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
                                        <span className="w-16 shrink-0 text-right font-mono text-[11px] text-ink-subtle tabular-nums">{row.effPrizes} prizes</span>
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
                                        <StrategyDetail row={row} />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>

                {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-muted">No strategy matches that filter.</p>}
            </Panel>

            <p className="px-1 text-[11px] leading-4 text-ink-subtle">
                Every line has the same chance of Group 1: <span className="font-mono text-ink-muted tabular-nums">1 in 13,983,816</span>. The score describes
                100 past draws. It does not predict the next draw. Play for entertainment, never to recover a loss.
            </p>
        </div>
    );
};
