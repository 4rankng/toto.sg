import { cx } from "@/utils/cx";

/** Muted tone per strategy family — 28 families, one fixed colour each. */
const FAMILY_TONE: Record<string, string> = {
    "Almanac & Time": "bg-fam-01/12 text-fam-01 ring-fam-01/25",
    Blends: "bg-fam-02/12 text-fam-02 ring-fam-02/25",
    Controls: "bg-fam-03/12 text-fam-03 ring-fam-03/25",
    Decades: "bg-fam-23/12 text-fam-23 ring-fam-23/25",
    Ensemble: "bg-fam-04/12 text-fam-04 ring-fam-04/25",
    "Folk & Culture": "bg-fam-05/12 text-fam-05 ring-fam-05/25",
    Frequency: "bg-fam-06/12 text-fam-06 ring-fam-06/25",
    Gambler: "bg-fam-22/12 text-fam-22 ring-fam-22/25",
    "Gap & Due": "bg-fam-07/12 text-fam-07 ring-fam-07/25",
    "Hot & Cold": "bg-fam-08/12 text-fam-08 ring-fam-08/25",
    Indicators: "bg-fam-21/12 text-fam-21 ring-fam-21/25",
    "Machine Learning": "bg-fam-09/12 text-fam-09 ring-fam-09/25",
    "Mark Six Charts": "bg-fam-10/12 text-fam-10 ring-fam-10/25",
    Momentum: "bg-fam-11/12 text-fam-11 ring-fam-11/25",
    Numerology: "bg-fam-24/12 text-fam-24 ring-fam-24/25",
    Other: "bg-fam-12/12 text-fam-12 ring-fam-12/25",
    Pairs: "bg-fam-13/12 text-fam-13 ring-fam-13/25",
    "Pari-mutuel": "bg-fam-14/12 text-fam-14 ring-fam-14/25",
    Pattern: "bg-fam-15/12 text-fam-15 ring-fam-15/25",
    Sequence: "bg-fam-16/12 text-fam-16 ring-fam-16/25",
    Sequences: "bg-fam-17/12 text-fam-17 ring-fam-17/25",
    Celestials: "bg-gold-soft text-gold-ink ring-transparent",
    Tempos: "bg-fam-24/12 text-fam-24 ring-fam-24/25",
    Sovereigns: "bg-gold-soft text-gold-ink ring-transparent",
    "Board Hunters": "bg-fam-21/12 text-fam-21 ring-fam-21/25",
    "Crown Kings": "bg-fam-27/12 text-fam-27 ring-fam-27/25",
    Zodiac: "bg-fam-28/12 text-fam-28 ring-fam-28/25",
    Skip: "bg-fam-25/12 text-fam-25 ring-fam-25/25",
    Structure: "bg-fam-19/12 text-fam-19 ring-fam-19/25",
    "Sum Band": "bg-fam-20/12 text-fam-20 ring-fam-20/25",
    Triples: "bg-fam-26/12 text-fam-26 ring-fam-26/25",
};

interface FamilyChipProps {
    family: string;
    className?: string;
}

/** Colour-coded family label — the only place family gets a hue. */
export function FamilyChip({ family, className }: FamilyChipProps) {
    const tone = FAMILY_TONE[family] ?? "bg-fam-12/12 text-fam-12 ring-fam-12/25";

    return (
        <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", tone, className)}>
            {family}
        </span>
    );
}
