import { Link } from "react-router";
import { usePageTitle } from "@/pages/layout";

export const NotFound = () => {
    usePageTitle("Page not found");

    return (
        <div className="flex flex-col items-start gap-3 py-16">
            <p className="text-xs font-medium tracking-[0.08em] text-ink-faint uppercase">404</p>
            <h1 className="font-display text-xl font-semibold tracking-tight text-ink">That page isn&apos;t here</h1>
            <p className="max-w-md text-sm text-ink-subtle">The draw archive, insights and the strategy league live at the four routes below.</p>
            <Link to="/" className="text-sm font-medium text-accent transition-colors duration-150 hover:text-accent-strong">
                Back to the latest draw →
            </Link>
        </div>
    );
};
