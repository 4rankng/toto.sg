import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "@untitledui/icons";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Table } from "@/components/application/table/table";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Balls } from "@/components/balls";
import { Panel } from "@/components/panel";
import { usePageTitle } from "@/pages/layout";
import {
    formatNumber,
    formatDate,
    formatSgd,
    useJson,
    type Analysis,
    type Draw,
    type LatestResult,
    type PrizeKey,
} from "@/lib/data";

const PRIZE_KEYS: PrizeKey[] = ["g1", "g2", "g3", "g4", "g5", "g6", "g7"];

const PRIZE_LABELS: Record<PrizeKey, string> = {
    g1: "Group 1",
    g2: "Group 2",
    g3: "Group 3",
    g4: "Group 4",
    g5: "Group 5",
    g6: "Group 6",
    g7: "Group 7",
};

export const HomeScreen = () => {
    usePageTitle("Singapore TOTO results & statistics");

    const { data: draws, isLoading, error } = useJson<Draw[]>("/data/draws.json");
    const { data: analysis } = useJson<Analysis>("/data/analysis.json");
    const [live, setLive] = useState<LatestResult | null>(null);

    const latest = useMemo(() => draws?.at(-1) ?? null, [draws]);

    // Live freshness check: on Netlify the function serves /api/latest; local dev
    // has no function, and the bundled head stays.
    useEffect(() => {
        if (!latest) return;
        const controller = new AbortController();
        fetch("/api/latest", { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((result: LatestResult | null) => {
                if (result && typeof result.drawNo === "number" && result.drawNo > latest.draw) setLive(result);
            })
            .catch(() => {});
        return () => controller.abort();
    }, [latest]);

    if (isLoading) {
        return (
            <div className="flex justify-center py-24">
                <LoadingIndicator type="line-spinner" size="md" label="Loading draw data…" />
            </div>
        );
    }

    if (error || !draws || !analysis) {
        return (
            <Panel title="Couldn't load draw data" description={error?.message ?? "The data files are missing or unreadable."}>
                <Button color="primary" onClick={() => window.location.reload()}>
                    Retry
                </Button>
            </Panel>
        );
    }

    const latestRow = draws[draws.length - 1];
    const hero = live
        ? {
              draw: live.drawNo,
              date: live.date,
              numbers: live.numbers,
              additional: live.additional,
              prizes: live.prizes,
          }
        : {
              draw: latestRow.draw,
              date: latestRow.date,
              numbers: latestRow.numbers,
              additional: latestRow.additional,
              prizes: latestRow.prizes ?? null,
          };

    const previous = [...draws].slice(-7, -1).reverse();

    return (
        <div className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
                <h1 className="text-display-sm font-semibold text-primary">Latest TOTO result</h1>
                <p className="text-md text-tertiary">Draw {hero.draw} · {formatDate(hero.date)}</p>
            </header>

            {live && (
                <BadgeWithDot color="warning" type="modern" size="md">
                    Live from Singapore Pools — stats update at next data refresh
                </BadgeWithDot>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Panel title={`Draw ${hero.draw}`} description={live ? "Fetched live" : "Newest result in the database"}>
                    <div className="flex flex-col gap-4">
                        <Balls numbers={hero.numbers} additional={hero.additional} size="md" />
                        {hero.prizes && (
                            <div className="overflow-x-auto">
                                <Table aria-label={`Prize shares for draw ${hero.draw}`} size="sm">
                                    <Table.Header>
                                        <Table.Head id="group" isRowHeader>Group</Table.Head>
                                        <Table.Head id="prize">Prize</Table.Head>
                                        <Table.Head id="winners">Winners</Table.Head>
                                    </Table.Header>
                                    <Table.Body>
                                        {PRIZE_KEYS.map((key) => {
                                            const prize = hero.prizes?.[key];
                                            return (
                                                <Table.Row key={key} id={key}>
                                                    <Table.Cell>
                                                        <span className="whitespace-nowrap">{PRIZE_LABELS[key]}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span className="tabular-nums">{prize?.share != null ? formatSgd(prize.share) : "—"}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <span className="tabular-nums">{prize?.winners != null ? formatNumber(prize.winners) : "—"}</span>
                                                    </Table.Cell>
                                                </Table.Row>
                                            );
                                        })}
                                    </Table.Body>
                                </Table>
                            </div>
                        )}
                    </div>
                </Panel>

                <div className="grid grid-cols-2 content-start gap-4 lg:grid-cols-1">
                    <StatCard label="Draws in database" value={formatNumber(draws.length)} />
                    <StatCard label="Coverage" value={`${draws[0].draw}–${draws[draws.length - 1].draw}`} />
                    <StatCard label="Most drawn (6/49 era)" value={String(analysis.hot.all[0]?.number ?? "—")} hint={`${formatNumber(analysis.hot.all[0]?.count ?? 0)} times`} />
                    <StatCard label="Most overdue (6/49 era)" value={String(analysis.overdue[0]?.number ?? "—")} hint={`${analysis.overdue[0]?.gap ?? 0} draws`} />
                </div>
            </div>

            <Panel
                title="Previous draws"
                actions={
                    <Button href="/history" color="link-color" size="sm" iconTrailing={ArrowRight}>
                        Full history
                    </Button>
                }
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {previous.map((d) => (
                        <div key={d.draw} className="flex flex-col gap-2 rounded-lg bg-secondary p-3">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-semibold text-primary tabular-nums">{d.draw}</span>
                                <span className="text-xs text-quaternary">{formatDate(d.date)}</span>
                            </div>
                            <Balls numbers={d.numbers} additional={d.additional} size="sm" />
                        </div>
                    ))}
                </div>
            </Panel>
        </div>
    );
};

const StatCard = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="flex flex-col gap-0.5 rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
        <p className="text-sm text-tertiary">{label}</p>
        <p className="text-lg font-semibold text-primary tabular-nums">
            {value}
            {hint && <span className="ml-1 text-sm font-normal text-quaternary">{hint}</span>}
        </p>
    </div>
);
