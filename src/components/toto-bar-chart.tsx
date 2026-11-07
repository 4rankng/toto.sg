import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipContent } from "@/components/application/charts/charts-base";

interface TotoBarChartProps {
    /** Data points: `{ name, value }`, one per bar. */
    data: { name: string; value: number }[];
    height?: number;
    /** Show every Nth x-axis label. */
    interval?: number;
    ariaLabel: string;
}

/**
 * Single-series bar chart on Untitled UI tokens (recharts reads the theme's
 * CSS variables directly, so it tracks light/dark without extra work).
 */
export function TotoBarChart({ data, height = 260, interval = 4, ariaLabel }: TotoBarChartProps) {
    return (
        <div role="img" aria-label={ariaLabel}>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid vertical={false} stroke="var(--color-border-tertiary)" />
                    <XAxis
                        dataKey="name"
                        tick={{ fill: "var(--color-text-tertiary)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--color-border-tertiary)" }}
                        interval={interval}
                    />
                    <YAxis
                        tick={{ fill: "var(--color-text-tertiary)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                    />
                    <Tooltip
                        cursor={{ fill: "var(--color-bg-secondary)" }}
                        content={<ChartTooltipContent />}
                    />
                    <Bar dataKey="value" fill="var(--color-bg-brand-solid)" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
