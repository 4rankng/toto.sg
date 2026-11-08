// toto.sg — self-host runtime: static SPA from ./dist plus GET /api/latest
// (the live-draw fetch, self-contained). Zero deps, Node ≥ 18. Container entrypoint.
//
// Routes:
//   /api/latest            live newest draw, parsed from the Singapore Pools
//                          6-latest-draws fragment
//   /assets/*              vite hashed bundles, immutable
//   everything else        static file from dist/, SPA fallback to index.html
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";

import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST = process.env.DIST ?? fileURLToPath(new URL("./dist", import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";

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
            date: `${dateM[3]}-${String(month).padStart(2, "0")}-${String(dateM[1]).padStart(2, "0")}`,
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

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json",
};

const send = (res, status, body, headers = {}) => {
    res.writeHead(status, headers);
    res.end(body);
};
const sendJson = (res, status, body, headers = {}) =>
    send(res, status, JSON.stringify(body), { "Content-Type": "application/json; charset=utf-8", ...headers });

async function serveLatest(res) {
    try {
        const upstream = await fetch(FRAGMENT_URL, { headers: { "User-Agent": BROWSER_UA } });
        if (!upstream.ok) throw new Error(`fragment HTTP ${upstream.status}`);
        sendJson(res, 200, parseNewest(await upstream.text()), {
            "Cache-Control": "public, max-age=300",
        });
    } catch (err) {
        sendJson(res, 502, { error: `upstream fetch/parse failed: ${String(err && err.message ? err.message : err)}` });
    }
}

async function serveStatic(req, res, pathname) {
    let filePath = path.join(DIST, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ""));
    if (!filePath.startsWith(DIST)) filePath = path.join(DIST, "index.html");

    let body;
    try {
        const st = await stat(filePath);
        const target = st.isDirectory() ? path.join(filePath, "index.html") : filePath;
        body = await readFile(target);
        filePath = target;
    } catch {
        // Missing file or SPA route (/strategies, /history, /insights): the
        // client router owns every path that is not a real asset.
        return send(res, 200, await readFile(path.join(DIST, "index.html")), {
            "Content-Type": MIME[".html"],
            "Cache-Control": "no-cache",
        });
    }

    const ext = path.extname(filePath).toLowerCase();
    const headers = { "Content-Type": MIME[ext] ?? "application/octet-stream" };
    if (pathname.startsWith("/assets/")) headers["Cache-Control"] = "public, max-age=31536000, immutable";
    else if (ext === ".html") headers["Cache-Control"] = "no-cache";
    else if (pathname.startsWith("/data/")) headers["Cache-Control"] = "public, max-age=300";
    send(res, 200, body, headers);
}

const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`).pathname);
    if (pathname === "/api/latest") {
        if (req.method !== "GET") return sendJson(res, 405, { error: "GET only" }, { Allow: "GET" });
        return serveLatest(res);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "GET only" }, { Allow: "GET" });
    try {
        await serveStatic(req, res, pathname === "/" ? "/index.html" : pathname);
    } catch {
        sendJson(res, 500, { error: "internal error" });
    }
});

server.listen(PORT, HOST, () => {
    console.log(`toto.sg self-host listening on http://${HOST}:${PORT}, serving ${DIST}`);
});
