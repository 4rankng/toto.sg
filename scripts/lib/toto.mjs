// toto.sg — parsing + scoring primitives. Plain Node ESM, zero deps.

export const BROWSER_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse "dd Mmm yyyy" to ISO yyyy-mm-dd. Throws on failure. */
export function parseDateIso(str) {
    const m = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/.exec(str);
    if (!m) throw new Error(`Unparseable date: ${JSON.stringify(str.slice(0, 60))}`);
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) throw new Error(`Unparseable date month: ${str}`);
    return `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function toAmount(text) {
    const digits = String(text).replace(/[^\d]/g, "");
    return digits ? Number(digits) : null;
}

function stripTags(html) {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .trim();
}

/** Split a winning-shares table into rows of stripped cell texts. */
function prizeTableRows(html) {
    const table = /tableWinningShares[\s\S]*?<\/table>/i.exec(html);
    if (!table) return null;
    const rows = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let row;
    while ((row = rowRe.exec(table[0]))) {
        const cells = [];
        const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let cell;
        while ((cell = cellRe.exec(row[1]))) cells.push(stripTags(cell[1]));
        if (cells.length) rows.push(cells);
    }
    return rows;
}

/** Core draw extraction. `html` must contain the draw's numbers, prize table (and optionally its date / draw number). */
function buildDraw({ html, dateStr, drawNo }) {
    const wins = new Map();
    const winRe = /class=["']win([1-6])["'][^>]*>(\d{1,2})</gi;
    let m;
    while ((m = winRe.exec(html))) wins.set(Number(m[1]), Number(m[2]));
    const numbers = [1, 2, 3, 4, 5, 6].map((i) => wins.get(i));
    if (numbers.some((n) => n === undefined)) {
        throw new Error(`Draw ${drawNo ?? "?"}: unparseable winning numbers (found ${JSON.stringify(numbers)})`);
    }

    const addMatch = /class=["']additional["'][^>]*>(\d{1,2})</i.exec(html);
    const additional = addMatch ? Number(addMatch[1]) : null;

    const jackpotMatch = /class=["']jackpotPrize["'][^>]*>\$([\d,]+)</i.exec(html);
    const jackpot = jackpotMatch ? Number(jackpotMatch[1].replace(/,/g, "")) : null;

    let prizes;
    const rows = prizeTableRows(html);
    if (rows) {
        prizes = {};
        for (const cells of rows) {
            const g = /Group\s+([1-7])/i.exec(cells[0] ?? "");
            if (!g) continue;
            prizes[`g${g[1]}`] = { share: toAmount(cells[1]), winners: toAmount(cells[2]) };
        }
    }
    if (jackpot != null) {
        prizes ??= {};
        prizes.g1 ??= { share: null, winners: null };
        if (prizes.g1.share == null) prizes.g1.share = jackpot;
    }
    // Normalize: every group present, null-filled
    if (prizes) {
        for (let g = 1; g <= 7; g++) prizes[`g${g}`] ??= { share: null, winners: null };
    }

    const date = dateStr ? parseDateIso(dateStr) : null;
    return { numbers, additional, prizes, ...(date ? { date } : {}), ...(drawNo != null ? { draw: drawNo } : {}) };
}

/** Parse one server-rendered per-draw page (sr/toto_results.aspx). Fails loudly. */
export function parseDrawHtml(html, drawNo) {
    const head = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})(?:[\s\S]{0,150}?)Draw No\.\s*(\d+)/i.exec(html);
    if (!head) throw new Error(`Draw ${drawNo ?? "?"}: unparseable date / draw number header`);
    const draw = buildDraw({ html, dateStr: head[1], drawNo: Number(head[2]) });
    if (drawNo != null && draw.draw !== drawNo) {
        throw new Error(`Draw ${drawNo}: page header says Draw No. ${draw.draw}`);
    }
    return draw;
}

/** Parse the 6-latest-draws fragment into full draw records. */
export function parseFragment(html) {
    const headRe = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})(?:[\s\S]{0,150}?)Draw No\.\s*(\d+)/gi;
    const heads = [...html.matchAll(headRe)];
    const draws = [];
    for (let i = 0; i < heads.length; i++) {
        const bodyStart = heads[i].index;
        const bodyEnd = i + 1 < heads.length ? heads[i + 1].index : html.length;
        const body = html.slice(bodyStart, bodyEnd);
        draws.push(buildDraw({ html: body, dateStr: heads[i][1], drawNo: Number(heads[i][2]) }));
    }
    return draws;
}

const SR_BASE = "https://www.singaporepools.com.sg/en/product/sr/Pages/toto_results.aspx?sppl=";

export function srUrl(drawNo) {
    return SR_BASE + Buffer.from(`DrawNumber=${drawNo}`).toString("base64");
}

/**
 * Score a 6-number pick against a draw under Toto 6/49 rules.
 * Returns prize group 1–7, or 0 for no prize.
 */
export function scoreLine(pick, draw) {
    const winning = new Set(draw.numbers);
    const hits = pick.reduce((acc, n) => acc + (winning.has(n) ? 1 : 0), 0);
    const addHit = draw.additional != null && pick.includes(draw.additional);
    if (hits === 6) return 1;
    if (hits === 5) return addHit ? 2 : 3;
    if (hits === 4) return addHit ? 4 : 5;
    if (hits === 3) return addHit ? 6 : 7;
    return 0;
}

/**
 * Parse the historical seed CSV (RFC-4180, quoted commas tolerated).
 * Verified column map: 0=draw, 1=date d/m/yyyy, 2–7 winning numbers, 8 additional,
 * 17–30 = Division 1–7 winners/prize pairs (blank on pre-2022 rows).
 */
export function parseCsvDraws(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const endRow = () => {
        row.push(field);
        field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
    };
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else inQuotes = false;
            } else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ",") {
            row.push(field);
            field = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            endRow();
        } else field += c;
    }
    if (field !== "" || row.length) endRow();

    const draws = [];
    for (const r of rows) {
        const drawNo = (r[0] ?? "").trim();
        if (!/^\d+$/.test(drawNo)) continue; // header or junk line
        const numbers = r.slice(2, 8).map((v) => Number(String(v).trim()));
        if (numbers.length !== 6 || numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 49)) continue;
        const date = parseDateIso(String(r[1]).trim().replace(/(\d+)\/(\d+)\/(\d+)/, (_, d, mo, y) => `${d} ${monthAbbr(mo)} ${y}`));
        const additionalRaw = String(r[8] ?? "").trim();
        const additional = additionalRaw === "" ? null : Number(additionalRaw);

        let prizes;
        for (let g = 1; g <= 7; g++) {
            const winners = toAmount(r[15 + 2 * g]);
            const share = toAmount(r[16 + 2 * g]);
            if (winners == null && share == null) continue;
            prizes ??= {};
            prizes[`g${g}`] = { share, winners };
        }
        if (prizes) for (let g = 1; g <= 7; g++) prizes[`g${g}`] ??= { share: null, winners: null };

        draws.push({ draw: Number(drawNo), date, numbers, additional, ...(prizes ? { prizes } : {}) });
    }
    return draws;
}

function monthAbbr(m) {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return names[Number(m) - 1] ?? "";
}
