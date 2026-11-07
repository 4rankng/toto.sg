// Netlify function: GET /api/latest — live newest Toto draw, parsed from the
// Singapore Pools 6-latest-draws fragment. Self-contained (no imports from
// scripts/) so the function bundle stands alone. No backend elsewhere: the site
// itself is a static SPA over precomputed JSON in public/data/.

const BROWSER_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const FRAGMENT_URL =
    "https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_result_top_draws_en.html";

const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const stripTags = (html) =>
    html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();

const toAmount = (text) => {
    const digits = String(text).replace(/[^\d]/g, "");
    return digits ? Number(digits) : null;
};

function parseNewest(html) {
    const headRe = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})(?:[\s\S]{0,150}?)Draw No\.\s*(\d+)/gi;
    const heads = [...html.matchAll(headRe)];
    if (!heads.length) throw new Error("no draw blocks found");

    let newest = null;
    for (let i = 0; i < heads.length; i++) {
        const bodyStart = heads[i].index;
        const bodyEnd = i + 1 < heads.length ? heads[i + 1].index : html.length;
        const body = html.slice(bodyStart, bodyEnd);

        const wins = new Map();
        const winRe = /class=["']win([1-6])["'][^>]*>(\d{1,2})</gi;
        let m;
        while ((m = winRe.exec(body))) wins.set(Number(m[1]), Number(m[2]));
        const numbers = [1, 2, 3, 4, 5, 6].map((k) => wins.get(k));
        if (numbers.some((n) => n === undefined)) continue;

        const addMatch = /class=["']additional["'][^>]*>(\d{1,2})</i.exec(body);
        const dateM = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(heads[i][1].trim());
        const month = dateM ? MONTHS[dateM[2].toLowerCase()] : null;
        if (!month) continue;

        const prizes = {};
        const jackpotMatch = /class=["']jackpotPrize["'][^>]*>\$([\d,]+)</i.exec(body);
        const jackpot = jackpotMatch ? Number(jackpotMatch[1].replace(/,/g, "")) : null;
        const table = /tableWinningShares[\s\S]*?<\/table>/i.exec(body);
        if (table) {
            const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            let row;
            while ((row = rowRe.exec(table[0]))) {
                const cells = [];
                const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
                let cell;
                while ((cell = cellRe.exec(row[1]))) cells.push(stripTags(cell[1]));
                const g = /Group\s+([1-7])/i.exec(cells[0] ?? "");
                if (g) prizes[`g${g[1]}`] = { share: toAmount(cells[1]), winners: toAmount(cells[2]) };
            }
        }
        // The fragment leaves a fresh draw's Group 1 row as "-", with the amount only in the jackpotPrize cell.
        if (jackpot != null) {
            prizes.g1 ??= { share: null, winners: null };
            if (prizes.g1.share == null) prizes.g1.share = jackpot;
        }

        const draw = {
            drawNo: Number(heads[i][2]),
            date: `${dateM[3]}-${String(month).padStart(2, "0")}-${dateM[1].padStart(2, "0")}`,
            numbers,
            additional: addMatch ? Number(addMatch[1]) : null,
            prizes: Object.keys(prizes).length ? prizes : null,
            fetchedAt: new Date().toISOString(),
        };
        if (!newest || draw.drawNo > newest.drawNo) newest = draw;
    }
    if (!newest) throw new Error("newest block unparseable");
    return newest;
}

const json = (status, body, headers = {}) => ({
    statusCode: status,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
});

export const handler = async (req) => {
    if (req.httpMethod !== "GET") return json(405, { error: "GET only" });
    try {
        const res = await fetch(FRAGMENT_URL, { headers: { "User-Agent": BROWSER_UA } });
        if (!res.ok) throw new Error(`fragment HTTP ${res.status}`);
        return json(200, parseNewest(await res.text()), { "Cache-Control": "public, s-maxage=300" });
    } catch (err) {
        return json(502, { error: `upstream fetch/parse failed: ${String(err && err.message ? err.message : err)}` });
    }
};
