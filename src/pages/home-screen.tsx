import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BallRow } from "@/components/balls";
import { Panel } from "@/components/panel";
import { ScoreBar } from "@/components/product/score-bar";
import { StatTile } from "@/components/product/stat-tile";
import { td } from "@/components/product/table";
import { useCountdown } from "@/hooks/use-countdown";
import {
    type Analysis,
    type Draw,
    type LatestResult,
    type StrategiesFile,
    formatDate,
    formatNumber,
    formatSgd,
    nextDrawDate,
    useJson,
    weekdayOf,
} from "@/lib/data";
import { usePageTitle } from "@/pages/layout";

const CountdownUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-3xl leading-none font-semibold tracking-tight text-ink tabular-nums sm:text-4xl">{String(value).padStart(2, "0")}</span>
        <span className="text-[10px] font-medium tracking-[0.1em] text-ink-faint uppercase">{label}</span>
    </div>
);

export const HomeScreen = () => {
    usePageTitle("Singapore TOTO latest draw & monitor");

    const { data: draws, isLoading, error } = useJson<Draw[]>("/data/draws.json");
    const { data: analysis } = useJson<Analysis>("/data/analysis.json");
    const { data: league } = useJson<StrategiesFile>("/data/strategies.json");
    const [live, setLive] = useState<LatestResult | null>(null);

    // Live freshness check: on Netlify the function serves /api/latest; local
    // dev has no function, and the bundled head stands in.
    useEffect(() => {
        let cancelled = false;
        fetch("/api/latest")
            .then((res) => (res.ok ? res.json() : null))
            .then((data: LatestResult | null) => {
                if (!cancelled && data?.drawNo) setLive(data);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    const latest = useMemo(() => draws?.at(-1) ?? null, [draws]);
    const lastDrawDate = live?.date ?? latest?.date ?? null;

    const nextDraw = useMemo(() => (lastDrawDate ? nextDrawDate(lastDrawDate) : null), [lastDrawDate]);
    const countdown = useCountdown(nextDraw);

    const topStrategies = useMemo(() => (league ? [...league.strategies].sort((a, b) => a.rank - b.rank).slice(0, 5) : []), [league]);

    if (isLoading) {
        return <div className="py-24 text-center text-sm text-ink-subtle">Loading draw data…</div>;
    }

    if (error || !draws || !latest) {
        return (
            <Panel title="Couldn't load the draw archive" description={error?.message ?? "public/data/draws.json is missing."}>
                <p className="text-sm text-ink-subtle">Run `npm run refresh` to regenerate the data files, then reload.</p>
            </Panel>
        );
    }

    const numbers = live?.numbers ?? latest.numbers;
    const additional = live?.additional ?? latest.additional;
    const drawNo = live?.drawNo ?? latest.draw;
    const date = live?.date ?? latest.date;
    const prizes = live?.prizes ?? latest.prizes;
    const baseline = league?.meta.chance.scoreBaseline ?? 45;

    const hotBall = analysis?.hot.all[0];
    const longestGap = analysis?.overdue[0];
    const era = analysis?.coverage;

    return (
        <div className="flex flex-col gap-4">
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <div>
                    <p className="text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">Monitor</p>
                    <h1 className="text-xl font-semibold tracking-tight text-ink">Latest draw</h1>
                    <p className="mt-0.5 text-sm text-ink-subtle">
                        Draw <span className="font-mono tabular-nums">{drawNo}</span> · {formatDate(date)} · {weekdayOf(date)}
                    </p>
                </div>
                <Link to="/history" className="text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-strong">
                    Browse all {formatNumber(draws.length)} draws →
                </Link>
            </header>

            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr]">
                <Panel
                    title={`Draw ${drawNo}`}
                    description={`${formatDate(date)} · ${weekdayOf(date)} · 6/49`}
                    actions={
                        live ? (
                            <span className="rounded-md bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent ring-1 ring-accent-line ring-inset">
                                Live
                            </span>
                        ) : undefined
                    }
                >
                    <BallRow numbers={numbers} additional={additional} size="xl" />

                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
                        <div>
                            <dt className="text-[11px] font-medium tracking-[0.06em] text-ink-faint uppercase">Group 1</dt>
                            <dd className="mt-0.5 font-mono text-sm font-semibold text-gold-ink tabular-nums">
                                {prizes?.g1?.share ? formatSgd(prizes.g1.share) : "—"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-medium tracking-[0.06em] text-ink-faint uppercase">Group 2</dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{prizes?.g2?.share ? formatSgd(prizes.g2.share) : "—"}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-medium tracking-[0.06em] text-ink-faint uppercase">Group 1 winners</dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink tabular-nums">{prizes?.g1?.winners ?? (prizes?.g1?.share ? "1" : "—")}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-medium tracking-[0.06em] text-ink-faint uppercase">Additional</dt>
                            <dd className="mt-0.5 font-mono text-sm text-accent tabular-nums">{additional ?? "—"}</dd>
                        </div>
                    </dl>
                </Panel>

                <Panel title="Next draw" description={`Draw ${league?.meta.nextDraw ?? "—"} · Mon & Thu, 18:30 SGT`}>
                    {nextDraw ? (
                        <>
                            <div className="grid grid-cols-4 gap-2">
                                <CountdownUnit value={countdown.days} label="days" />
                                <CountdownUnit value={countdown.hours} label="hrs" />
                                <CountdownUnit value={countdown.minutes} label="min" />
                                <CountdownUnit value={countdown.seconds} label="sec" />
                            </div>
                            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-subtle">
                                Draw {league?.meta.nextDraw ?? "—"} · {formatDate(nextDraw.toISOString().slice(0, 10))} ·{" "}
                                {weekdayOf(nextDraw.toISOString().slice(0, 10))}, 18:30 SGT
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-ink-subtle">Next draw time unavailable.</p>
                    )}
                </Panel>
                <Panel
                    title="Strategy league — top 5"
                    description="Walk-forward performance against the chance baseline. Not predictive power."
                    actions={
                        <Link to="/strategies" className="text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-strong">
                            All {league?.strategies.length ?? 0} strategies →
                        </Link>
                    }
                    isFlush
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] border-collapse text-left">
                            <thead>
                                <tr className="border-b border-line">
                                    <th className="px-4 py-2 text-[11px] font-medium tracking-[0.06em] text-ink-subtle uppercase">#</th>
                                    <th className="px-4 py-2 text-[11px] font-medium tracking-[0.06em] text-ink-subtle uppercase">Strategy</th>
                                    <th className="px-4 py-2 text-[11px] font-medium tracking-[0.06em] text-ink-subtle uppercase">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topStrategies.map((strategy) => (
                                    <tr key={strategy.id} className="border-b border-line/70 last:border-0">
                                        <td className={td + " pl-4 font-mono text-xs tabular-nums"}>{strategy.rank}</td>
                                        <td className={td + " max-w-40 truncate font-medium text-ink"}>{strategy.name}</td>
                                        <td className={td + " pr-4"}>
                                            <div className="flex items-center gap-2">
                                                <ScoreBar score={strategy.score} baseline={baseline} tone={strategy.rank === 1 ? "gold" : "primary"} />
                                                <span className="w-9 text-right font-mono text-xs text-ink tabular-nums">{strategy.score.toFixed(1)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Draws tracked" value={formatNumber(draws.length)} hint="Since 03 Jul 2008" />
                <StatTile label="6/49 era" value={formatNumber(era?.totalDraws ?? 0)} hint={`Since ${era?.firstDate ? formatDate(era.firstDate) : "—"}`} />
                <StatTile
                    label="Hottest ball"
                    value={hotBall ? hotBall.number : "—"}
                    hint={hotBall ? `${formatNumber(hotBall.count)} appearances` : undefined}
                    tone="primary"
                />
                <StatTile
                    label="Longest absence"
                    value={longestGap ? longestGap.number : "—"}
                    hint={longestGap ? `${formatNumber(longestGap.gap)} draws since seen` : undefined}
                />
            </div>
        </div>
    );
};
