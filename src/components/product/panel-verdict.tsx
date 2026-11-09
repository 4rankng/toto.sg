import type { JSX } from "react";

import { cx } from "@/utils/cx";

type VerdictTone = "signal" | "null" | "watch";

const TONE_DOT: Record<VerdictTone, string> = {
    signal: "bg-fg-success-primary",
    null: "bg-quaternary",
    watch: "bg-heat-hot",
};

const TONE_LABEL: Record<VerdictTone, string> = {
    signal: "text-secondary",
    null: "text-ink-muted",
    watch: "text-heat-hot",
};

/**
 * One-line computed conclusion for an insight panel — shown only when it
 * carries value: a signal (≥2σ) or a watch/anomaly. A chance-consistent
 * ("null") panel renders nothing — no chip, no `data-verdict` probe — so the
 * page never forces a conclusion that isn't there.
 *
 * On a rendered chip the root's `data-verdict` attribute is the acceptance
 * probe used by tooling, and the optional `pick` / `avoid` / `metric` props
 * are machine-readable values for agent consumers scraping the DOM: `pick` /
 * `avoid` carry the concrete target (`ball-32`, `pair-4-31`, `sum-115-185`),
 * `metric` carries the backing number (`z:+2.3`, `p:0.41`, `hits:118|z:+2.3`).
 */
export function PanelVerdict({ tone, label, detail, pick, avoid, metric }: {
    tone: VerdictTone;
    label: string;
    detail?: string;
    pick?: string;
    avoid?: string;
    metric?: string;
}): JSX.Element | null {
    if (tone === "null") return null;
    return (
        <div
            data-verdict={tone}
            data-verdict-pick={pick}
            data-verdict-avoid={avoid}
            data-verdict-metric={metric}
            className="flex items-center gap-2 rounded-lg border border-line-soft bg-surface px-2.5 py-1.5"
        >
            <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", TONE_DOT[tone])} />
            <span className={cx("min-w-0 text-[12px] leading-4 font-medium", TONE_LABEL[tone])}>{label}</span>
            {detail != null && detail !== "" && (
                <span className="min-w-0 shrink-0 font-mono text-[11px] leading-4 text-ink-subtle tabular-nums">{detail}</span>
            )}
        </div>
    );
}
