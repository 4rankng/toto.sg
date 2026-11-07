import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "@untitledui/icons";
import { BallRow } from "@/components/balls";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Panel } from "@/components/panel";
import { td, tdNum, tdSticky, th, thNum } from "@/components/product/table";
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

/** The expanded row of one draw: its maths, read out cell by cell. */
const DrawDetail = ({ draw, id }: { draw: Draw; id: string }) => {
    const sum = drawSum(draw.numbers);
    const odd = drawOddCount(draw.numbers);
    const low = drawLowCount(draw.numbers);
    const spread = drawDecades(draw.numbers);

    return (
        <tr id={id} className="border-b border-line/70 bg-surface-2/40">
            <td colSpan={6} className="px-4 py-4">
                <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                        <div>
                            <dt className="text-[11px] font-medium tracking-[0.06em] text-ink-faint uppercase">Sum</dt>
                            <dd className="mt-0.5 font-mono text-sm font-semibold text-ink tabular-nums">{sum}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-medium tracking-[0.06em] text-ink-faint uppercase">Odd / even</dt>
                            <dd className="mt-0.5 text-sm text-ink">
                                {odd} odd · {draw.numbers.length - odd} even
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-medium tracking-[0.06em] text-ink-faint uppercase">Low / high</dt>
                            <dd className="mt-0.5 text-sm text-ink">
                                {low} low ≤ 24 · {draw.numbers.length - low} high
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-medium tracking-[0.06em] text-ink-faint uppercase">Consecutive</dt>
                            <dd className="mt-0.5 text-sm text-ink">{hasConsecutive(draw.numbers) ? "consecutive numbers" : "no consecutive numbers"}</dd>
                        </div>
                    </dl>
                    <div>
                        <p className="text-[11px] font-medium tracking-[0.06em] text-ink-faint uppercase">Decade spread</p>
                        <div className="mt-2 grid grid-cols-5 gap-1.5">
                            {DECADE_LABELS.map((label, index) => {
                                const count = spread[index];
                                const empty = count === 0;

                                return (
                                    <div
                                        key={label}
                                        className={cx("rounded-lg border px-2 py-1.5 text-center", empty ? "border-line/60" : "border-line bg-surface-3")}
                                    >
                                        <p className="text-[10px] font-medium tracking-[0.06em] text-ink-faint uppercase">{label}</p>
                                        <p className={cx("font-mono text-sm tabular-nums", empty ? "text-ink-faint" : "text-ink")}>{count}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    );
};

export const HistoryScreen = () => {
    usePageTitle("Draw history — every TOTO draw on record");

    const { data: draws, isLoading, error } = useJson<Draw[]>("/data/draws.json");
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

    if (isLoading) {
        return <div className="py-24 text-center text-sm text-ink-subtle">Loading draws…</div>;
    }

    if (error || !draws) {
        return (
            <Panel title="Couldn't load the draw archive" description={error?.message ?? "public/data/draws.json is missing."}>
                <p className="text-sm text-ink-subtle">Run `npm run refresh` to regenerate the data files, then reload.</p>
            </Panel>
        );
    }

    const oldest = newestFirst[newestFirst.length - 1];
    const newest = newestFirst[0];

    const firstRow = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
    const lastRow = Math.min(safePage * PAGE_SIZE, filtered.length);

    const panelDescription =
        filterSummary.length > 0
            ? `${formatNumber(filtered.length)} matches · ${filterSummary.join(" · ")}`
            : `${formatNumber(draws.length)} draws · newest first`;

    const filters = (
        <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={applySearch} placeholder="Search: 7 and 23, or 4232" size="sm" className="w-64" aria-label="Search draws" />
            <Select
                items={yearOptions}
                selectedKey={year}
                onSelectionChange={(key) => applyYear(key === null ? ALL_YEARS : String(key))}
                placeholder="All years"
                size="sm"
                className="w-32"
                aria-label="Filter by year"
            >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
            {hasFilter && (
                <Button color="secondary" size="sm" onPress={clearFilters}>
                    Clear
                </Button>
            )}
        </div>
    );

    const pagination = (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-xs text-ink-subtle">
                Showing{" "}
                <span className="font-mono text-ink tabular-nums">
                    {firstRow}–{lastRow}
                </span>{" "}
                of <span className="font-mono text-ink tabular-nums">{formatNumber(filtered.length)}</span> draws · page{" "}
                <span className="font-mono text-ink tabular-nums">{safePage}</span> of <span className="font-mono text-ink tabular-nums">{pageCount}</span>
            </p>
            <div role="group" aria-label="Archive pages" className="flex items-center gap-1.5">
                <Button color="secondary" size="sm" isDisabled={safePage <= 1} onPress={() => setPage(1)}>
                    First
                </Button>
                <Button color="secondary" size="sm" isDisabled={safePage <= 1} onPress={() => setPage(safePage - 1)}>
                    Prev
                </Button>
                <Button color="secondary" size="sm" isDisabled={safePage >= pageCount} onPress={() => setPage(safePage + 1)}>
                    Next
                </Button>
                <Button color="secondary" size="sm" isDisabled={safePage >= pageCount} onPress={() => setPage(pageCount)}>
                    Last
                </Button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <div>
                    <p className="text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">Explore</p>
                    <h1 className="text-xl font-semibold tracking-tight text-ink">Draw history</h1>
                    <p className="mt-0.5 text-sm text-ink-subtle">
                        {formatNumber(draws.length)} draws · {oldest ? formatDate(oldest.date) : "—"} → {newest ? formatDate(newest.date) : "—"}
                    </p>
                </div>
            </header>

            <Panel isFlush title="Draw archive" description={panelDescription} actions={filters} footer={filtered.length > 0 ? pagination : undefined}>
                {rows.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
                        <p className="text-sm text-ink-subtle">No draw matches that search.</p>
                        <Button color="secondary" size="sm" onPress={clearFilters}>
                            Clear filters
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto xl:overflow-visible">
                        <table className="w-full min-w-[720px] border-collapse text-left">
                            <thead>
                                <tr>
                                    <th className={cx(th, "sticky left-0 z-20 w-24 pl-4 first:rounded-tl-xl")}>Draw</th>
                                    <th className={th}>Date</th>
                                    <th className={th}>Weekday</th>
                                    <th className={th}>Numbers</th>
                                    <th className={thNum}>Sum</th>
                                    <th className={cx(th, "w-12 pr-4 text-right last:rounded-tr-xl")}>
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
                                                className={cx(
                                                    "border-b border-line/70 bg-surface transition-colors duration-150 hover:bg-surface-2/60",
                                                    isOpen && "bg-surface-2/60",
                                                )}
                                            >
                                                <td className={cx(tdSticky, "pl-4")}>
                                                    <button
                                                        type="button"
                                                        aria-expanded={isOpen}
                                                        aria-controls={isOpen ? detailId : undefined}
                                                        onClick={() => setExpanded(isOpen ? null : draw.draw)}
                                                        className="rounded font-mono text-sm font-medium text-ink tabular-nums transition-colors duration-150 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                                    >
                                                        {draw.draw}
                                                    </button>
                                                </td>
                                                <td className={td}>{formatDate(draw.date)}</td>
                                                <td className={cx(td, "text-ink-subtle")}>{weekdayOf(draw.date)}</td>
                                                <td className={td}>
                                                    <BallRow numbers={draw.numbers} additional={draw.additional} size="sm" />
                                                </td>
                                                <td className={tdNum}>{drawSum(draw.numbers)}</td>
                                                <td className={cx(td, "pr-4 text-right")}>
                                                    <button
                                                        type="button"
                                                        aria-expanded={isOpen}
                                                        aria-controls={isOpen ? detailId : undefined}
                                                        aria-label={`${isOpen ? "Hide" : "Show"} detail for draw ${draw.draw}`}
                                                        onClick={() => setExpanded(isOpen ? null : draw.draw)}
                                                        className="rounded p-1 text-ink-faint transition-colors duration-150 hover:bg-surface-3 hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                                    >
                                                        {isOpen ? (
                                                            <ChevronDown aria-hidden="true" className="size-4" />
                                                        ) : (
                                                            <ChevronRight aria-hidden="true" className="size-4" />
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                            {isOpen && <DrawDetail draw={draw} id={detailId} />}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
};
