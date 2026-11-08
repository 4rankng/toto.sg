import type { FC, ReactNode } from "react";
import { cx } from "@/utils/cx";

type KpiTone = "primary" | "secondary" | "gold" | "down" | "neutral";

interface KpiCardProps {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon: FC<{ className?: string }>;
    tone?: KpiTone;
    className?: string;
}

const TONES: Record<KpiTone, string> = {
    primary: "bg-primary/10 text-primary ring-primary/30",
    secondary: "bg-secondary/10 text-secondary ring-secondary/30",
    gold: "bg-gold-soft text-gold-ink ring-transparent",
    down: "bg-down/10 text-down ring-down/30",
    neutral: "bg-surface-2 text-ink-muted ring-line",
};

/** Console KPI card: icon chip, mono label, one figure, optional hint. */
export function KpiCard({ label, value, hint, icon: Icon, tone = "primary", className }: KpiCardProps) {
    return (
        <div className={cx("flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 panel-glow", className)}>
            <span className={cx("grid size-9 shrink-0 place-items-center rounded-md ring-1 ring-inset", TONES[tone])}>
                <Icon className="size-4" />
            </span>
            <div className="min-w-0">
                <p className="font-mono text-[9px] leading-3 font-semibold tracking-[0.16em] text-ink-subtle uppercase">{label}</p>
                <p className="mt-0.5 truncate font-display text-xl leading-6 font-semibold tracking-tight text-ink tabular-nums">{value}</p>
                {hint && <p className="truncate text-[10px] leading-3 text-ink-subtle">{hint}</p>}
            </div>
        </div>
    );
}
