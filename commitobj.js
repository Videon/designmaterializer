// commitobj.js — data-only

class commitobj {
    constructor(src, index) {
        // src can be a plain object with {t} or {timestamp}, or another commitobj
        this.title        = src?.title ?? "";
        this.message      = src?.message ?? "";
        this.timestampISO = src?.timestamp ?? src?.timestampISO ?? null;

        // Prefer an existing numeric seconds value; otherwise parse ISO/number
        const rawTime = (src && Number.isFinite(src.t)) ? src.t
            : (src?.timestamp ?? src?.timestampISO ?? null);
        this.t = toFloatTimestamp(rawTime);

        this.index = (typeof src?.index === "number") ? src.index : index;

        // Codes attached to this commit (strings)
        this.codes = Array.isArray(src?.codes) ? src.codes.slice() : [];
    }
}

function toFloatTimestamp(ts) {
    // Accept seconds (number), milliseconds (big number), ISO string, Date, numeric string
    if (ts instanceof Date) {
        const ms = ts.getTime();
        return Number.isFinite(ms) ? ms / 1000 : 0;
    }
    if (typeof ts === "number") {
        if (!Number.isFinite(ts)) return 0;
        // Heuristic: if it's too big, assume ms and convert to seconds
        return ts > 1e12 ? ts / 1000 : ts;
    }
    if (typeof ts === "string") {
        const asNum = Number(ts);
        if (Number.isFinite(asNum)) return asNum > 1e12 ? asNum / 1000 : asNum;
        const ms = Date.parse(ts); // ISO 8601
        if (Number.isFinite(ms)) return ms / 1000;
    }
    return 0;
}

// IMPORTANT: do not re-wrap existing instances
function toCommitObjs(rawArray) {
    return rawArray.map((src, i) => (src instanceof commitobj) ? src : new commitobj(src, i));
}

window.commitobj = commitobj;
window.CommitFactory = { toCommitObjs };