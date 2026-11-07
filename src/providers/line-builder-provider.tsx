import { type PropsWithChildren, createContext, useCallback, useContext, useMemo, useState } from "react";

/** A TOTO line: distinct numbers from 1 to 49. */
export type Line = number[];

/** System 6, 7 and 8 entries: six, seven or eight numbers per line. */
export const LINE_SIZES = [6, 7, 8] as const;
export type LineSize = (typeof LINE_SIZES)[number];

/** The standard entry. */
export const LINE_SIZE: LineSize = 6;

interface LineBuilderContextValue {
    /** The line currently in the builder. */
    line: Line;
    /** How many numbers the current system entry holds. */
    size: LineSize;
    /** Switch system entry; a longer line is trimmed to the new size. */
    setSize: (size: LineSize) => void;
    /** Add a number, remove it, or — when the line is full — swap it out. */
    toggle: (n: number) => void;
    /** Replace the whole line. */
    setLine: (line: Line) => void;
    /** Empty the line. */
    clear: () => void;
}

const LineBuilderContext = createContext<LineBuilderContextValue | null>(null);

/**
 * The line builder's state. It lives above the router so the strategies page can
 * hand a pick to the board on the home page.
 */
export const LineBuilderProvider = ({ children }: PropsWithChildren) => {
    const [line, setLine] = useState<Line>([]);
    const [size, setSizeState] = useState<LineSize>(LINE_SIZE);

    const setSize = useCallback((next: LineSize) => {
        setSizeState(next);
        setLine((current) => current.slice(0, next));
    }, []);

    const toggle = useCallback(
        (n: number) => {
            setLine((current) => {
                if (current.includes(n)) return current.filter((value) => value !== n);
                if (current.length >= size) return current;
                return [...current, n];
            });
        },
        [size],
    );

    const clear = useCallback(() => setLine([]), []);

    const value = useMemo(() => ({ line, size, setSize, toggle, setLine, clear }), [line, size, setSize, toggle, clear]);

    return <LineBuilderContext.Provider value={value}>{children}</LineBuilderContext.Provider>;
};

export const useLineBuilder = () => {
    const context = useContext(LineBuilderContext);
    if (!context) throw new Error("useLineBuilder must be used inside <LineBuilderProvider>");
    return context;
};
