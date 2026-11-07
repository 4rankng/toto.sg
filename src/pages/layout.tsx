import { useEffect, useRef } from "react";
import { Menu01 } from "@untitledui/icons";
import {
    Button as AriaButton,
    Menu as AriaMenu,
    MenuItem as AriaMenuItem,
    MenuTrigger as AriaMenuTrigger,
    Popover as AriaPopover,
} from "react-aria-components";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ThemeToggle } from "@/components/product/theme-toggle";
import { cx } from "@/utils/cx";

const NAV_ITEMS = [
    { to: "/", label: "Latest" },
    { to: "/history", label: "History" },
    { to: "/insights", label: "Insights" },
    { to: "/strategies", label: "Strategies" },
];

/** Set the document title for the active route; pages call this themselves. */
export function usePageTitle(title: string) {
    useEffect(() => {
        document.title = `${title} · toto.sg`;
    }, [title]);
}

export const Layout = () => {
    const mainRef = useRef<HTMLElement>(null);
    const navigate = useNavigate();
    const { pathname } = useLocation();

    useEffect(() => {
        mainRef.current?.focus({ preventScroll: true });
    }, [pathname]);

    return (
        <div className="flex min-h-dvh flex-col bg-canvas">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface-2 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:ring-1 focus:ring-line-strong"
            >
                Skip to content
            </a>

            <header className="sticky top-0 z-30 h-13 border-b border-line bg-canvas/85 backdrop-blur-md">
                <div className="mx-auto flex h-full w-full max-w-[1400px] items-center gap-4 px-4 md:px-6">
                    {/* No wordmark: the navigation is the header and starts at the edge. */}
                    <nav aria-label="Main" className="hidden h-full items-stretch md:flex">
                        {NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === "/"}
                                className={({ isActive }) =>
                                    cx(
                                        "relative flex h-full items-center px-3.5 text-[13px] font-medium transition-colors duration-100 ease-linear lg:px-4",
                                        isActive ? "text-ink" : "text-ink-subtle hover:text-ink",
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        {item.label}
                                        {isActive && (
                                            <span aria-hidden="true" className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-t-full bg-accent" />
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-1.5">
                        <ThemeToggle />

                        <AriaMenuTrigger>
                            <AriaButton
                                aria-label="Open navigation"
                                className="grid size-11 place-items-center rounded-lg border border-line bg-surface text-ink-muted transition-colors duration-100 ease-linear hover:bg-surface-2 hover:text-ink md:hidden"
                            >
                                <Menu01 aria-hidden="true" className="size-5" />
                            </AriaButton>
                            <AriaPopover
                                placement="bottom end"
                                offset={8}
                                className="z-50 min-w-52 rounded-xl border border-line bg-surface p-1 shadow-float outline-none"
                            >
                                <AriaMenu className="flex flex-col outline-none">
                                    {NAV_ITEMS.map((item) => (
                                        <AriaMenuItem
                                            key={item.to}
                                            onAction={() => navigate(item.to)}
                                            className="flex min-h-11 items-center justify-between rounded-lg px-3 text-sm text-ink-muted transition-colors duration-100 outline-none data-[focused]:bg-surface-2 data-[focused]:text-ink data-[hovered]:bg-surface-2 data-[hovered]:text-ink"
                                        >
                                            {item.label}
                                            {pathname === item.to && <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />}
                                        </AriaMenuItem>
                                    ))}
                                </AriaMenu>
                            </AriaPopover>
                        </AriaMenuTrigger>
                    </div>
                </div>
            </header>

            <main
                ref={mainRef}
                id="main"
                tabIndex={-1}
                className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 outline-hidden md:px-6 md:py-6"
            >
                <div key={pathname} className="animate-fade">
                    <Outlet />
                </div>
            </main>

            <footer className="border-t border-line bg-canvas">
                <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-1.5 px-4 py-4 text-[11px] leading-4 text-ink-subtle md:flex-row md:items-center md:justify-between md:px-6">
                    <p>
                        <span className="font-semibold text-ink-muted">toto.sg</span> — unofficial statistics for Singapore TOTO. Not affiliated with Singapore
                        Pools.
                    </p>
                    <p className="text-ink-subtle">
                        Data: Singapore Pools results · 1,892 draws · 6/49 era since Oct 2014 · for entertainment &amp; analysis only
                    </p>
                </div>
            </footer>
        </div>
    );
};
