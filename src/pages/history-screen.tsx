import { Fragment, useEffect, useMemo, useState } from "react";
import { Activity, BarChart01, Calendar, ChevronDown, ChevronRight, Hash01 } from "@untitledui/icons";
import { BallRow } from "@/components/balls";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Panel } from "@/components/panel";
import { KpiCard } from "@/components/product/kpi-card";
import { PageHeader } from "@/components/product/page-header";
import { DataLoading, PageHeaderSkeleton, RowsSkeleton } from "@/components/product/skeleton";
import { td, tdNum, th, thNum } from "@/components/product/table";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import {
    type Draw,
    drawDecades,
    drawLowCount,
    drawMatchesQuery,
    drawOddCount,
    drawSum,
    formatDate,
    formatNumber,
    hasConsecutive,
    parseDrawQuery,
    useJson,
    weekdayOf,
} from "@/lib/data";
import { usePageTitle } from "@/pages/layout";
import { cx } from "@/utils/cx";

/** Rows per page of the archive table. */
const PAGE_SIZE = 50;

/** Sentinel id for the "no year filter" option in the year select. */
const ALL_YEARS = "all";

/** Decade bands of a draw's detail row — the buckets `drawDecades` counts. */
const DECADE_LABELS = ["1–10", "11–20", "21–30", "31–40", "41–49"];

/** The expanded details of one draw: its maths, read out cell by cell. */
const DrawDetail = ({ draw }: { draw: Draw }) => {
    const sum = drawSum(draw.numbers);
    const odd = drawOddCount(draw.numbers);
    const low = drawLowCount(draw.numbers);
    const spread = drawDecades(draw.numbers);

    return (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[1.6fr_1fr]">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Sum</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-ink tabular-nums">{sum}</dd>
                </div>
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Odd / even</dt>
                    <dd className="mt-0.5 text-[13px] text-ink">
                        {odd} / {draw.numbers.length - odd}
                    </dd>
                </div>
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Low / high</dt>
                    <dd className="mt-0.5 text-[13px] text-ink">
                        {low} / {draw.numbers.length - low}
                    </dd>
                </div>
                <div>
                    <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Consecutive</dt>
                    <dd className="mt-0.5 text-[13px] text-ink">{hasConsecutive(draw.numbers) ? "Yes" : "No"}</dd>
                </div>
            </dl>
            <div>
                <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">By decade</p>
                <div className="mt-1.5 grid grid-cols-5 gap-1">
                    {DECADE_LABELS.map((label, index) => {
                        const count = spread[index];
                        const empty = count === 0;

                        return (
                            <div
                                key={label}
                                className={cx("rounded-md border px-1 py-1 text-center", empty ? "border-line/60" : "border-line bg-surface-3")}
                            >
                                <p className="text-[10px] text-ink-subtle">{label}</p>
                                <p className={cx("font-mono text-xs tabular-nums", empty ? "text-ink-faint" : "text-ink")}>{count}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const ArchiveSkeleton = () => (
    <DataLoading label="Loading draws">
        <PageHeaderSkeleton />
        <RowsSkeleton count={10} />
    </DataLoading>
);

export const HistoryScreen = () => {
    usePageTitle("Draw history — every TOTO draw");

    const { data: draws, isLoading, error } = useJson<Draw[]>("/data/draws.json");
    // Phones get the large control size so every filter stays tappable.
    const isCompact = !useBreakpoint("md");
    const [search, setSearch] = useState("");
    const [year, setYear] = useState<string>(ALL_YEARS);
    const [page, setPage] = useState(1);
    const [expanded, setExpanded] = useState<number | null>(null);

    /** Every draw, newest first. */
    const newestFirst = useMemo(() => [...(draws ?? [])].sort((a, b) => b.draw - a.draw), [draws]);

    const yearOptions = useMemo(() => {
        const seen: Record<string, true> = {};
        for (const draw of newestFirst) seen[draw.date.slice(0, 4)] = true;

        const years = Object.keys(seen).sort((a, b) => b.localeCompare(a));
        return [{ id: ALL_YEARS, label: "All years" }, ...years.map((y) => ({ id: y, label: y }))];
    }, [newestFirst]);

    const query = useMemo(() => parseDrawQuery(search), [search]);

    const filtered = useMemo(
        () => newestFirst.filter((draw) => (year === ALL_YEARS || draw.date.startsWith(year)) && drawMatchesQuery(draw, query)),
        [newestFirst, query, year],
    );

    const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
    const safePage = Math.min(Math.max(page, 1), pageCount);
    const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // The result set can shrink under the current page — fall back to the last
    // page that still holds rows.
    useEffect(() => {
        if (page !== safePage) setPage(safePage);
    }, [page, safePage]);

    /** Human summary of the filters in force, e.g. "contains 7, 23 · 2024". */
    const filterSummary = useMemo(() => {
        const parts: string[] = [];
        if (query.numbers.length > 0) parts.push(`contains ${query.numbers.join(", ")}`);
        if (query.draw !== null) parts.push(`draw ${query.draw}`);
        if (query.date !== null) parts.push(query.date);
        if (year !== ALL_YEARS) parts.push(year);
        return parts;
    }, [query, year]);

    const hasFilter = search.trim().length > 0 || year !== ALL_YEARS;

    const applySearch = (value: string) => {
        setSearch(value);
        setPage(1);
        setExpanded(null);
    };

    const applyYear = (value: string) => {
        setYear(value);
        setPage(1);
        setExpanded(null);
    };

    const clearFilters = () => {
        setSearch("");
        setYear(ALL_YEARS);
        setPage(1);
        setExpanded(null);
    };

    if (isLoading) return <ArchiveSkeleton />;

    if (error || !draws) {
        return (
            <Panel title="Draw archive unavailable" description={error?.message ?? "The draw file is missing."}>
                <p className="text-sm text-ink-muted">Run `npm run refresh`, then reload.</p>
            </Panel>
        );
    }

    const oldest = newestFirst[newestFirst.length - 1];
    const newest = newestFirst[0];

    const firstRow = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
    const lastRow = Math.min(safePage * PAGE_SIZE, filtered.length);

    const panelDescription =
        filterSummary.length > 0 ? `${formatNumber(filtered.length)} matches · ${filterSummary.join(" · ")}` : `${formatNumber(draws.length)} draws · newest first`;

    const filters = (
        <div className="flex flex-wrap items-center gap-1.5">
            <Input
                value={search}
                onChange={applySearch}
                placeholder="Search: 7 and 23, or 4232"
                size={isCompact ? "lg" : "sm"}
                className="w-60"
                aria-label="Search draws"
            />
            <Select
                items={yearOptions}
                selectedKey={year}
                onSelectionChange={(key) => applyYear(key === null ? ALL_YEARS : String(key))}
                placeholder="All years"
                size={isCompact ? "lg" : "sm"}
                className="w-32"
                aria-label="Filter by year"
            >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
            {hasFilter && (
                <Button color="secondary" size="sm" onPress={clearFilters} className="max-md:h-11">
                    Clear
                </Button>
            )}
        </div>
    );

    const pagination = (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="font-mono text-[11px] text-ink-subtle tabular-nums">
                {firstRow}–{lastRow} of {formatNumber(filtered.length)} · page {safePage}/{pageCount}
            </p>
            <div role="group" aria-label="Archive pages" className="flex items-center gap-1">
                <Button color="secondary" size="sm" isDisabled={safePage <= 1} onPress={() => setPage(1)} className="max-md:h-11">
                    First
                </Button>
                <Button color="secondary" size="sm" isDisabled={safePage <= 1} onPress={() => setPage(safePage - 1)} className="max-md:h-11">
                    Prev
                </Button>
                <Button color="secondary" size="sm" isDisabled={safePage >= pageCount} onPress={() => setPage(safePage + 1)} className="max-md:h-11">
                    Next
                </Button>
                <Button color="secondary" size="sm" isDisabled={safePage >= pageCount} onPress={() => setPage(pageCount)} className="max-md:h-11">
                    Last
                </Button>
            </div>
        </div>
    );

    const toggle = (drawNo: number) => setExpanded((current) => (current === drawNo ? null : drawNo));

    return (
        <div className="flex flex-col gap-3">
            <PageHeader
                kicker="Archive"
                title="Draw history"
                meta={
                    <>
                        <span>
                            <span className="font-mono text-ink-muted tabular-nums">{formatNumber(draws.length)}</span> draws
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                            {oldest ? formatDate(oldest.date) : "—"} → {newest ? formatDate(newest.date) : "—"}
                        </span>
                    </>
                }
                actions={
                    <span className="text-[11px] text-ink-subtle">Tap a row for sum, odd/even and the decade counts</span>
                }
            />

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <KpiCard label="Draws" value={formatNumber(draws.length)} hint="2008 → now" icon={Hash01} tone="primary" />
                <KpiCard
                    label="Span"
                    value={`${Number(newest.date.slice(0, 4)) - Number(oldest.date.slice(0, 4))} yrs`}
                    hint={oldest ? formatDate(oldest.date) : undefined}
                    icon={Calendar}
                    tone="secondary"
                />
                <KpiCard label="Latest draw" value={newest.draw} hint={formatDate(newest.date)} icon={Activity} tone="neutral" />
                <KpiCard label="Latest sum" value={drawSum(newest.numbers)} hint="six numbers" icon={BarChart01} tone="gold" />
            </div>

            <Panel isFlush title="All draws" description={panelDescription} actions={filters} footer={filtered.length > 0 ? pagination : undefined}>
                {rows.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
                        <p className="text-sm text-ink-muted">No draw matches that search.</p>
                        <Button color="secondary" size="sm" onPress={clearFilters}>
                            Clear filters
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Phone: one card per draw. */}
                        <div className="md:hidden">
                            {rows.map((draw) => {
                                const isOpen = expanded === draw.draw;
                                const odd = drawOddCount(draw.numbers);
                                const low = drawLowCount(draw.numbers);

                                return (
                                    <article key={draw.draw} className={cx("border-b border-line-soft last:border-0", isOpen && "bg-surface-2/50")}>
                                        <button
                                            type="button"
                                            aria-expanded={isOpen}
                                            onClick={() => toggle(draw.draw)}
                                            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                                        >
                                            <div className="min-w-0">
                                                <p className="flex items-baseline gap-2">
                                                    <span className="font-mono text-sm font-semibold text-ink tabular-nums">{draw.draw}</span>
                                                    <span className="truncate text-xs text-ink-subtle">
                                                        {formatDate(draw.date)} · {weekdayOf(draw.date)}
                                                    </span>
                                                </p>
                                                <div className="mt-1.5">
                                                    <BallRow numbers={draw.numbers} additional={draw.additional} size="sm" />
                                                </div>
                                                <p className="mt-1.5 font-mono text-[11px] text-ink-subtle tabular-nums">
                                                    sum {drawSum(draw.numbers)} · odd {odd} · ≤ 24: {low}
                                                </p>
                                            </div>
                                            {isOpen ? (
                                                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
                                            ) : (
                                                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
                                            )}
                                        </button>
                                        {isOpen && (
                                            <div className="border-t border-line-soft bg-surface-2/40 px-3 py-3">
                                                <DrawDetail draw={draw} />
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>

                        {/* Tablet and up: the dense table. */}
                        <div className="hidden min-w-0 md:block">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr>
                                        <th className={cx(th, "w-20 pl-3")}>Draw</th>
                                        <th className={th}>Date</th>
                                        <th className={cx(th, "hidden lg:table-cell")}>Day</th>
                                        <th className={th}>Numbers</th>
                                        <th className={thNum}>Sum</th>
                                        <th className={thNum}>Odd</th>
                                        <th className={thNum}>≤ 24</th>
                                        <th className={cx(th, "w-10 pr-3 text-right last:rounded-tr-xl")}>
                                            <span className="sr-only">Detail</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((draw) => {
                                        const isOpen = expanded === draw.draw;
                                        const detailId = `draw-detail-${draw.draw}`;

                                        return (
                                            <Fragment key={draw.draw}>
                                                <tr
                                                    onClick={() => toggle(draw.draw)}
                                                    className={cx(
                                                        "cursor-pointer border-b border-line-soft bg-surface transition-colors duration-100 hover:bg-surface-2/60",
                                                        isOpen && "bg-surface-2/60",
                                                    )}
                                                >
                                                    <td className={cx(td, "pl-3")}>
                                                        <button
                                                            type="button"
                                                            aria-expanded={isOpen}
                                                            aria-controls={isOpen ? detailId : undefined}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                toggle(draw.draw);
                                                            }}
                                                            className="rounded font-mono text-[13px] font-semibold text-ink tabular-nums transition-colors duration-100 hover:text-accent"
                                                        >
                                                            {draw.draw}
                                                        </button>
                                                    </td>
                                                    <td className={td}>{formatDate(draw.date)}</td>
                                                    <td className={cx(td, "hidden text-ink-subtle lg:table-cell")}>{weekdayOf(draw.date)}</td>
                                                    <td className={td}>
                                                        <BallRow numbers={draw.numbers} additional={draw.additional} size="sm" />
                                                    </td>
                                                    <td className={tdNum}>{drawSum(draw.numbers)}</td>
                                                    <td className={tdNum}>{drawOddCount(draw.numbers)}</td>
                                                    <td className={tdNum}>{drawLowCount(draw.numbers)}</td>
                                                    <td className={cx(td, "pr-3 text-right")}>
                                                        <span
                                                            aria-hidden="true"
                                                            className="inline-grid size-7 place-items-center rounded-md text-ink-subtle"
                                                        >
                                                            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {isOpen && (
                                                    <tr id={detailId} className="border-b border-line-soft bg-surface-2/40">
                                                        <td colSpan={8} className="px-3 py-3">
                                                            <DrawDetail draw={draw} />
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </Panel>
        </div>
    );
};
