import { Moon01, Sun } from "@untitledui/icons";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";

interface ThemeToggleProps {
    className?: string;
}

/**
 * Light/dark switch. The button shows the mode it switches *to*, so the icon
 * reads as the action rather than the state.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
    const { resolved, toggle } = useTheme();
    const label = resolved === "dark" ? "Switch to light theme" : "Switch to dark theme";

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={label}
            title={label}
            className={cx(
                "grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-muted transition-colors duration-150 ease-linear hover:bg-surface-2 hover:text-ink",
                className,
            )}
        >
            {resolved === "dark" ? <Sun aria-hidden="true" className="size-5" /> : <Moon01 aria-hidden="true" className="size-5" />}
        </button>
    );
}
