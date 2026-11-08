import { useEffect, useMemo, useRef, useState } from "react";
import { Award01, Calendar, ChevronDown, ChevronRight, Coins01, Grid01 } from "@untitledui/icons";
import { useSearchParams } from "react-router";
import { Ball } from "@/components/balls";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Panel } from "@/components/panel";
import { FamilyChip } from "@/components/product/family-chip";
import { KpiCard } from "@/components/product/kpi-card";
import { PageHeader } from "@/components/product/page-header";
import { RecentHits } from "@/components/product/recent-hits";
import { DataLoading, PageHeaderSkeleton, RowsSkeleton } from "@/components/product/skeleton";
import { type GamblerPlaybook, type GamblerStrategy, type StrategiesFile, type StrategyRow, formatDate, formatNumber, formatSigned, useJson } from "@/lib/data";
import { usePageTitle } from "@/pages/layout";
import { cx } from "@/utils/cx";

type SortKey = "score" | "hits" | "prizes";

const SORTS: { id: SortKey; label: string }[] = [
    { id: "score", label: "Score" },
    { id: "hits", label: "Hits" },
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

/** One gambler strategy: the rule, the document's spec line and its live row. */
const GamblerCard = ({
    strategy,
    row,
    onShow,
}: {
    strategy: GamblerStrategy;
    row: StrategyRow;
    onShow: () => void;
}) => (
    <article className="flex min-w-0 flex-col rounded-lg border border-line bg-surface-2/40 p-2.5">
        <div className="flex items-baseline gap-2">
            <span className="font-mono text-[11px] text-ink-subtle tabular-nums">{String(strategy.index).padStart(2, "0")}</span>
            <h3 className="min-w-0 flex-1 text-[13px] leading-5 font-semibold text-ink">{strategy.name}</h3>
        </div>

        <p className="mt-1 text-[11px] leading-4 text-ink-muted">{strategy.description}</p>

        <ul className="mt-1.5 space-y-0.5">
            {strategy.rules.map((rule) => (
                <li key={rule} className="text-[11px] leading-4 text-ink-muted">
                    <span className="text-ink-faint">·</span> {rule}
                </li>
            ))}
        </ul>

        <div className="mt-2 flex items-center gap-1.5">
            <span className="shrink-0 text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Spec line</span>
            {strategy.specLine.map((n) => (
                <Ball key={n} n={n} size="xs" />
            ))}
        </div>

        <div className="mt-1 flex items-center gap-1.5">
            <span className="shrink-0 text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Next draw</span>
            {row.currentPick.map((n) => (
                <Ball key={n} n={n} size="xs" />
            ))}
        </div>

        <dl className="mt-2 grid grid-cols-4 gap-2 border-t border-line-soft pt-2 font-mono text-[11px] text-ink-subtle tabular-nums">
            <div>
                <dt className="text-[10px] tracking-[0.06em] uppercase">Score</dt>
                <dd className="text-ink">{row.score.toFixed(1)}</dd>
            </div>
            <div>
                <dt className="text-[10px] tracking-[0.06em] uppercase">Hits</dt>
                <dd className="text-ink">{row.meanHits.toFixed(2)}</dd>
            </div>
            <div>
                <dt className="text-[10px] tracking-[0.06em] uppercase">Prizes</dt>
                <dd className="text-ink">{row.effPrizes}</dd>
            </div>
            <div>
                <dt className="text-[10px] tracking-[0.06em] uppercase">Rank</dt>
                <dd className="text-ink">{row.rank}</dd>
            </div>
        </dl>

        <div className="mt-2 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[10px] text-ink-faint">
                Panels {strategy.panels.join(", ")} · {strategy.edge}
            </span>
            <button
                type="button"
                onClick={onShow}
                className="shrink-0 text-[11px] font-semibold text-accent transition-colors duration-100 hover:text-accent-strong"
            >
                In league →
            </button>
        </div>
    </article>
);

export const StrategiesScreen = () => {
    const [title, setTitle] = useState("Strategy league");
    usePageTitle(title);

    const { data, isLoading, error } = useJson<StrategiesFile>("/data/strategies.json");
    const { data: playbook } = useJson<GamblerPlaybook>("/data/gambler-playbook.json");
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

        const value = (row: StrategyRow) => (sort === "prizes" ? row.effPrizes : sort === "hits" ? row.totalHits : row.score);
        return [...filtered].sort((a, b) => value(b) - value(a));
    }, [data, query, family, sort]);

    // The gambler playbook pairs each documented strategy with its league row.
    const gamblerEntries = useMemo(() => {
        if (!playbook || !data) return [];
        const byId = new Map(data.strategies.map((row) => [row.id, row]));
        return playbook.strategies.flatMap((strategy) => {
            const row = byId.get(strategy.id);
            return row ? [{ strategy, row }] : [];
        });
    }, [playbook, data]);

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
                description={`${data.strategies.length} strategies, each tested on ${meta.folds} past draws. A score of 45 is random picking; higher means more numbers matched. Past results, not predictions.`}
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

            {gamblerEntries.length > 0 && (
                <Panel
                    title="10 gambler strategies"
                    description="Cross-panel synthesis: every rule pairs a statistical cage property with a pari-mutuel anti-collision mechanism. The spec line is the source document's illustration; the next-draw line is what the rule actually plays."
                >
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {gamblerEntries.map(({ strategy, row }) => (
                            <GamblerCard
                                key={strategy.id}
                                strategy={strategy}
                                row={row}
                                onShow={() => {
                                    // The page opens this family itself, so it
                                    // must not treat the URL it writes as an
                                    // incoming link and close the row again.
                                    appliedFamily.current = "Gambler";
                                    setFamily("Gambler");
                                    setSearchParams({ family: "Gambler" }, { replace: true });
                                    setExpanded(row.id);
                                }}
                            />
                        ))}
                    </div>
                </Panel>
            )}

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
