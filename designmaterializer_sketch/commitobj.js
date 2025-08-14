class commitobj {
    constructor(src, index) {
        // Core commit data
        this.title = src?.title ?? "";
        this.message = src?.message ?? "";
        this.timestampISO = src?.timestamp ?? null; // Original ISO timestamp
        this.t = toFloatTimestamp(src?.timestamp);  // Floating-point seconds
        this.index = index;                         // Original order

        // Codes attached to this commit (strings)
        this.codes = Array.isArray(src?.codes) ? src.codes.slice() : [];
    }
}

function toFloatTimestamp(ts) {
    if (typeof ts === "number") return ts;
    if (typeof ts === "string") {
        const ms = Date.parse(ts);
        if (!Number.isNaN(ms)) return ms / 1000;
        const asNum = Number(ts);
        if (!Number.isNaN(asNum)) return asNum;
    }
    return 0;
}

// Utility to normalize a raw array into commitobj instances
function toCommitObjs(rawArray) {
    return rawArray.map((src, i) => new commitobj(src, i));
}

window.commitobj = commitobj;
window.CommitFactory = { toCommitObjs };
