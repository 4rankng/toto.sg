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
import { DataLoading, PageHeaderSkeleton, RowsSkeleton } from "@/components/product/skeleton";
import {
    type CrossPanelPlaybook,
    type Draw,
    type PrizeEvent,
    type PrizeEventsFile,
    type StrategiesFile,
    type StrategyRow,
    formatDate,
    formatNumber,
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
    /** The strategy's prize-hit ledger — what the tier tiles expand into. */
    prizeEvents,
    /** Actual drawn numbers by draw no — the ledger shows the real draw. */
    drawsByNo,
    className,
}: {
    row: StrategyRow;
    chance: StrategiesFile["meta"]["chance"];
    ballForms: Map<number, BallForm> | null;
    /** Numbered construction steps for documented families (cross-panel). */
    buildRules?: string[];
    /** The Insights panels a documented strategy was read off. */
    evidencePanels?: { anchor: string; label: string }[];
    prizeEvents?: PrizeEvent[];
    drawsByNo?: Map<number, Draw>;
    className?: string;
}) => {
    const [openTier, setOpenTier] = useState<string | null>(null);
    const tierEvents = openTier ? (prizeEvents ?? []).filter((event) => `g${event.g}` === openTier) : [];

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
    const prizeDelta = (row.totalPrizes ?? 0) - Math.round((folds * chance.prizesPer100Draws) / 100);

    return (
        <div className={cx("min-w-0 flex flex-col gap-3", className)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                    <p className="text-[13px] leading-5 text-ink-muted">{row.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {/* Muted chip: family colour would spend the page's
                            accent budget where it carries no meaning. */}
                        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-ink-muted ring-1 ring-line ring-inset">
                            {row.family}
                        </span>
                        <span className="font-mono text-[11px] text-ink-subtle tabular-nums">{row.id}</span>
                    </div>
                </div>
            </div>

            {(buildRules?.length || evidencePanels?.length) && (
                <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-2.5">
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
                                    className="rounded border border-line-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle transition-colors duration-100 hover:text-accent-strong"
                                >
                                    {panel.label}
                                </Link>
                            ))}
                        </div>
                    ) : null}
                </div>
            )}

            {/* Walk-forward performance vs chance — one horizontal stat strip */}
            <dl className="flex flex-wrap items-stretch divide-x divide-line-soft rounded-lg bg-surface-2">
                <div className="min-w-[120px] flex-1 px-3 py-2">
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-muted uppercase">Draws tested</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-ink tabular-nums">{formatNumber(row.evaluatedDraws)}</dd>
                </div>
                <div className="min-w-[170px] flex-[1.5] px-3 py-2">
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-muted uppercase">Prize draws</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-ink tabular-nums">
                        {formatNumber(row.totalPrizes ?? 0)}
                        <span
                            className={cx(
                                "ml-1.5 rounded px-1 py-px text-[11px] font-semibold",
                                prizeDelta > 0 ? "text-secondary" : prizeDelta < 0 ? "text-heat-hot" : "text-ink-muted",
                            )}
                            title="Prize draws minus the chance expectation over the same folds"
                        >
                            {prizeDelta > 0 ? `+${prizeDelta}` : prizeDelta < 0 ? `${prizeDelta}` : "±0"} vs chance
                        </span>
                    </dd>
                </div>
                <div className="min-w-[110px] flex-1 px-3 py-2">
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-muted uppercase">Score</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-ink tabular-nums" title={`Log-normalised to 1–100 against the theoretical ceiling (every fold a Group 1) from ${formatNumber(row.score ?? 0)} raw prize points — each prize hit earns its tier's weight, G7 1 … G1 1M; 100 is the perfect league, the leader sits near 54`}>
                        {row.score100 ?? 1} <span className="text-ink-muted">/ 100</span>
                    </dd>
                </div>
                <div className="min-w-[90px] flex-[0.8] px-3 py-2">
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-muted uppercase">Best hit</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-ink tabular-nums">
                        {row.bestGroup != null ? `G${row.bestGroup}` : "—"}
                    </dd>
                </div>
            </dl>

            {/* What it hit vs how the pick is built — an equal-height pair */}
            <div className="grid gap-2.5 lg:grid-cols-12">
                {/* G1–G7 hit strip: zeros recede into the inset, hits get the
                    white lift with an accent top bar */}
                <div className="min-w-0 rounded-lg bg-surface-2 p-2.5 lg:col-span-7">
                    <p className="mb-2 text-[10px] font-semibold tracking-wider text-ink-muted uppercase">Hits by prize tier</p>
                    <div className="grid grid-cols-7 gap-1">
                        {TIERS.map((tier) => {
                            const hits = row.tierCounts?.[tier] ?? 0;
                            const hit = hits > 0;
                            const tile = (
                                <>
                                    <p className={cx("text-[9px] font-semibold tracking-wider uppercase", hit ? "text-ink-muted" : "text-ink-subtle")}>{tier.replace("g", "G")}</p>
                                    <p className={cx("font-mono text-sm font-semibold tabular-nums", hit ? "text-primary-strong" : "text-ink-faint")}>{hits}</p>
                                </>
                            );
                            const tone = cx(
                                "rounded border px-1 py-1 text-center",
                                hit ? "border-transparent border-t-[3px] border-t-accent bg-surface" : "border-transparent",
                                openTier === tier && "ring-1 ring-accent",
                            );
                            if (!hit) {
                                return (
                                    <div key={tier} title={`Expected by chance: ${tierChance(tier).toFixed(2)}`} className={tone}>
                                        {tile}
                                    </div>
                                );
                            }
                            return (
                                <button
                                    key={tier}
                                    type="button"
                                    aria-pressed={openTier === tier}
                                    onClick={() => setOpenTier((prev) => (prev === tier ? null : tier))}
                                    title={`Expected by chance: ${tierChance(tier).toFixed(2)} — click to see the ${hits} prize hit${hits > 1 ? "s" : ""}`}
                                    className={cx(tone, "transition-colors duration-100 hover:bg-secondary_hover cursor-pointer")}
                                >
                                    {tile}
                                </button>
                            );
                        })}
                    </div>
                    {openTier && tierEvents.length > 0 && (
                        <ul className="mt-2 flex flex-col divide-y divide-line-soft">
                            {tierEvents.map((event) => {
                                const drawn = drawsByNo?.get(event.d);
                                const pick = new Set(event.p);
                                return (
                                    <li key={event.d} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 py-1.5">
                                        <span className="rounded bg-surface px-1 py-px font-mono text-[10px] font-semibold text-primary-strong ring-1 ring-line-soft ring-inset">G{event.g}</span>
                                        <span className="font-mono text-[11px] font-semibold text-ink tabular-nums">#{event.d}</span>
                                        <span className="text-[11px] text-ink-muted">{formatDate(event.date)}</span>
                                        <span
                                            className="ml-auto flex items-center gap-1"
                                            title="The actual draw — accent ring marks the balls this strategy matched"
                                        >
                                            {drawn
                                                ? [...drawn.numbers].sort((a, b) => a - b).map((n) => (
                                                      <Ball key={n} n={n} size="sm" className={pick.has(n) ? "ring-2 ring-accent" : "opacity-40"} />
                                                  ))
                                                : [...event.p].sort((a, b) => a - b).map((n) => (
                                                      <Ball key={n} n={n} size="sm" />
                                                  ))}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* The current pick: shape at a glance */}
                <div className="min-w-0 rounded-lg bg-surface-2 p-2.5 lg:col-span-5">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold tracking-wider text-ink-muted uppercase">Current pick shape</p>
                        <span className="font-mono text-[10px] text-ink-subtle">{sorted.join(" · ")}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                        <div className="rounded bg-surface px-1.5 py-1 text-center">
                            <p className="text-[10px] text-ink-muted uppercase">Sum</p>
                            <p className="font-mono text-xs font-semibold text-ink tabular-nums">{sum}</p>
                        </div>
                        <div className="rounded bg-surface px-1.5 py-1 text-center">
                            <p className="text-[10px] text-ink-muted uppercase">AC</p>
                            <p className="font-mono text-xs font-semibold text-primary-strong tabular-nums">{ac}/10</p>
                        </div>
                        <div className="rounded bg-surface px-1.5 py-1 text-center">
                            <p className="text-[10px] text-ink-muted uppercase">Span</p>
                            <p className="font-mono text-xs font-semibold text-ink tabular-nums">{span}</p>
                        </div>
                        <div className="rounded bg-surface px-1.5 py-1 text-center">
                            <p className="text-[10px] text-ink-muted uppercase">Odd/Even</p>
                            <p className="font-mono text-xs font-semibold text-ink tabular-nums">{odds}/{6 - odds}</p>
                        </div>
                        <div className="rounded bg-surface px-1.5 py-1 text-center">
                            <p className="text-[10px] text-ink-muted uppercase">Tails</p>
                            <p className="font-mono text-xs font-semibold text-ink tabular-nums">{tails}/6</p>
                        </div>
                        <div className="rounded bg-surface px-1.5 py-1 text-center">
                            <p className="text-[10px] text-ink-muted uppercase">Consec</p>
                            <p className={cx("font-mono text-xs font-semibold tabular-nums", consec > 1 ? "text-heat-hot" : "text-ink")}>{consec}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ball form: one compact column per picked number */}
            <div className="rounded-lg bg-surface-2 p-2.5">
                <p className="mb-2 text-[10px] font-semibold tracking-wider text-ink-muted uppercase">
                    Ball form — skip · last 10 · all-time
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[380px] border-collapse text-center font-mono text-xs tabular-nums">
                        <thead>
                            <tr className="border-b border-line-soft">
                                <th scope="col" className="py-1 pr-2 text-left text-[9px] font-semibold uppercase tracking-wider text-ink-subtle">
                                    Ball
                                </th>
                                {sorted.map((n) => (
                                    <th key={n} scope="col" className="px-1 py-1 font-normal">
                                        <Ball n={n} size="sm" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-line-soft">
                                <th scope="row" className="py-1 pr-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                                    Skip
                                </th>
                                {sorted.map((n) => {
                                    const form = ballForms?.get(n);
                                    return (
                                        <td key={n} className={cx("px-1 py-1", (form?.skip ?? 0) > 16 && "font-semibold text-heat-hot")}>
                                            {form ? form.skip : "—"}
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr className="border-b border-line-soft">
                                <th scope="row" className="py-1 pr-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                                    Last 10
                                </th>
                                {sorted.map((n) => {
                                    const form = ballForms?.get(n);
                                    return (
                                        <td key={n} className={cx("px-1 py-1", (form?.last10 ?? 0) >= 3 && "font-semibold text-primary")}>
                                            {form ? `${form.last10}/10` : "—"}
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr>
                                <th scope="row" className="py-1 pr-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                                    All-time
                                </th>
                                {sorted.map((n) => {
                                    const form = ballForms?.get(n);
                                    return (
                                        <td key={n} className="px-1 py-1 text-ink-muted">
                                            {form ? formatNumber(form.allTime) : "—"}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
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
    // The prize-hit ledger behind the tier tiles' "when did it hit" list.
    const { data: prizeEvents } = useJson<PrizeEventsFile>("/data/prize-events.json");
    const playbookById = useMemo(() => new Map((playbook?.strategies ?? []).map((entry) => [entry.id, entry])), [playbook]);
    // Actual drawn numbers by draw no — the tier ledger shows the real draw
    // and accent-rings the balls the strategy matched.
    const drawsByNo = useMemo(() => new Map((draws ?? []).map((d) => [d.draw, d])), [draws]);

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

    // The league is laid out as rows of two. Grouping the rows lets an open
    // row's detail span the whole panel under its pair — expanding a row can
    // no longer stretch its neighbour into a blank card.
    const rowPairs = useMemo(() => {
        const pairs: StrategyRow[][] = [];
        for (let i = 0; i < rows.length; i += 2) pairs.push(rows.slice(i, i + 2));
        return pairs;
    }, [rows]);

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
    const topRow = [...data.strategies].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const toggle = (id: string) => setExpanded((current) => (current === id ? null : id));

    // Wrap rather than scroll: on phones the sort pills were clipped behind
    // an invisible horizontal scroller.
    const filters = (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:w-auto sm:flex-nowrap">
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
                    value={String(topRow.score100 ?? 1)}
                    hint={`${topRow.name} · ${formatNumber(topRow.score)} pts raw`}
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
                {/* Two league rows per row on lg. The open row renders its
                    detail as a full-width strip under the pair, so the
                    neighbour can never be stretched into a blank card. */}
                <div className="flex flex-col gap-px bg-line-soft">
                    {rowPairs.map((pair) => {
                        const openRow = pair.find((entry) => entry.id === expanded) ?? null;
                        const openIsFirst = openRow !== null && openRow.id === pair[0].id;

                        return (
                            <div key={pair[0].id} className="grid grid-cols-1 gap-px bg-line-soft lg:grid-cols-2">
                                {pair.map((row, index) => {
                                    const isOpen = expanded === row.id;

                                    return (
                                        <div
                                            key={row.id}
                                            className={cx(
                                                "min-w-0 bg-surface-2 transition-colors duration-100",
                                                isOpen && "bg-surface shadow-[inset_3px_0_0_0_var(--color-accent)]",
                                                pair.length === 1 && "lg:col-span-2",
                                                index === 0 ? "order-1" : openIsFirst ? "order-3 lg:order-2" : "order-2",
                                            )}
                                        >
                                            <button
                                                type="button"
                                                aria-expanded={isOpen}
                                                onClick={() => toggle(row.id)}
                                                className={cx(
                                                    "group flex w-full flex-col gap-1.5 px-4 py-2.5 text-left transition-colors duration-100",
                                                    isOpen ? "cursor-default" : "hover:bg-surface-3",
                                                )}
                                            >
                                                {/* Line 1 — identity, score and the stat. */}
                                                <span className="flex min-w-0 items-center gap-1.5">
                                                    <span className="w-6 shrink-0 text-right font-mono text-[11px] text-ink-subtle tabular-nums">{row.rank}</span>
                                                    {isOpen ? (
                                                        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
                                                    ) : (
                                                        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
                                                    )}
                                                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink group-hover:text-accent-strong">{row.name}</span>
                                                    <FamilyChip family={row.family} className="hidden shrink-0 sm:inline-flex" />
                                                    <span className="hidden shrink-0 items-center gap-1 rounded-md bg-surface-inset px-1.5 py-0.5 sm:flex" title={`Score 1–100, log-scaled from ${formatNumber(row.score ?? 0)} raw prize points against the theoretical ceiling (every fold a Group 1)`}>
                                                        <span className="font-mono text-[9px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">score</span>
                                                        <span className="font-mono text-[13px] font-semibold text-ink tabular-nums">{row.score100 ?? 1}</span>
                                                    </span>
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
                                        </div>
                                    );
                                })}

                                {openRow && (
                                    <div
                                        className={cx(
                                            "min-w-0 px-4 pb-3 pt-1 lg:col-span-2",
                                            openIsFirst ? "order-2 lg:order-3" : "order-3",
                                        )}
                                    >
                                        <StrategyDetail
                                            key={openRow.id}
                                            row={openRow}
                                            chance={meta.chance}
                                            ballForms={ballForms}
                                            buildRules={playbookById.get(openRow.id)?.rules}
                                            evidencePanels={playbookById.get(openRow.id)?.panels}
                                            prizeEvents={prizeEvents?.strategies?.[openRow.id]}
                                            drawsByNo={drawsByNo}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-muted">No strategy matches that filter.</p>}
            </Panel>
        </div>
    );
};
