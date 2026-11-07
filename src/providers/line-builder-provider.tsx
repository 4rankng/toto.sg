import { type PropsWithChildren, createContext, useCallback, useContext, useMemo, useState } from "react";

/** A TOTO line: six distinct numbers from 1 to 49. */
export type Line = number[];

/** How many numbers a line holds. */
export const LINE_SIZE = 6;

interface LineBuilderContextValue {
    /** The line currently in the builder. */
    line: Line;
    /** Add a number, remove it, or — when the line is full — swap it out. */
    toggle: (n: number) => void;
    /** Replace the whole line. */
    setLine: (line: Line) => void;
    /** Empty the line. */
    clear: () => void;
}

const LineBuilderContext = createContext<LineBuilderContextValue | null>(null);

/**
 * The line builder's state. It lives above the router so the strategies page
 * can hand a strategy's pick to the board on the home page.
 */
export const LineBuilderProvider = ({ children }: PropsWithChildren) => {
    const [line, setLine] = useState<Line>([]);

    const toggle = useCallback((n: number) => {
        setLine((current) => {
            if (current.includes(n)) return current.filter((value) => value !== n);
            if (current.length >= LINE_SIZE) return current;
            return [...current, n];
        });
    }, []);

    const clear = useCallback(() => setLine([]), []);

    const value = useMemo(() => ({ line, toggle, setLine, clear }), [line, toggle, clear]);

    return <LineBuilderContext.Provider value={value}>{children}</LineBuilderContext.Provider>;
};

export const useLineBuilder = () => {
    const context = useContext(LineBuilderContext);
    if (!context) throw new Error("useLineBuilder must be used inside <LineBuilderProvider>");
    return context;
};
