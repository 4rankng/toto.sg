import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { SectionFooter } from "@/components/application/section-footers/section-footer";
import { cx } from "@/utils/cx";

const NAV_ITEMS = [
    { to: "/", label: "Latest" },
    { to: "/history", label: "History" },
    { to: "/insights", label: "Insights" },
    { to: "/strategies", label: "Strategies" },
];

/** Move focus to <main> on every route change; pages set their own titles. */
export function usePageTitle(title: string) {
    useEffect(() => {
        document.title = `${title} · toto.sg`;
    }, [title]);
}

export const Layout = () => {
    const mainRef = useRef<HTMLElement>(null);
    const { pathname } = useLocation();

    useEffect(() => {
        mainRef.current?.focus({ preventScroll: true });
    }, [pathname]);

    return (
        <div className="flex min-h-dvh flex-col bg-secondary">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary focus:ring-1 focus:ring-secondary"
            >
                Skip to content
            </a>

            <header className="sticky top-0 z-20 border-b border-secondary bg-primary">
                <div className="mx-auto flex w-full max-w-(--max-width-container) flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 md:gap-x-6 md:px-6">
                    <Link to="/" className="text-md font-semibold text-primary">
                        toto<span className="text-brand-secondary">.sg</span>
                    </Link>
                    <nav aria-label="Main" className="flex flex-wrap items-center gap-x-1 gap-y-1">
                        {NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === "/"}
                                className={({ isActive }) =>
                                    cx(
                                        "rounded-md px-2.5 py-1.5 text-sm font-medium transition duration-100 ease-linear md:px-3 md:py-2",
                                        isActive ? "bg-secondary font-semibold text-primary" : "text-secondary hover:text-secondary_hover",
                                    )
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </header>

            <main ref={mainRef} id="main" tabIndex={-1} className="mx-auto w-full max-w-(--max-width-container) flex-1 px-4 py-6 outline-hidden md:px-6 md:py-8">
                <Outlet />
            </main>

            <footer className="border-t border-secondary bg-primary">
                <div className="mx-auto w-full max-w-(--max-width-container) px-4 md:px-6">
                    <SectionFooter.Root className="flex-col items-start gap-1 py-4 md:flex-row md:items-center md:gap-5">
                        <p className="text-sm font-medium text-secondary">toto.sg</p>
                        <p className="text-sm text-tertiary">Unofficial statistics for Singapore TOTO. Not affiliated with Singapore Pools. 18+. Play responsibly.</p>
                        <SectionFooter.Actions>
                            <p className="text-sm text-quaternary">Data © Singapore Pools · {new Date().getFullYear()}</p>
                        </SectionFooter.Actions>
                    </SectionFooter.Root>
                </div>
            </footer>
        </div>
    );
};
