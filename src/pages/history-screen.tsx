import { useMemo, useState } from "react";
import { SearchLg } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { PaginationCardAdvanced } from "@/components/application/pagination/pagination";
import { Table } from "@/components/application/table/table";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Balls } from "@/components/balls";
import { Panel } from "@/components/panel";
import { usePageTitle } from "@/pages/layout";
import { formatDate, formatNumber, formatSgd, useJson, type Draw } from "@/lib/data";

const PAGE_SIZE = 50;
const ERA_BOUNDARY = "2014-10-09";

const sumOf = (d: Draw) => d.numbers.reduce((a, b) => a + b, 0);
const oddCount = (d: Draw) => d.numbers.filter((n) => n % 2 === 1).length;
const lowCount = (d: Draw) => d.numbers.filter((n) => n <= 24).length;
const hasConsecutive = (d: Draw) => {
    const s = [...d.numbers].sort((a, b) => a - b);
    return s.some((n, i) => i > 0 && n === s[i - 1] + 1);
};

export const HistoryScreen = () => {
    usePageTitle("Draw history");

    const { data: draws, isLoading, error } = useJson<Draw[]>("/data/draws.json");
    const [query, setQuery] = useState("");
    const [year, setYear] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const years = useMemo(() => {
        const set = new Set((draws ?? []).map((d) => d.date.slice(0, 4)));
        return [...set].sort((a, b) => b.localeCompare(a));
    }, [draws]);

    const filtered = useMemo(() => {
        let rows = [...(draws ?? [])].sort((a, b) => b.draw - a.draw);
        if (year) rows = rows.filter((d) => d.date.startsWith(year));
        const q = query.trim().toLowerCase();
        if (q) rows = rows.filter((d) => String(d.draw).includes(q) || d.date.includes(q) || formatDate(d.date).toLowerCase().includes(q));
        return rows;
    }, [draws, query, year]);

    const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
    const safePage = Math.min(page, pageCount);
    const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const updateQuery = (value: string) => {
        setQuery(value);
        setPage(1);
    };
    const updateYear = (value: string | null) => {
        setYear(value);
        setPage(1);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-24">
                <LoadingIndicator type="line-spinner" size="md" label="Loading draw history…" />
            </div>
        );
    }

    if (error || !draws) {
        return (
            <Panel title="Couldn't load draw history" description={error?.message ?? "The data files are missing or unreadable."}>
                <Button color="primary" onClick={() => window.location.reload()}>
                    Retry
                </Button>
            </Panel>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
                <h1 className="text-display-sm font-semibold text-primary">Draw history</h1>
                <p className="text-md text-tertiary">
                    {formatNumber(draws.length)} draws on record
                </p>
            </header>

            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1 sm:max-w-72">
                    <Input
                        aria-label="Filter by draw number or date"
                        placeholder="e.g. 4232 or 05 Nov 2026"
                        icon={SearchLg}
                        value={query}
                        onChange={updateQuery}
                    />
                </div>
                <Select
                    aria-label="Filter by year"
                    placeholder="All years"
                    selectedKey={year}
                    onSelectionChange={(key) => updateYear(key == null ? null : String(key))}
                    items={years.map((y) => ({ id: y, label: y }))}
                    className="w-36"
                >
                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                </Select>
                {(query || year) && (
                    <Button
                        color="secondary"
                        size="md"
                        onPress={() => {
                            setQuery("");
                            setYear(null);
                            setPage(1);
                        }}
                    >
                        Clear filters
                    </Button>
                )}
            </div>

            {rows.length === 0 ? (
                <Panel title="No results">
                    <EmptyState size="sm">
                        <EmptyState.FeaturedIcon color="gray" theme="modern" icon={SearchLg} size="sm" />
                        <EmptyState.Title>No results{query ? ` for “${query}”` : ""}</EmptyState.Title>
                        <EmptyState.Description>Try a different draw number, date or year.</EmptyState.Description>
                        <EmptyState.Footer>
                            <Button
                                color="secondary"
                                onPress={() => {
                                    setQuery("");
                                    setYear(null);
                                    setPage(1);
                                }}
                            >
                                Clear filters
                            </Button>
                        </EmptyState.Footer>
                    </EmptyState>
                </Panel>
            ) : (
                <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                    <div className="overflow-x-auto">
                        <Table
                            aria-label="Draw history"
                            size="sm"
                            className="[&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
                        >
                            <Table.Header>
                                <Table.Head id="draw" isRowHeader>Draw</Table.Head>
                                <Table.Head id="date">Date</Table.Head>
                                <Table.Head id="numbers">Winning numbers</Table.Head>
                                <Table.Head id="add">Add</Table.Head>
                                <Table.Head id="game">Game</Table.Head>
                                <Table.Head id="sum">Sum</Table.Head>
                                <Table.Head id="oddEven">O/E</Table.Head>
                                <Table.Head id="lowHigh">L/H</Table.Head>
                                <Table.Head id="consecutive">Consec.</Table.Head>
                                <Table.Head id="g1Winners">G1 win.</Table.Head>
                                <Table.Head id="g1Prize">G1 prize</Table.Head>
                            </Table.Header>
                            <Table.Body>
                                {rows.map((d) => (
                                    <Table.Row key={d.draw} id={d.draw}>
                                        <Table.Cell>
                                            <span className="font-semibold text-primary tabular-nums">{d.draw}</span>
                                        </Table.Cell>
                                        <Table.Cell>{formatDate(d.date)}</Table.Cell>
                                        <Table.Cell>
                                            <Balls numbers={d.numbers} size="sm" />
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="tabular-nums">{d.additional ?? "—"}</span>
                                        </Table.Cell>
                                        <Table.Cell>{d.date < ERA_BOUNDARY ? <Badge color="gray" size="sm" type="modern">6/45</Badge> : null}</Table.Cell>
                                        <Table.Cell>
                                            <span className="tabular-nums">{sumOf(d)}</span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="tabular-nums">{oddCount(d)}:{6 - oddCount(d)}</span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="tabular-nums">{lowCount(d)}:{6 - lowCount(d)}</span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {hasConsecutive(d) ? (
                                                <span className="text-secondary">Yes</span>
                                            ) : (
                                                <span className="text-quaternary">No</span>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="tabular-nums">{d.prizes?.g1.winners != null ? formatNumber(d.prizes.g1.winners) : "—"}</span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="tabular-nums">{d.prizes?.g1.share != null ? formatSgd(d.prizes.g1.share) : "—"}</span>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    </div>
                    <PaginationCardAdvanced
                        page={safePage}
                        total={pageCount}
                        pageSize={PAGE_SIZE}
                        onPageChange={setPage}
                    />
                </div>
            )}
        </div>
    );
};
