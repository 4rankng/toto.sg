import { useEffect, useMemo, useRef, useState } from "react";
import { Award01, Calendar, ChevronDown, ChevronRight, Coins01, Grid01 } from "@untitledui/icons";
import { Link, useSearchParams } from "react-router";
import { Ball } from "@/components/balls";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Panel } from "@/components/panel";
import { FamilyChip } from "@/components/product/family-chip";
import { KpiCard } from "@/components/product/kpi-card";
import { PageHeader } from "@/components/product/page-header";
import { RecentHits } from "@/components/product/recent-hits";
import { DataLoading, PageHeaderSkeleton, RowsSkeleton } from "@/components/product/skeleton";
import {
    type CrossPanelPlaybook,
    type Draw,
    type StrategiesFile,
    type StrategyRow,
    formatDate,
    formatNumber,
    formatSigned,
    useJson,
} from "@/lib/data";
import { lineAcValue } from "@/lib/ticket-xray";
import { usePageTitle } from "@/pages/layout";
import { cx } from "@/utils/cx";

type SortKey = "score" | "prizes";

const SORTS: { id: SortKey; label: string }[] = [
    { id: "score", label: "Score" },
    { id: "prizes", label: "Prizes" },
];

const TIERS = ["g1", "g2", "g3", "g4", "g5", "g6", "g7"] as const;

/** Live per-ball form across the archived draws: how due, hot and frequent. */
type BallForm = { skip: number; last10: number; allTime: number };

const LeagueSkeleton = () => (
    <DataLoading label="Loading the strategies">
        <PageHeaderSkeleton />
        <RowsSkeleton count={10} />
    </DataLoading>
);


/** The expanded body of a strategy: performance vs chance + pick forensics. */
const StrategyDetail = ({
    row,
    chance,
    ballForms,
    buildRules,
    evidencePanels,
    className,
}: {
    row: StrategyRow;
    chance: StrategiesFile["meta"]["chance"];
    ballForms: Map<number, BallForm> | null;
    /** Numbered construction steps for documented families (cross-panel). */
    buildRules?: string[];
    /** The Insights panels a documented strategy was read off. */
    evidencePanels?: { anchor: string; label: string }[];
    className?: string;
}) => {
    const sorted = [...row.currentPick].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const ac = lineAcValue(sorted);
    const span = sorted.length > 0 ? sorted[sorted.length - 1] - sorted[0] : 0;
    const odds = sorted.filter((n) => n % 2 === 1).length;
    const tails = new Set(sorted.map((n) => n % 10)).size;
    let consec = 0;
    for (let i = 1; i < sorted.length; i += 1) if (sorted[i] === sorted[i - 1] + 1) consec += 1;
    const folds = row.evaluatedDraws || 1;
    const tierChance = (tier: string) => folds * Number(chance[`tier${tier.replace("g", "G")}` as keyof typeof chance] ?? 0);

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
            </div>

            {(buildRules?.length || evidencePanels?.length) && (
                <div className="flex flex-col gap-2 rounded-lg border border-line-soft bg-surface-2/40 p-2.5">
                    {buildRules?.length ? (
                        <ol className="flex flex-col gap-1">
                            {buildRules.map((rule, i) => (
                                <li key={rule} className="flex gap-2 text-[11px] leading-4 text-ink-muted">
                                    <span className="font-mono text-ink-subtle tabular-nums">{i + 1}</span>
                                    <span>{rule}</span>
                                </li>
                            ))}
                        </ol>
                    ) : null}
                    {evidencePanels?.length ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[9px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">Evidence · </span>
                            {evidencePanels.map((panel) => (
                                <Link
                                    key={panel.anchor}
                                    to={`/insights#${panel.anchor}`}
                                    className="rounded border border-line-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle transition-colors duration-100 hover:text-accent"
                                >
                                    {panel.label}
                                </Link>
                            ))}
                        </div>
                    ) : null}
                </div>
            )}

            <div className="grid gap-3 lg:grid-cols-12">
                {/* Walk-forward performance vs chance */}
                <div className="flex min-w-0 flex-col gap-3 lg:col-span-7">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                        <div>
                            <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Draws tested</dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{formatNumber(row.evaluatedDraws)}</dd>
                        </div>
                        <div>
                            <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Numbers matched</dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">
                                {formatNumber(row.totalHits ?? 0)} <span className="text-ink-subtle">vs {formatNumber(Math.round(folds * chance.expectedHitsPerLine))}</span>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Hit rate — 2+ matched</dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">
                                {row.twoPlusDraws ?? 0}/{row.evaluatedDraws} <span className="text-ink-subtle">vs {Math.round((folds * chance.twoPlusPer100Draws) / 100)}</span>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Depth points</dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">
                                {row.depthPoints ?? 0} <span className="text-ink-subtle">vs {Math.round((folds * (chance.depthPointsPer100Draws ?? 17.17)) / 100)}</span>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Prize draws</dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">
                                {formatNumber(row.totalPrizes ?? 0)} <span className="text-ink-subtle">vs {Math.round((folds * chance.prizesPer100Draws) / 100)}</span>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Prize points</dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">
                                {row.weightedPrizes ?? 0} <span className="text-ink-subtle">vs {Math.round((folds * (chance.weightedPrizesPer100Draws ?? 0.43)) / 100)}</span>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Matched, last 12 draws</dt>
                            <dd className="mt-0.5">
                                <RecentHits hits={row.recent12 ?? 0} draws={12} expectedPerLine={row.expectedHits ?? chance.expectedHitsPerLine} />
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Profit/draw · Prize points</dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">
                                {formatSigned(row.pnlPerDraw ?? 0, 2)} · {row.score ?? 0} pts
                            </dd>
                        </div>
                    </dl>

                    {/* G1–G7 hit strip: what the strategy actually hit, per tier */}
                    <div className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">Hits by prize tier</p>
                            <span className="font-mono text-[10px] text-ink-subtle">
                                chance over {formatNumber(folds)} draws: G7 {tierChance("g7").toFixed(0)} · G5 {tierChance("g5").toFixed(1)} · G6 {tierChance("g6").toFixed(1)} · G1–G4 &lt; 0.05 each
                            </span>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {TIERS.map((tier) => {
                                const hits = row.tierCounts?.[tier] ?? 0;
                                return (
                                    <div
                                        key={tier}
                                        title={`Expected by chance: ${tierChance(tier).toFixed(2)}`}
                                        className={cx(
                                            "rounded border px-1 py-1 text-center",
                                            hits > 0 ? "border-primary/40 bg-primary/10" : "border-line-soft bg-surface",
                                        )}
                                    >
                                        <p className="text-[9px] font-semibold tracking-wider text-ink-subtle uppercase">{tier.replace("g", "G")}</p>
                                        <p className={cx("font-mono text-sm font-semibold tabular-nums", hits > 0 ? "text-primary" : "text-ink-faint")}>{hits}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* The current pick: shape + each ball's live form */}
                <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
                    <div className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">Current pick shape</p>
                            <span className="font-mono text-[10px] text-ink-subtle">{sorted.join(" · ")}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded border border-line-soft bg-surface px-2 py-1 text-center">
                                <p className="text-[10px] text-ink-subtle uppercase">Sum</p>
                                <p className="font-mono text-xs font-semibold text-ink tabular-nums">{sum}</p>
                            </div>
                            <div className="rounded border border-line-soft bg-surface px-2 py-1 text-center">
                                <p className="text-[10px] text-ink-subtle uppercase">AC</p>
                                <p className="font-mono text-xs font-semibold text-primary tabular-nums">{ac}/10</p>
                            </div>
                            <div className="rounded border border-line-soft bg-surface px-2 py-1 text-center">
                                <p className="text-[10px] text-ink-subtle uppercase">Span</p>
                                <p className="font-mono text-xs font-semibold text-ink tabular-nums">{span}</p>
                            </div>
                            <div className="rounded border border-line-soft bg-surface px-2 py-1 text-center">
                                <p className="text-[10px] text-ink-subtle uppercase">Odd/Even</p>
                                <p className="font-mono text-xs font-semibold text-ink tabular-nums">{odds}/{6 - odds}</p>
                            </div>
                            <div className="rounded border border-line-soft bg-surface px-2 py-1 text-center">
                                <p className="text-[10px] text-ink-subtle uppercase">Tails</p>
                                <p className="font-mono text-xs font-semibold text-ink tabular-nums">{tails}/6</p>
                            </div>
                            <div className="rounded border border-line-soft bg-surface px-2 py-1 text-center">
                                <p className="text-[10px] text-ink-subtle uppercase">Consec</p>
                                <p className={cx("font-mono text-xs font-semibold tabular-nums", consec > 1 ? "text-heat-hot" : "text-ink")}>{consec}</p>
                            </div>
                        </div>
                    </div>

                    {/* Ball form: skip / last-10 / all-time for every picked number */}
                    <div className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5">
                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">
                            Ball form — skip · last 10 · all-time
                        </p>
                        <table className="w-full border-collapse text-left font-mono text-xs tabular-nums">
                            <tbody>
                                {sorted.map((n) => {
                                    const form = ballForms?.get(n);
                                    return (
                                        <tr key={n} className="border-b border-line-soft last:border-0">
                                            <td className="py-1 pr-2"><Ball n={n} size="sm" /></td>
                                            <td className={cx("py-1 pr-2", (form?.skip ?? 0) > 16 && "text-heat-hot")}>{form ? form.skip : "—"}</td>
                                            <td className={cx("py-1 pr-2", (form?.last10 ?? 0) >= 3 && "text-primary")}>{form ? `${form.last10}/10` : "—"}</td>
                                            <td className="py-1 text-ink-muted">{form ? formatNumber(form.allTime) : "—"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const StrategiesScreen = () => {
    const [title, setTitle] = useState("Strategy league");
    usePageTitle(title);


    const { data, isLoading, error } = useJson<StrategiesFile>("/data/strategies.json");
    const { data: draws } = useJson<Draw[]>("/data/draws.json");
    // The playbook documents the cross-panel family: the rule behind each
    // strategy, the panels it was read off, and the live row it produced.
    const { data: playbook } = useJson<CrossPanelPlaybook>("/data/cross-panel-playbook.json");
    const playbookById = useMemo(() => new Map((playbook?.strategies ?? []).map((entry) => [entry.id, entry])), [playbook]);

    // Live per-ball form for the expanded rows: draws since each ball last
    // appeared, its hits in the last 10 draws, and its all-time count.
    const ballForms = useMemo(() => {
        if (!draws || draws.length === 0) return null;
        const forms = new Map<number, BallForm>();
        for (let n = 1; n <= 49; n += 1) {
            let skip = draws.length;
            let last10 = 0;
            let allTime = 0;
            for (let i = draws.length - 1; i >= 0; i -= 1) {
                if (draws[i].numbers.includes(n)) {
                    allTime += 1;
                    if (skip === draws.length) skip = draws.length - 1 - i;
                    if (draws.length - 1 - i < 10) last10 += 1;
                }
            }
            forms.set(n, { skip, last10, allTime });
        }
        return forms;
    }, [draws]);


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
                    return row.effPrizes ?? 0;
                case "score":
                default:
                    return row.score ?? 0;
            }
        };
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
    // Chance nulls scale with the fold count: the meta rates are per 100 draws.
    const chancePrizes = Math.round((meta.folds * meta.chance.prizesPer100Draws) / 100);
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
                description={`Every score is expanding walk-forward over ${formatNumber(meta.folds)} real draws — each draw graded only on the history before it. Score = prize points: G7 1 · G6 10 · G5 100 · G4 1k · G3 10k · G2 100k · G1 1M per hit — one G1 outweighs any number of G7s.`}
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
                    value={data.strategies.reduce((best, row) => Math.max(best, row.score ?? 0), 0).toFixed(1)}
                    hint={[...data.strategies].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.name}
                    icon={Award01}
                    tone="gold"
                />
                <KpiCard label="Prizes / 100" value={meta.chance.prizesPer100Draws.toFixed(1)} hint="chance for any line" icon={Coins01} tone="secondary" />
                <KpiCard label="Next draw" value={meta.nextDraw} hint="picks below" icon={Calendar} tone="neutral" />
            </div>

            <Panel
                isFlush
                title="All strategies"
                description={`${rows.length} of ${data.strategies.length} · picks for draw ${meta.nextDraw} · chance over ${formatNumber(meta.folds)} draws: ${formatNumber(chancePrizes)} prizes (score points: ${formatNumber(Math.round((meta.folds * meta.chance.weightedPrizesPer100Draws) / 100))})`}
                actions={filters}
            >
                {/* Two columns from lg: at xl the 1024–1279px range wasted
                    roughly half of every row on empty space. */}
                <ol className="grid grid-cols-1 gap-px bg-line-soft lg:grid-cols-2">
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
                                        <span className="shrink-0 font-mono text-[13px] font-semibold text-ink tabular-nums">{row.score ?? 0}</span>
                                        <span className="w-20 shrink-0 text-right font-mono text-[11px] text-ink-subtle tabular-nums">
                                            {`${row.effPrizes ?? 0} prizes`}
                                        </span>
                                    </span>

                                    {/* Line 2 — the sequence, on its own line, at full size. */}
                                    <span className="flex flex-wrap items-center gap-1 pl-8">
                                        {row.currentPick.map((n) => (
                                            <Ball key={n} n={n} size="lg" />
                                        ))}
                                        <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-subtle tabular-nums">
                                            {formatNumber(row.effPrizes ?? 0)}/{formatNumber(chancePrizes)} prizes · best {row.bestGroup != null ? `G${row.bestGroup}` : "—"}
                                        </span>
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="border-t border-line-soft bg-surface-2/40 px-4 py-3">
                                        <StrategyDetail
                                            row={row}
                                            chance={meta.chance}
                                            ballForms={ballForms}
                                            buildRules={playbookById.get(row.id)?.rules}
                                            evidencePanels={playbookById.get(row.id)?.panels}
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
