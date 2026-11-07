import { useEffect, useState } from "react";

export interface Countdown {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    /** Total milliseconds left; 0 once the target has passed. */
    remaining: number;
    isPast: boolean;
}

/** Split a millisecond span into days / hours / minutes / seconds. */
const split = (ms: number): Countdown => {
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, remaining: 0, isPast: true };

    const totalSeconds = Math.floor(ms / 1000);
    return {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
        remaining: ms,
        isPast: false,
    };
};

/** Live countdown to a target instant. Ticks once per second. */
export function useCountdown(target: Date | null): Countdown {
    const [countdown, setCountdown] = useState<Countdown>(() => split((target?.getTime() ?? 0) - Date.now()));

    useEffect(() => {
        if (!target) {
            setCountdown(split(0));
            return;
        }

        const tick = () => setCountdown(split(target.getTime() - Date.now()));
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [target]);

    return countdown;
}
