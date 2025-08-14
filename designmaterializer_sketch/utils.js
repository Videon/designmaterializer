// utils.js
(function () {
    const WHEEL_PIXELS_PER_NOTCH = 100;
    const MAX_NOTCHES_PER_EVENT = 4;

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    // Normalize any WheelEvent to "mouse wheel notches"
    function normalizeWheelNotches(event, stepPerNotch = 1.10) {
        let notches;
        if (event.deltaMode === 1) notches = event.delta;          // lines
        else if (event.deltaMode === 2) notches = event.delta * 3; // pages
        else notches = event.delta / WHEEL_PIXELS_PER_NOTCH;       // pixels
        return clamp(notches, -MAX_NOTCHES_PER_EVENT, MAX_NOTCHES_PER_EVENT);
    }

    // Inclusive range binary search to get visible [start..end] indices in sorted arr by arr[i].t
    function visibleRange(arr, a, b) {
        if (!arr.length) return [1, 0];
        // first idx with t >= a
        let lo = 0, hi = arr.length - 1, start = arr.length;
        while (lo <= hi) {
            const m = (lo + hi) >> 1;
            (arr[m].t >= a ? (start = m, hi = m - 1) : (lo = m + 1));
        }
        // last idx with t <= b
        lo = 0;
        hi = arr.length - 1;
        let end = -1;
        while (lo <= hi) {
            const m = (lo + hi) >> 1;
            (arr[m].t <= b ? (end = m, lo = m + 1) : (hi = m - 1));
        }
        return [start, end];
    }

    function formatDateTimeFromSeconds(sec) {
        const d = new Date(sec * 1000);
        const pad = (n) => String(n).padStart(2, "0");
        const yyyy = d.getUTCFullYear();
        const mm = pad(d.getUTCMonth() + 1);
        const dd = pad(d.getUTCDate());
        const HH = pad(d.getUTCHours());
        const MM = pad(d.getUTCMinutes());
        const SS = pad(d.getUTCSeconds());
        return {date: `${yyyy}-${mm}-${dd}`, time: `${HH}:${MM}:${SS}`};
    }

    function fullDaysBetweenUTC(aSec, bSec) {
        const a = new Date(aSec * 1000);
        const b = new Date(bSec * 1000);
        const aMid = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
        const bMid = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
        const msPerDay = 86400000;
        return Math.max(0, Math.floor((bMid - aMid) / msPerDay));
    }

    window.Utils = {
        clamp,
        normalizeWheelNotches,
        visibleRange,
        formatDateTimeFromSeconds,
        fullDaysBetweenUTC
    };
})();
