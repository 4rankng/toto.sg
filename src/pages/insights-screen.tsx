import { useState } from "react";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Table } from "@/components/application/table/table";
import { Tabs } from "@/components/application/tabs/tabs";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Panel } from "@/components/panel";
import { TotoBarChart } from "@/components/toto-bar-chart";
import { usePageTitle } from "@/pages/layout";
import { formatNumber, formatPercent, formatSgd, useJson, type Analysis, type GapEntry, type HotColdEntry } from "@/lib/data";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const freqToData = (freq: number[]) => freq.map((value, i) => ({ name: String(i + 1), value }));

function NumberChipList({ entries, value }: { entries: (GapEntry | HotColdEntry)[]; value: (e: GapEntry | HotColdEntry) => number }) {
    return (
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
            {entries.map((e) => (
                <li key={e.number} className="flex items-center gap-1.5">
                    <Badge color="gray" type="color" size="md">{e.number}</Badge>
                    <span className="text-sm text-secondary tabular-nums">{value(e)}</span>
                </li>
            ))}
        </ul>
    );
}

const gapBucket = (gap: number) => (gap <= 5 ? "success" : gap <= 15 ? "warning" : "error");

export const InsightsScreen = () => {
    usePageTitle("Insights");

    const { data: analysis, isLoading, error } = useJson<Analysis>("/data/analysis.json");
    const [tab, setTab] = useState<"all" | "last50">("all");

    if (isLoading) {
        return (
            <div className="flex justify-center py-24">
                <LoadingIndicator type="line-spinner" size="md" label="Loading analysis…" />
            </div>
        );
    }

    if (error || !analysis) {
        return (
            <Panel title="Couldn't load analysis" description={error?.message ?? "Run `npm run refresh` to generate the data files."}>
                <Button color="primary" onClick={() => window.location.reload()}>
                    Retry
                </Button>
            </Panel>
        );
    }

    const coverage = analysis.coverage;

    return (
        <div className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
                <h1 className="text-display-sm font-semibold text-primary">Insights</h1>
                <p className="text-md text-tertiary">
                    {formatNumber(coverage.totalDraws)} draws in the 6/49 era · {coverage.firstDate} → {coverage.lastDate} (draws {coverage.firstDraw}–{coverage.lastDraw})
                </p>
            </header>

            <div className="grid gap-4 lg:grid-cols-2">
                <Tabs
                    selectedKey={tab}
                    onSelectionChange={(key) => setTab(key as "all" | "last50")}
                    className="lg:col-span-2"
                >
                    <Panel
                        title="Number frequency"
                        description="Draws containing each number, 1–49"
                        actions={
                            <Tabs.List aria-label="Frequency window" type="button-gray">
                                <Tabs.Item id="all">All-time</Tabs.Item>
                                <Tabs.Item id="last50">Last 50</Tabs.Item>
                            </Tabs.List>
                        }
                    >
                        <Tabs.Panel id="all">
                            <TotoBarChart data={freqToData(analysis.frequency.all)} height={300} interval={4} ariaLabel="Bar chart of how many draws each number 1 to 49 appeared in, all time" />
                        </Tabs.Panel>
                        <Tabs.Panel id="last50">
                            <TotoBarChart data={freqToData(analysis.frequency.last50)} height={300} interval={4} ariaLabel="Bar chart of how many of the last 50 draws each number 1 to 49 appeared in" />
                        </Tabs.Panel>
                    </Panel>
                </Tabs>

                <Panel title="Hot numbers" description="12 most frequent (all-time · last 50)">
                    <div className="flex flex-col gap-4">
                        <NumberChipList entries={analysis.hot.all} value={(e) => ("count" in e ? e.count : e.gap)} />
                        <hr className="border-t border-tertiary" />
                        <NumberChipList entries={analysis.hot.last50} value={(e) => ("count" in e ? e.count : e.gap)} />
                    </div>
                </Panel>

                <Panel title="Cold numbers" description="12 least frequent (all-time · last 50)">
                    <div className="flex flex-col gap-4">
                        <NumberChipList entries={analysis.cold.all} value={(e) => ("count" in e ? e.count : e.gap)} />
                        <hr className="border-t border-tertiary" />
                        <NumberChipList entries={analysis.cold.last50} value={(e) => ("count" in e ? e.count : e.gap)} />
                    </div>
                </Panel>

                <Panel title="Overdue" description="Top 12 by draws since last seen">
                    <NumberChipList entries={analysis.overdue} value={(e) => e.gap} />
                </Panel>

                <Panel title="Odd / even & low / high" description="Distribution of odd and low (1–24) counts per draw">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TotoBarChart
                            data={analysis.oddEven.map((value, k) => ({ name: String(k), value }))}
                            height={200}
                            interval={1}
                            ariaLabel="Bar chart of how many draws had zero to six odd numbers"
                        />
                        <TotoBarChart
                            data={analysis.lowHigh.map((value, k) => ({ name: String(k), value }))}
                            height={200}
                            interval={1}
                            ariaLabel="Bar chart of how many draws had zero to six low numbers"
                        />
                    </div>
                    <p className="mt-2 text-sm text-quaternary">X-axis: odd / low numbers per draw (0–6).</p>
                </Panel>

                <Panel title="Sum of winning numbers" description={`Mean ${analysis.sum.mean} · median ${analysis.sum.median}`}>
                    <TotoBarChart
                        data={analysis.sum.bands.map((b) => ({ name: b.band, value: b.count }))}
                        height={220}
                        interval={0}
                        ariaLabel="Histogram of draw sums across eight bands from 60 to 299"
                    />
                </Panel>

                <Panel title="Decade spread" description="Average count per draw by decade">
                    <TotoBarChart
                        data={analysis.decades.map((value, i) => ({ name: `${i === 0 ? 1 : i * 10}–${i === 0 ? 9 : i * 10 + 9}`, value }))}
                        height={220}
                        interval={0}
                        ariaLabel="Bar chart of average numbers drawn per decade from 1-9 to 40-49"
                    />
                </Panel>

                <Panel title="Consecutive & pairs" description="Adjacent pairs, co-drawn pairs, repeaters">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-tertiary">
                                Draws with a consecutive pair: <span className="font-semibold text-primary tabular-nums">{formatPercent(analysis.consecutive.drawRate)}</span>
                            </p>
                            <p className="text-sm text-tertiary">
                                Winning numbers repeating from previous draw: <span className="font-semibold text-primary tabular-nums">{formatPercent(analysis.repeaters.rate)}</span> (avg {analysis.repeaters.avgCount} per draw)
                            </p>
                            <div className="overflow-x-auto">
                                <Table aria-label="Most frequent consecutive pairs" size="sm">
                                    <Table.Header>
                                        <Table.Head id="pair" isRowHeader>Pair</Table.Head>
                                        <Table.Head id="count">Draws</Table.Head>
                                    </Table.Header>
                                    <Table.Body>
                                        {analysis.consecutive.topPairs.map((p) => (
                                            <Table.Row key={`${p.a}-${p.b}`} id={`${p.a}-${p.b}`}>
                                                <Table.Cell>
                                                    <span className="font-semibold text-primary tabular-nums">{p.a}–{p.b}</span>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <span className="tabular-nums">{p.count}</span>
                                                </Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <Table aria-label="Most frequently co-drawn pairs" size="sm">
                                <Table.Header>
                                    <Table.Head id="pair" isRowHeader>Pair</Table.Head>
                                    <Table.Head id="count">Draws</Table.Head>
                                </Table.Header>
                                <Table.Body>
                                    {analysis.pairs.map((p) => (
                                        <Table.Row key={`${p.a}-${p.b}`} id={`${p.a}-${p.b}`}>
                                            <Table.Cell>
                                                <span className="font-semibold text-primary tabular-nums">{p.a} + {p.b}</span>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <span className="tabular-nums">{p.count}</span>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        </div>
                    </div>
                </Panel>

                <Panel
                    title="Last seen"
                    description="Draws since each number last appeared · dot: green ≤5, amber 6–15, red >15"
                    className="lg:col-span-2"
                >
                    <ul className="flex flex-wrap gap-1.5">
                        {analysis.lastSeen.map((e) => (
                            <li key={e.number}>
                                <BadgeWithDot color={gapBucket(e.gap)} type="pill-color" size="md">
                                    {e.number} · {e.gap}
                                </BadgeWithDot>
                            </li>
                        ))}
                    </ul>
                </Panel>

                <Panel title="Draw days" description="Draw count and mean sum per weekday">
                    <div className="overflow-x-auto">
                        <Table aria-label="Draw counts and mean sums per weekday" size="sm">
                            <Table.Header>
                                <Table.Head id="day" isRowHeader>Day</Table.Head>
                                <Table.Head id="count">Draws</Table.Head>
                                <Table.Head id="meanSum">Mean sum</Table.Head>
                            </Table.Header>
                            <Table.Body>
                                {WEEKDAYS.filter((day) => (analysis.weekday[day]?.count ?? 0) > 0).map((day) => (
                                    <Table.Row key={day} id={day}>
                                        <Table.Cell>{day}</Table.Cell>
                                        <Table.Cell>
                                            <span className="tabular-nums">{formatNumber(analysis.weekday[day].count)}</span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="tabular-nums">{analysis.weekday[day].meanSum}</span>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    </div>
                </Panel>

                <Panel title="Group 1 by year" description="Winning tickets and biggest jackpot per year">
                    <div className="overflow-x-auto">
                        <Table aria-label="Group 1 winners and maximum jackpot by year" size="sm">
                            <Table.Header>
                                <Table.Head id="year" isRowHeader>Year</Table.Head>
                                <Table.Head id="wins">G1 winners</Table.Head>
                                <Table.Head id="maxJackpot">Max jackpot</Table.Head>
                            </Table.Header>
                            <Table.Body>
                                {Object.entries(analysis.group1ByYear)
                                    .sort(([a], [b]) => b.localeCompare(a))
                                    .map(([year, data]) => (
                                        <Table.Row key={year} id={year}>
                                            <Table.Cell>
                                                <span className="font-semibold text-primary tabular-nums">{year}</span>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <span className="tabular-nums">{formatNumber(data.wins)}</span>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <span className="tabular-nums">{data.maxJackpot ? formatSgd(data.maxJackpot) : "—"}</span>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                            </Table.Body>
                        </Table>
                    </div>
                </Panel>
            </div>
        </div>
    );
};
