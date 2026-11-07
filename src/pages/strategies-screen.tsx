import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { Button } from "@/components/base/buttons/button";
import { Table } from "@/components/application/table/table";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Panel } from "@/components/panel";
import { Balls } from "@/components/balls";
import { usePageTitle } from "@/pages/layout";
import { formatPercent, formatSgd, useJson, type PrizeKey, type StrategyRow } from "@/lib/data";

const PRIZE_KEYS: PrizeKey[] = ["g1", "g2", "g3", "g4", "g5", "g6", "g7"];

const sortableValue = (row: StrategyRow, column: string): number => {
    if (column === "totalWinnings") return row.totalWinnings ?? -1;
    if (column.startsWith("g")) return row.prizeCounts[column as PrizeKey];
    return row[column as "hitRate" | "totalPrizes" | "evaluatedDraws"];
};

/** Nonzero prize groups as a compact "G5: 3, G7: 21" list. */
function GroupsWon({ row }: { row: StrategyRow }) {
    const won = PRIZE_KEYS.filter((key) => row.prizeCounts[key] > 0);
    if (won.length === 0) return <span className="text-quaternary">—</span>;
    return <span className="tabular-nums">{won.map((key) => `G${key.slice(1)}: ${row.prizeCounts[key]}`).join(", ")}</span>;
}

export const StrategiesScreen = () => {
    usePageTitle("Strategy rankings");

    const { data: rows, isLoading, error } = useJson<StrategyRow[]>("/data/strategies.json");
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor | undefined>(undefined);

    const rankById = useMemo(() => new Map((rows ?? []).map((r, i) => [r.id, i + 1])), [rows]);

    const sorted = useMemo(() => {
        if (!rows) return null;
        if (!sortDescriptor) return rows;
        const dir = sortDescriptor.direction === "ascending" ? 1 : -1;
        return [...rows].sort((a, b) => (sortableValue(a, String(sortDescriptor.column)) - sortableValue(b, String(sortDescriptor.column))) * dir);
    }, [rows, sortDescriptor]);

    if (isLoading) {
        return (
            <div className="flex justify-center py-24">
                <LoadingIndicator type="line-spinner" size="md" label="Loading strategy rankings…" />
            </div>
        );
    }

    if (error || !sorted) {
        return (
            <Panel title="Couldn't load strategy rankings" description={error?.message ?? "Run `npm run refresh` to generate the data files."}>
                <Button color="primary" onClick={() => window.location.reload()}>
                    Retry
                </Button>
            </Panel>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
                <h1 className="text-display-sm font-semibold text-primary">Strategy rankings</h1>
                <p className="text-md text-tertiary">{sorted.length} deterministic lines, scored walk-forward on every draw since 2014</p>
            </header>

            <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                <div className="overflow-x-auto">
                    <Table
                        aria-label="Strategy rankings"
                        size="sm"
                        sortDescriptor={sortDescriptor}
                        onSortChange={setSortDescriptor}
                        className="[&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
                    >
                        <Table.Header>
                            <Table.Head id="rank" isRowHeader>#</Table.Head>
                            <Table.Head id="name">Strategy</Table.Head>
                            <Table.Head id="hitRate" allowsSorting>Hit rate</Table.Head>
                            <Table.Head id="totalPrizes" allowsSorting>Prizes</Table.Head>
                            <Table.Head id="groups">Groups won</Table.Head>
                            <Table.Head id="totalWinnings" allowsSorting>Winnings</Table.Head>
                            <Table.Head id="evaluatedDraws" allowsSorting>Evaluated</Table.Head>
                            <Table.Head id="currentPick">Current pick</Table.Head>
                        </Table.Header>
                        <Table.Body>
                            {sorted.map((row) => (
                                <Table.Row key={row.id} id={row.id}>
                                    <Table.Cell>
                                        <span className="font-semibold text-primary tabular-nums">{rankById.get(row.id)}</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Tooltip title={row.name} description={row.description} placement="top">
                                            <button
                                                type="button"
                                                className="cursor-pointer text-left font-medium text-secondary underline decoration-dotted decoration-secondary underline-offset-2 outline-brand transition duration-100 ease-linear hover:text-secondary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                                            >
                                                {row.name}
                                            </button>
                                        </Tooltip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span className="font-semibold text-primary tabular-nums">{formatPercent(row.hitRate)}</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span className="tabular-nums">{row.totalPrizes}</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <GroupsWon row={row} />
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span className="tabular-nums">{row.totalWinnings != null ? formatSgd(row.totalWinnings) : "—"}</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span className="tabular-nums">{row.evaluatedDraws}</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Balls numbers={row.currentPick} size="sm" />
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </div>
            </div>

            <Panel title="Methodology">
                <ul className="list-disc flex flex-col gap-1 pl-5 text-sm text-tertiary">
                    <li>Walk-forward evaluation: for each historical draw, every strategy picks using only draws before it — no lookahead.</li>
                    <li>Warm-up: the first 100 draws of the 6/49 era train frequency features and are never scored.</li>
                    <li>Hit rate = share of evaluated draws winning any prize group (3 matches or more). Prize groups follow Toto rules: 3, 4, 5, 5+additional and 6 matches pay Groups 7, 5, 3, 2 and 1; +additional tiers are Groups 2, 4 and 6.</li>
                    <li>Winnings sum published Group shares; only 2022+ draws carry amounts, so draws without published shares count as prizes but not winnings.</li>
                    <li>Frequency ties break by recency, then by number. Random (Seeded) is uniform random seeded by draw number for reproducibility.</li>
                    <li>TOTO is a random draw: the ranked differences are small and past behavior does not predict future draws. Play for fun, 18+.</li>
                </ul>
            </Panel>
        </div>
    );
};
