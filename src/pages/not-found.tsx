import { Link } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { usePageTitle } from "@/pages/layout";

export const NotFound = () => {
    usePageTitle("Page not found");

    return (
        <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-ink-subtle">404</p>
            <h1 className="font-display text-xl font-semibold tracking-tight text-ink md:text-2xl">That page isn&apos;t here</h1>
            <p className="max-w-sm text-sm leading-5 text-ink-muted">The draw archive, stats and rule rankings sit at the four links in the header.</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" href="/">
                    Latest draw
                </Button>
                <Button size="sm" color="secondary" href="/history">
                    Draw history
                </Button>
                <Link to="/strategies" className="text-xs font-semibold text-accent transition-colors duration-100 hover:text-accent-strong">
                    Rule rankings →
                </Link>
            </div>
        </div>
    );
};
