import { type PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** What the reader picked: follow the system, or pin one mode. */
export type ThemeChoice = "system" | "light" | "dark";

/** What is actually on screen. */
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "toto-theme";

interface ThemeContextValue {
    /** The stored choice. */
    choice: ThemeChoice;
    /** The mode in effect right now. */
    resolved: ResolvedTheme;
    setChoice: (choice: ThemeChoice) => void;
    /** Flip between light and dark, leaving "system" behind. */
    toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readStoredChoice = (): ThemeChoice => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") return stored;
    } catch {
        /* Private mode: the choice still applies for this session. */
    }
    // The console is dark first; the toggle still pins light for anyone who wants it.
    return "dark";
};

/**
 * Theme state. The CSS itself follows `prefers-color-scheme` through
 * `color-scheme` + `light-dark()`, so this provider only has to record an
 * explicit override and mirror the OS preference for the toggle's icon.
 */
export const ThemeProvider = ({ children }: PropsWithChildren) => {
    const [choice, setChoiceState] = useState<ThemeChoice>(readStoredChoice);
    const [system, setSystem] = useState<ResolvedTheme>(() => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? "dark" : "light");
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    const resolved: ResolvedTheme = choice === "system" ? system : choice;

    // The attribute is what `color-scheme: only light | only dark` keys off.
    useEffect(() => {
        const root = document.documentElement;
        if (choice === "system") delete root.dataset.theme;
        else root.dataset.theme = choice;
    }, [choice]);

    const setChoice = useCallback((next: ThemeChoice) => {
        setChoiceState(next);
        try {
            if (next === "system") localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, next);
        } catch {
            /* Private mode: the choice still applies for this session. */
        }
    }, []);

    const toggle = useCallback(() => {
        setChoice(resolved === "dark" ? "light" : "dark");
    }, [resolved, setChoice]);

    const value = useMemo(() => ({ choice, resolved, setChoice, toggle }), [choice, resolved, setChoice, toggle]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
    return context;
};
