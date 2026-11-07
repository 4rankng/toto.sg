import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "@untitledui/icons";
import { Ball, BallRow } from "@/components/balls";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Panel } from "@/components/panel";
import { FamilyChip } from "@/components/product/family-chip";
import { PageHeader } from "@/components/product/page-header";
import { RecentHits } from "@/components/product/recent-hits";
import { ScoreBar } from "@/components/product/score-bar";
import { DataLoading, PageHeaderSkeleton, RowsSkeleton } from "@/components/product/skeleton";
import { td, tdNum, th, thNum } from "@/components/product/table";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { type StrategiesFile, type StrategyRow, formatDate, formatNumber, formatSigned, useJson } from "@/lib/data";
import { usePageTitle } from "@/pages/layout";
import { cx } from "@/utils/cx";

type SortKey = "score" | "prizes";

const SORTS: { id: SortKey; label: string }[] = [
    { id: "score", label: "Score" },
    { id: "prizes", label: "Prizes" },
];

const PODIUM = [
    { label: "1st", text: "text-gold-ink", bar: "bg-gold" },
    { label: "2nd", text: "text-silver-ink", bar: "bg-silver" },
    { label: "3rd", text: "text-bronze-ink", bar: "bg-bronze" },
] as const;

/** Rows revealed at a time in the phone card list. */
const MOBILE_BATCH = 30;

const LeagueSkeleton = () => (
    <DataLoading label="Loading the strategies">
        <PageHeaderSkeleton />
        <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 rounded-xl border border-line bg-surface" />
            ))}
        </div>
        <RowsSkeleton count={10} />
    </DataLoading>
);

/** The expanded body of a rule, shared by the table and the phone cards. */
const StrategyDetail = ({ row, nextDraw, className }: { row: StrategyRow; nextDraw: number; className?: string }) => (
    <div className={cx("grid gap-4 lg:grid-cols-[1.7fr_auto]", className)}>
        <div className="min-w-0">
            <p className="max-w-2xl text-[13px] leading-5 text-ink-muted">{row.description}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
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

        <div className="lg:w-56">
            <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Pick for draw {nextDraw}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
                {row.currentPick.map((n) => (
                    <Ball key={n} n={n} size="md" />
                ))}
            </div>
        </div>
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
    const [visible, setVisible] = useState(MOBILE_BATCH);
    const baseline = data?.meta.chance.scoreBaseline ?? 45;

    // The league's size is part of the page title, and it changes with the data.
    useEffect(() => {
        if (data) setTitle(`Strategy league — ${data.strategies.length} strategies vs random`);
    }, [data]);

    // A new filter starts the phone list from the top again.
    useEffect(() => {
        setVisible(MOBILE_BATCH);
    }, [query, family, sort]);

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
    const podium = [...data.strategies].sort((a, b) => a.rank - b.rank).slice(0, 3);
    const toggle = (id: string) => setExpanded((current) => (current === id ? null : id));

    const filters = (
        <div className="flex flex-wrap items-center gap-1.5">
            <Input
                value={query}
                onChange={(value) => setQuery(value)}
                placeholder="Search strategies"
                size={isCompact ? "lg" : "sm"}
                className="w-40"
                aria-label="Search strategies"
            />
            <Select
                items={familyOptions}
                selectedKey={family}
                onSelectionChange={(key) => setFamily(String(key))}
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
                actions={
                    <div className="text-right text-[11px]">
                        <p className="text-ink-subtle">Prizes per 100 random draws</p>
                        <p className="font-mono text-xs text-ink tabular-nums">{meta.chance.prizesPer100Draws.toFixed(1)}</p>
                    </div>
                }
            />

            {/* Top three, compact. */}
            <div className="grid gap-3 sm:grid-cols-3">
                {podium.map((row, index) => {
                    const medal = PODIUM[index];
                    return (
                        <div key={row.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                            <div className={cx("h-0.5 w-full", medal.bar)} />
                            <div className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className={cx("text-[10px] font-semibold tracking-[0.12em] uppercase", medal.text)}>{medal.label}</p>
                                        <p className="truncate text-sm font-semibold text-ink">{row.name}</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="font-mono text-lg leading-6 font-semibold text-ink tabular-nums">{row.score.toFixed(1)}</p>
                                        <p className="text-[10px] text-ink-subtle">score</p>
                                    </div>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    <FamilyChip family={row.family} />
                                    <BallRow numbers={row.currentPick} size="xs" />
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/70 pt-2">
                                    <p className="font-mono text-[11px] text-ink-subtle tabular-nums">
                                        {row.effPrizes} prizes
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <Panel
                isFlush
                title="All strategies"
                description={`${rows.length} of ${data.strategies.length} · a match is one correct number; a prize needs 3 or more matches`}
                actions={filters}
            >
                {/* Phone: cards with a batched reveal. */}
                <div className="md:hidden">
                    {rows.slice(0, visible).map((row) => {
                        const isOpen = expanded === row.id;
                        return (
                            <div key={row.id} className={cx("border-b border-line-soft last:border-0", isOpen && "bg-surface-2/50")}>
                                <button
                                    type="button"
                                    aria-expanded={isOpen}
                                    onClick={() => toggle(row.id)}
                                    className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
                                >
                                    <div className="min-w-0">
                                        <p className="flex items-baseline gap-2">
                                            <span className="w-5 font-mono text-[11px] text-ink-subtle tabular-nums">{row.rank}</span>
                                            <span className="truncate text-[13px] font-semibold text-ink">{row.name}</span>
                                        </p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <FamilyChip family={row.family} />
                                            <span className="font-mono text-[11px] text-ink-subtle tabular-nums">
                                                {row.effPrizes} prizes
                                            </span>
                                        </div>
                                        <div className="mt-1.5">
                                            <BallRow numbers={row.currentPick} size="xs" />
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <span className="font-mono text-sm font-semibold text-ink tabular-nums">{row.score.toFixed(1)}</span>
                                        {isOpen ? (
                                            <ChevronDown aria-hidden="true" className="size-4 text-ink-faint" />
                                        ) : (
                                            <ChevronRight aria-hidden="true" className="size-4 text-ink-faint" />
                                        )}
                                    </div>
                                </button>
                                {isOpen && (
                                    <div className="border-t border-line-soft bg-surface-2/40 px-3 py-3">
                                        <StrategyDetail row={row} nextDraw={meta.nextDraw} />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {rows.length > visible && (
                        <div className="p-3">
                            <button
                                type="button"
                                onClick={() => setVisible((count) => count + MOBILE_BATCH)}
                                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-muted transition-colors duration-100 hover:bg-surface-2 hover:text-ink"
                            >
                                Show {Math.min(MOBILE_BATCH, rows.length - visible)} more · {visible} of {rows.length}
                            </button>
                        </div>
                    )}
                    {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-muted">No strategy matches that filter.</p>}
                </div>

                {/* Tablet and up: a fixed-width table that never scrolls sideways. */}
                <div className="hidden md:block">
                    <table className="w-full table-fixed border-collapse text-left">
                        <colgroup>
                            <col className="w-10" />
                            <col />
                            <col className="w-[34%] xl:w-[38%]" />
                            <col className="w-20" />
                            <col className="w-[9.5rem] xl:w-52" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th className={cx(th, "pl-3 first:rounded-tl-xl")}>#</th>
                                <th className={th}>Strategy</th>
                                <th className={th}>Score</th>
                                <th className={thNum}>Prizes</th>
                                <th className={cx(th, "pr-3 last:rounded-tr-xl")}>Next pick</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const isOpen = expanded === row.id;
                                return (
                                    <Fragment key={row.id}>
                                        <tr
                                            onClick={() => toggle(row.id)}
                                            className={cx(
                                                "group cursor-pointer border-b border-line-soft bg-surface transition-colors duration-100 hover:bg-surface-2/60",
                                                isOpen && "bg-surface-2/60",
                                            )}
                                        >
                                            <td className={cx(tdNum, "pl-3")}>{row.rank}</td>
                                            <td className={td}>
                                                <button
                                                    type="button"
                                                    aria-expanded={isOpen}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        toggle(row.id);
                                                    }}
                                                    className="flex w-full min-w-0 items-center gap-1.5 text-left"
                                                >
                                                    {isOpen ? (
                                                        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
                                                    ) : (
                                                        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
                                                    )}
                                                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink group-hover:text-accent">
                                                        {row.name}
                                                    </span>
                                                </button>
                                                <p className="mt-0.5 truncate pl-5 text-[10px] text-ink-subtle">
                                                    {row.family} · {row.description}
                                                </p>
                                            </td>
                                            <td className={td}>
                                                <div className="flex items-center gap-2">
                                                    <ScoreBar
                                                        score={row.score}
                                                        baseline={baseline}
                                                        tone={row.rank === 1 ? "gold" : "primary"}
                                                        className="min-w-0 flex-1"
                                                    />
                                                    <span className="w-9 shrink-0 text-right font-mono text-xs text-ink tabular-nums">
                                                        {row.score.toFixed(1)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={tdNum}>{row.effPrizes}</td>
                                            <td className={cx(td, "pr-3")}>
                                                <div className="flex items-center justify-end gap-0.5">
                                                    {row.currentPick.map((n) => (
                                                        <Ball key={n} n={n} size="xs" />
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="border-b border-line-soft bg-surface-2/40">
                                                <td colSpan={5} className="px-3 py-3">
                                                    <StrategyDetail row={row} nextDraw={meta.nextDraw} />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                    {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-muted">No strategy matches that filter.</p>}
                </div>
            </Panel>

            <Panel emphasis="plain" className="border-t border-line/70 pt-3">
                <p className="max-w-4xl text-[11px] leading-4 text-ink-subtle">
                    Every line has the same chance of Group 1: <span className="font-mono text-ink-muted tabular-nums">1 in 13,983,816</span>. The score describes
                    100 past draws. It does not predict the next draw. Play for entertainment, never to recover a loss.
                </p>
            </Panel>
        </div>
    );
};
