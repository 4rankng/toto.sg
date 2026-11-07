import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "@untitledui/icons";
import { useNavigate } from "react-router";
import { Ball, BallRow } from "@/components/balls";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Panel } from "@/components/panel";
import { Delta } from "@/components/product/delta";
import { FamilyChip } from "@/components/product/family-chip";
import { RecentHits } from "@/components/product/recent-hits";
import { ScoreBar } from "@/components/product/score-bar";
import { td, tdNum, tdStickyNum, th, thNum } from "@/components/product/table";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { type StrategiesFile, type StrategyRow, formatDate, formatSigned, useJson } from "@/lib/data";
import { usePageTitle } from "@/pages/layout";
import { useLineBuilder } from "@/providers/line-builder-provider";
import { cx } from "@/utils/cx";

type SortKey = "score" | "hits" | "z" | "prizes" | "pnl";

const SORTS: { id: SortKey; label: string }[] = [
    { id: "score", label: "Score" },
    { id: "hits", label: "Hits" },
    { id: "z", label: "Z" },
    { id: "prizes", label: "Prizes" },
    { id: "pnl", label: "P&L" },
];

const PODIUM = [
    { tone: "gold", label: "1st", text: "text-gold-ink", ring: "ring-gold/40", bg: "bg-gold/10" },
    { tone: "silver", label: "2nd", text: "text-silver-ink", ring: "ring-silver/40", bg: "bg-silver/10" },
    { tone: "bronze", label: "3rd", text: "text-bronze-ink", ring: "ring-bronze/30", bg: "bg-bronze/10" },
] as const;

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
    const navigate = useNavigate();
    const { setLine } = useLineBuilder();

    const baseline = data?.meta.chance.scoreBaseline ?? 45;

    // The league's size is part of the page title, and it changes with the data.
    useEffect(() => {
        if (data) setTitle(`Strategy league — ${data.strategies.length} strategies vs chance`);
    }, [data]);

    /** Hand a strategy's pick to the board on the home page. */
    const loadLine = (pick: number[]) => {
        setLine(pick);
        navigate("/");
    };

    const familyOptions = useMemo(
        () => [{ id: "all", label: "All families" }, ...(data?.meta.families ?? []).map((name) => ({ id: name, label: name }))],
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
            if (sort === "hits") return row.meanHits;
            if (sort === "z") return row.zScore;
            if (sort === "prizes") return row.effPrizes;
            if (sort === "pnl") return row.pnlPerDraw;
            return row.score;
        };

        return [...filtered].sort((a, b) => value(b) - value(a));
    }, [data, query, family, sort]);

    if (isLoading) {
        return <div className="py-24 text-center text-sm text-ink-subtle">Loading the strategy league…</div>;
    }

    if (error || !data) {
        return (
            <Panel title="Couldn't load the strategy league" description={error?.message ?? "public/data/strategies.json is missing."}>
                <p className="text-sm text-ink-subtle">Run `npm run refresh` to regenerate the data files, then reload.</p>
            </Panel>
        );
    }

    const { meta } = data;
    const podium = [...data.strategies].sort((a, b) => a.rank - b.rank).slice(0, 3);

    return (
        <div className="flex flex-col gap-4">
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <div>
                    <p className="text-xs font-medium tracking-[0.08em] text-ink-faint uppercase">Compare</p>
                    <h1 className="font-display text-xl font-semibold tracking-tight text-ink">Strategy league</h1>
                    <p className="mt-0.5 max-w-2xl text-sm text-ink-subtle">
                        {data.strategies.length} number-picking rules, each walked forward over {meta.folds} folds. Ranked against the chance baseline (score{" "}
                        <span className="font-mono tabular-nums">{baseline}</span>) — this measures past performance, not predictive power.
                    </p>
                </div>
                <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                    <div>
                        <dt className="text-ink-faint">Expected hits / line</dt>
                        <dd className="font-mono text-sm text-ink tabular-nums">{meta.chance.expectedHitsPerLine.toFixed(4)}</dd>
                    </div>
                    <div>
                        <dt className="text-ink-faint">Prizes / 100 draws</dt>
                        <dd className="font-mono text-sm text-ink tabular-nums">{meta.chance.prizesPer100Draws.toFixed(2)}</dd>
                    </div>
                    <div>
                        <dt className="text-ink-faint">Generated</dt>
                        <dd className="font-mono text-sm text-ink tabular-nums">{formatDate(meta.generatedAt.slice(0, 10))}</dd>
                    </div>
                </dl>
            </header>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {podium.map((row, index) => {
                    const medal = PODIUM[index];
                    return (
                        <div key={row.id} className={cx("rounded-xl border border-line p-4 ring-1 ring-inset", medal.bg, medal.ring)}>
                            <div className="flex items-baseline justify-between gap-2">
                                <span className={cx("text-xs font-semibold tracking-[0.08em] uppercase", medal.text)}>{medal.label}</span>
                                <span className="font-mono text-xs text-ink-subtle tabular-nums">#{row.rank}</span>
                            </div>
                            <p className="mt-1 truncate text-sm font-semibold text-ink">{row.name}</p>
                            <div className="mt-1">
                                <FamilyChip family={row.family} />
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <ScoreBar score={row.score} baseline={baseline} tone={medal.tone} />
                                <span className="font-mono text-sm font-semibold text-ink tabular-nums">{row.score.toFixed(1)}</span>
                            </div>
                            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line/70 pt-3 text-xs">
                                <div>
                                    <dt className="text-ink-faint">Hits</dt>
                                    <dd className="font-mono text-ink tabular-nums">{row.totalHits}</dd>
                                </div>
                                <div>
                                    <dt className="text-ink-faint">Z</dt>
                                    <dd className="font-mono text-ink tabular-nums">{formatSigned(row.zScore)}</dd>
                                </div>
                                <div>
                                    <dt className="text-ink-faint">Prizes</dt>
                                    <dd className="font-mono text-ink tabular-nums">{row.effPrizes}</dd>
                                </div>
                            </dl>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <BallRow numbers={row.currentPick} size="sm" />
                                <button
                                    type="button"
                                    onClick={() => loadLine(row.currentPick)}
                                    className="rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium whitespace-nowrap text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                                >
                                    Load line
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <Panel
                isFlush
                title="All strategies"
                description={`${rows.length} of ${data.strategies.length} shown · click a strategy to expand it`}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Input
                            value={query}
                            onChange={(value) => setQuery(value)}
                            placeholder="Search strategies"
                            size={isCompact ? "lg" : "sm"}
                            className="w-44"
                            aria-label="Search strategies"
                        />
                        <Select
                            items={familyOptions}
                            selectedKey={family}
                            onSelectionChange={(key) => setFamily(String(key))}
                            placeholder="All families"
                            size={isCompact ? "lg" : "sm"}
                            className="w-40"
                            aria-label="Filter by family"
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <div role="group" aria-label="Sort strategies" className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
                            {SORTS.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    aria-pressed={sort === option.id}
                                    onClick={() => setSort(option.id)}
                                    className={cx(
                                        "min-h-11 rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150",
                                        sort === option.id ? "bg-surface-3 text-ink" : "text-ink-subtle hover:text-ink-muted",
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                }
            >
                <div className="min-w-0 overflow-x-auto xl:overflow-visible">
                    <table className="w-full min-w-[1180px] border-collapse text-left">
                        <thead>
                            <tr>
                                <th className={cx(th, "sticky left-0 z-20 pl-4 first:rounded-tl-xl")}>#</th>
                                <th className={th}>Strategy</th>
                                <th className={th}>Family</th>
                                <th className={th}>Score</th>
                                <th className={thNum}>Hits vs chance</th>
                                <th className={thNum}>z</th>
                                <th className={thNum}>Prizes</th>
                                <th className={thNum}>P&amp;L / draw</th>
                                <th className={cx(th, "pr-4 last:rounded-tr-xl")}>Current pick</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const isOpen = expanded === row.id;
                                return (
                                    <Fragment key={row.id}>
                                        <tr
                                            className={cx(
                                                "border-b border-line/70 bg-surface transition-colors duration-150 hover:bg-surface-2/60",
                                                isOpen && "bg-surface-2/60",
                                            )}
                                        >
                                            <td className={cx(tdStickyNum, "pl-4")}>{row.rank}</td>
                                            <td className={td}>
                                                <button
                                                    type="button"
                                                    aria-expanded={isOpen}
                                                    onClick={() => setExpanded(isOpen ? null : row.id)}
                                                    className="group flex min-h-11 items-center gap-1.5 text-left"
                                                >
                                                    {isOpen ? (
                                                        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
                                                    ) : (
                                                        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
                                                    )}
                                                    <span className="truncate font-medium text-ink group-hover:text-accent">{row.name}</span>
                                                </button>
                                            </td>
                                            <td className={td}>
                                                <FamilyChip family={row.family} />
                                            </td>
                                            <td className={td}>
                                                <div className="flex w-32 items-center gap-2">
                                                    <ScoreBar score={row.score} baseline={baseline} tone={row.rank === 1 ? "gold" : "primary"} />
                                                    <span className="w-9 text-right font-mono text-xs text-ink tabular-nums">{row.score.toFixed(1)}</span>
                                                </div>
                                            </td>
                                            <td className={tdNum}>
                                                <Delta value={row.meanHits - row.expectedHits} digits={3} />
                                            </td>
                                            <td className={tdNum}>{formatSigned(row.zScore)}</td>
                                            <td className={tdNum}>{row.effPrizes}</td>
                                            <td className={tdNum}>{formatSigned(row.pnlPerDraw, 2)}</td>
                                            <td className={cx(td, "pr-4")}>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-0.5">
                                                        {row.currentPick.map((n) => (
                                                            <Ball key={n} n={n} size="xs" />
                                                        ))}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => loadLine(row.currentPick)}
                                                        className="rounded-md border border-line px-2 py-1 text-xs font-medium whitespace-nowrap text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                                                    >
                                                        Load line
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="border-b border-line/70 bg-surface-2/40">
                                                <td colSpan={9} className="px-4 py-4">
                                                    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
                                                        <div>
                                                            <p className="max-w-2xl text-sm text-ink-muted">{row.description}</p>
                                                            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                                                                <div>
                                                                    <dt className="text-xs tracking-[0.06em] text-ink-faint uppercase">Evaluated draws</dt>
                                                                    <dd className="font-mono text-sm text-ink tabular-nums">{row.evaluatedDraws}</dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-xs tracking-[0.06em] text-ink-faint uppercase">Total hits</dt>
                                                                    <dd className="font-mono text-sm text-ink tabular-nums">{row.totalHits}</dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-xs tracking-[0.06em] text-ink-faint uppercase">Mean / line</dt>
                                                                    <dd className="font-mono text-sm text-ink tabular-nums">{row.meanHits.toFixed(3)}</dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-xs tracking-[0.06em] text-ink-faint uppercase">Expected / line</dt>
                                                                    <dd className="font-mono text-sm text-ink tabular-nums">{row.expectedHits.toFixed(4)}</dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-xs tracking-[0.06em] text-ink-faint uppercase">Total prizes</dt>
                                                                    <dd className="font-mono text-sm text-ink tabular-nums">{row.totalPrizes}</dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-xs tracking-[0.06em] text-ink-faint uppercase">Effective prizes</dt>
                                                                    <dd className="font-mono text-sm text-ink tabular-nums">{row.effPrizes}</dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-xs tracking-[0.06em] text-ink-faint uppercase">Last 12 draws</dt>
                                                                    <dd className="mt-1">
                                                                        <RecentHits hits={row.recent12} draws={12} expectedPerLine={row.expectedHits} />
                                                                    </dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-xs tracking-[0.06em] text-ink-faint uppercase">P&amp;L / draw</dt>
                                                                    <dd className="font-mono text-sm text-ink tabular-nums">
                                                                        {formatSigned(row.pnlPerDraw, 2)}
                                                                    </dd>
                                                                </div>
                                                            </dl>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs tracking-[0.06em] text-ink-faint uppercase">
                                                                Current pick — draw {meta.nextDraw}
                                                            </p>
                                                            <div className="mt-2 flex items-center gap-1.5">
                                                                {row.currentPick.map((n) => (
                                                                    <Ball key={n} n={n} size="lg" />
                                                                ))}
                                                            </div>
                                                            <p className="mt-3 text-xs text-ink-faint">
                                                                Last 12 draws: <span className="font-mono text-ink-muted tabular-nums">{row.recent12}</span>{" "}
                                                                hits · z{" "}
                                                                <span className="font-mono text-ink-muted tabular-nums">{formatSigned(row.zScore)}</span> ·
                                                                score <span className="font-mono text-ink-muted tabular-nums">{row.score.toFixed(1)}</span> vs
                                                                baseline {baseline}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-subtle">No strategy matches that filter.</p>}
            </Panel>

            <Panel title="No system beats the cage">
                <p className="max-w-3xl text-sm text-ink-muted">
                    TOTO draws are independent, identically distributed and uniform over 1–49. Every line carries the same{" "}
                    <span className="font-mono text-ink tabular-nums">1 in 13,983,816</span> chance of Group 1 — including every strategy in this table. The
                    league scores how each rule has walked forward against the chance baseline (score ≈{" "}
                    <span className="font-mono text-ink tabular-nums">{baseline}</span>); it is <span className="text-ink">not</span> predictive power, and a
                    high score is a description of what already happened, not a forecast. Play for entertainment, never to recover a loss.
                </p>
            </Panel>
        </div>
    );
};
