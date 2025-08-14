// timeline_view.js
(function () {
    const MAX_VISIBLE_CARDS = 60;
    const CARD_MAX_W_ABS = 420;
    const CARD_MAX_W_RATIO = 0.45;

    const TS_LEADER_LEN = 26;
    const TS_TEXT_GAP = 4;
    const TS_TEXT_LEFT_GAP = 0;
    const TS_LINE_GAP = 14;
    const CARD_TOP_GAP = 1;

    // Left edge anchor offsets
    const CARD_LEFT_GAP = 0;

    // How far beyond the viewport we consider items (px) — both left and right
    const OVERSCAN_PX = 480;


    // Gap badge (sequence mode) sizing
    const GAP_BADGE_PAD_X = 8;
    const GAP_BADGE_PAD_Y = 6;
    const GAP_BADGE_NUM_SIZE = 14;  // number text size
    const GAP_BADGE_LBL_SIZE = 11;  // "days" text size
    const GAP_BADGE_MIN_W = 36;     // enforce narrow width
    const GAP_BADGE_MAX_W = 64;

    // Time-mode ribbon sizing
    const TIME_GAP_RIBBON_H = 18;   // ribbon height under the timeline
    const TIME_GAP_RIBBON_PAD = 2;  // horizontal padding inside ribbon


    class TimelineView {
        constructor(marginL = 60, marginR = 40) {
            this.marginL = marginL;
            this.marginR = marginR;

            this.commits = [];
            this.mode = "time";                 // "time" | "sequence"
            this.sequenceShowGaps = false;      // when true, show day-gap cards (sequence mode)

            this.tMin = 0;
            this.tMax = 1;       // time domain
            this.vMin = 0;
            this.vMax = 1;       // view window

            this.cache = new CardCache();
            this.currentCardW = 0;

            this.knotR = 8;

            // memo cache for "gap" cards keyed by integer days
            this._gapCardMemo = new Map();

            this.selected = new Set();      // holds keys like "commit:12" or "gap:7"
            this._drawRects = [];           // updated every frame: hit-testable rects we actually drew

            this.hudVisible = true;
            this._lastVisCount = 0;
            this._lastRenderCards = true;
        }

        setHUDVisible(flag) {
            this.hudVisible = !!flag;
        }

        getFrameStats() {
            return {visibleCount: this._lastVisCount, renderCards: this._lastRenderCards};
        }


        setMode(mode) {
            this.mode = mode;
        }

        getMode() {
            return this.mode;
        }

        setSequenceGapMode(flag) {
            this.sequenceShowGaps = !!flag;
        }

        getSequenceGapMode() {
            return this.sequenceShowGaps;
        }

        setData(commits) {
            this.commits = commits;
            this.tMin = commits[0].t;
            this.tMax = commits[commits.length - 1].t;
            this.vMin = this.tMin;
            this.vMax = this.tMax;
            this.rebuildCache();
            this._gapCardMemo.clear();
        }

        initSequenceViewEdgeToEdge() {
            const drawW = width - this.marginL - this.marginR;
            const cardW = this.currentCardW || Math.min(CARD_MAX_W_ABS, drawW * CARD_MAX_W_RATIO);
            const unitsVisible = Math.max(1, Math.floor(drawW / cardW));
            const halfSpan = unitsVisible / 2;
            const mid = (this.commits.length - 1) / 2;
            this.vMin = mid - halfSpan;
            this.vMax = mid + halfSpan;
        }

        setView(vMin, vMax) {
            this.vMin = vMin;
            this.vMax = vMax;
        }

        getView() {
            return [this.vMin, this.vMax];
        }

        getDomain() {
            if (this.mode === "time") return [this.tMin, this.tMax];
            return [-0.5, this.commits.length - 0.5]; // index domain
        }

        rebuildCache() {
            const drawW = width - this.marginL - this.marginR;
            const targetW = Math.min(CARD_MAX_W_ABS, drawW * CARD_MAX_W_RATIO);
            if (Math.abs(targetW - this.currentCardW) > 0.5) {
                this.currentCardW = targetW;
                this.cache.build(this.commits, targetW);
                this._gapCardMemo.clear(); // widths changed → rebuild gap cards on demand
            }
        }

        coordToX(coord, drawW) {
            return map(coord, this.vMin, this.vMax, this.marginL, this.marginL + drawW);
        }

        // Left edge always adjacent to this commit's marker (no flipping)
        anchorCommitLeft(i, xAtIndex, cardW) {
            const xCurr = xAtIndex(i);
            return xCurr + CARD_LEFT_GAP; // may extend off canvas — that's fine
        }


        // ----- Commit cards (existing) -----
        pickNonOverlappingClosestToCenter(start, end, xFunc) {
            const xAtIndex = (idx) => xFunc(this.commits[idx], idx);
            const commits = this._buildCommitCandidates(start, end, xAtIndex);
            return this._resolveNonOverlapping(commits, /*preferCommitOnTie*/ false);
        }


        // ----- Gap cards (NEW) -----
        // Build candidates for gaps i..i+1 with days > 1, placed at coord (i + 0.5)
        pickSequenceCardsAndGaps(start, end, xAtIndex) {
            const commits = this._buildCommitCandidates(start, end, xAtIndex);
            const gaps = this._buildGapCandidates(start, end, xAtIndex);
            return this._resolveNonOverlapping(commits.concat(gaps), /*preferCommitOnTie*/ true);
        }


        // Memoized small slate that reads "N days"
        getGapCardGfx(days) {
            if (!this._gapCardMemo) this._gapCardMemo = new Map();
            if (this._gapCardMemo.has(days)) return this._gapCardMemo.get(days);

            // Measure narrow width based on the larger of the number or "days"
            textAlign(LEFT, BASELINE);
            textSize(GAP_BADGE_NUM_SIZE);
            const numW = textWidth(String(days));
            textSize(GAP_BADGE_LBL_SIZE);
            const lblW = textWidth("days");

            const innerW = Math.max(numW, lblW);
            const w = Math.max(GAP_BADGE_MIN_W, Math.min(GAP_BADGE_MAX_W, Math.ceil(innerW + 2 * GAP_BADGE_PAD_X)));

            const lineHNum = (textAscent() + textDescent()) * 1.0;
            const lineHLbl = (textAscent() + textDescent()) * 0.95;
            const innerH = lineHNum + 2 + lineHLbl;
            const h = Math.ceil(innerH + 2 * GAP_BADGE_PAD_Y);

            const gfx = createGraphics(w + 4, h + 4); // +4 for shadow bleed
            gfx.textAlign(CENTER, BASELINE);

            // shadow
            gfx.noStroke();
            gfx.fill(0, 20);
            gfx.rect(2, 2, w, h, 8);

            // slate
            gfx.fill(255);
            gfx.rect(0, 0, w, h, 8);
            gfx.noFill();
            gfx.stroke(220);
            gfx.rect(0, 0, w, h, 8);

            // content (stacked: number on top, "days" below)
            const cx = w / 2;
            let cy = GAP_BADGE_PAD_Y + lineHNum;
            gfx.noStroke();
            gfx.fill(25);
            gfx.textSize(GAP_BADGE_NUM_SIZE);
            gfx.text(String(days), cx, cy);

            cy += 2 + lineHLbl;
            gfx.textSize(GAP_BADGE_LBL_SIZE);
            gfx.fill(40);
            gfx.text("days", cx, cy);

            // store logical w/h
            Object.defineProperty(gfx, "width", {value: w, enumerable: true});
            Object.defineProperty(gfx, "height", {value: h, enumerable: true});

            this._gapCardMemo.set(days, gfx);
            return gfx;
        }

        getTimelineY() {
            // falls back to 0.7 if yLineRatio isn't present
            const ratio = (typeof this.yLineRatio === "number") ? this.yLineRatio : 0.70;
            return height * ratio;
        }

        // Y below which timestamps/leader lines occupy space. Codes panel must stay ABOVE this Y.
        getTimelineSafeTopY() {
            const yLine = this.getTimelineY();
            // Reserve: leader line + gap + (date line above time line)
            // Uses the same constants you defined at module scope.
            const reserveAbove = TS_LEADER_LEN + TS_TEXT_GAP + TS_LINE_GAP + 6; // +6 padding
            return yLine - reserveAbove;
        }

        keyFor(kind, index) {
            return `${kind}:${index}`;
        }

        isSelected(kind, index) {
            return this.selected.has(this.keyFor(kind, index));
        }

        toggleSelect(kind, index, additive) {
            const k = this.keyFor(kind, index);
            if (!additive) {
                this.selected.clear();
                this.selected.add(k);
                return;
            }
            if (this.selected.has(k)) this.selected.delete(k); else this.selected.add(k);
        }

        clearSelection() {
            this.selected.clear();
        }

        // x,y are canvas coords; additive=true if Shift is held
        handleClick(x, y, additive = false) {
            // Walk last-drawn rects top→bottom (end→start) so visually topmost wins.
            for (let i = this._drawRects.length - 1; i >= 0; i--) {
                const r = this._drawRects[i];
                if (x >= r.left && x <= r.left + r.w && y >= r.top && y <= r.top + r.h) {
                    this.toggleSelect(r.kind, r.index, additive);
                    return true; // handled
                }
            }
            // Clicked empty area: clear selection unless additive
            if (!additive) this.selected.clear();
            return false;
        }

        drawSelectionOutline(x, y, w, h) {
            noFill();
            stroke(30, 140, 255);   // blue highlight
            strokeWeight(2);
            rect(x - 1, y - 1, w + 2, h + 2, 10);

            // Optional: draw a subtle glow
            stroke(30, 140, 255, 60);
            strokeWeight(6);
            rect(x - 2, y - 2, w + 4, h + 4, 12);
            strokeWeight(1);
        }

        // Add inside class:
        _computeOverscannedRange(drawW) {
            let start, end, pxPerUnit;

            if (this.mode === "time") {
                const spanSec = Math.max(1e-9, this.vMax - this.vMin);
                pxPerUnit = drawW / spanSec;
                const overSec = OVERSCAN_PX / Math.max(1e-9, pxPerUnit);
                const vMinEx = this.vMin - overSec;
                const vMaxEx = this.vMax + overSec;
                [start, end] = Utils.visibleRange(this.commits, vMinEx, vMaxEx);
            } else {
                const unitsPerPx = (this.vMax - this.vMin) / Math.max(1e-9, drawW);
                const overUnits = OVERSCAN_PX * unitsPerPx;
                const a = Math.ceil((this.vMin - overUnits) - 0.5);
                const b = Math.floor((this.vMax + overUnits) + 0.5);
                start = Math.max(0, a);
                end = Math.min(this.commits.length - 1, b);
            }
            return {start, end};
        }

        _resolveNonOverlapping(candidates, preferCommitOnTie = false) {
            // sort by priority; tie-breaker: commit before gap if requested
            candidates.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                if (!preferCommitOnTie) return 0;
                if (a.kind === b.kind) return 0;
                return (a.kind === "commit") ? -1 : 1;
            });

            const chosen = [];
            for (const cand of candidates) {
                let overlaps = false;
                for (const sel of chosen) {
                    if (cand.vLeft < sel.vRight && cand.vRight > sel.vLeft) {
                        overlaps = true;
                        break;
                    }
                }
                if (!overlaps) chosen.push(cand);
            }
            return chosen.map(c => ({
                kind: c.kind, index: c.index, days: c.days,
                left: c.left, right: c.right, priority: c.priority
            }));
        }

        _buildCommitCandidates(start, end, xAtIndex) {
            const centerX = width / 2;
            const candidates = [];
            for (let i = start; i <= end; i++) {
                const card = this.cache.get(i);
                if (!card) continue;
                const drawLeft = this.anchorCommitLeft(i, xAtIndex, card.w);
                const drawRight = drawLeft + card.w;

                const vLeft = Math.max(drawLeft, this.marginL);
                const vRight = Math.min(drawRight, width - this.marginR);
                if (vRight <= vLeft) continue;

                const markerX = xAtIndex(i);
                const dist = Math.abs(markerX - centerX);

                candidates.push({
                    kind: "commit", index: i,
                    left: drawLeft, right: drawRight,
                    vLeft, vRight,
                    priority: dist,
                });
            }
            return candidates;
        }

        _buildGapCandidates(start, end, xAtIndex) {
            const centerX = width / 2;
            const candidates = [];
            for (let i = Math.max(0, start); i < Math.min(this.commits.length - 1, end + 1); i++) {
                const a = this.commits[i], b = this.commits[i + 1];
                const days = Utils.fullDaysBetweenUTC(a.t, b.t);
                if (days <= 1) continue;

                const gfx = this.getGapCardGfx(days);
                const drawLeft = xAtIndex(i + 0.5) + CARD_LEFT_GAP;
                const drawRight = drawLeft + gfx.width;

                const vLeft = Math.max(drawLeft, this.marginL);
                const vRight = Math.min(drawRight, width - this.marginR);
                if (vRight <= vLeft) continue;

                const dist = Math.abs(xAtIndex(i + 0.5) - centerX);

                candidates.push({
                    kind: "gap", index: i, days,
                    left: drawLeft, right: drawRight,
                    vLeft, vRight,
                    priority: dist,
                });
            }
            return candidates;
        }

        draw(statusMsg) {
            background(248);

            if (!this.commits.length) return;

            // If time-mode view got invalid, snap to the data domain
            if (this.mode === "time" && (!Number.isFinite(this.vMin) || !Number.isFinite(this.vMax))) {
                this.vMin = this.tMin;
                this.vMax = this.tMax;
            }

            const yLine = height * 0.7;
            const drawW = width - this.marginL - this.marginR;
            const showTimeRibbons = (this.mode === "time" && this.sequenceShowGaps);
            const cardYOffset = showTimeRibbons ? (TIME_GAP_RIBBON_H + 2) : 0;

            this._drawRects = []; // refresh hit-test cache for this frame


            // axis
            stroke(0);
            strokeWeight(2);
            line(this.marginL, yLine, width - this.marginR, yLine);

            // ticks
            if (this.mode === "time") {
                this.drawTick(this.marginL, yLine, this.vMin, "view start");
                this.drawTick(width - this.marginR, yLine, this.vMax, "view end");
            } else {
                this.drawIndexTick(this.marginL, yLine, this.vMin, "start i");
                this.drawIndexTick(width - this.marginR, yLine, this.vMax, "end i");
            }

            // visible range WITH OVERSCAN (so we pull in neighbors just off-screen)
            const {start, end} = this._computeOverscannedRange(drawW);
            const count = Math.max(0, end - start + 1);
            const renderCards = count <= MAX_VISIBLE_CARDS;

            // coordToX calculation
            const xs = new Array(Math.max(0, end - start + 1));
            for (let k = 0; k < xs.length; k++) {
                const i = start + k;
                const coord = (this.mode === "time") ? this.commits[i].t : i;
                xs[k] = this.coordToX(coord, drawW);
            }

            // --- MARKERS + KNOTS + TIMESTAMP FLAGS (bottom edge flush with marker top) ---

            const TS_MIN_LABEL_GAP = 4;
            const LABEL_PAD_X = 4;
            const LABEL_PAD_TOP = 2;
            const LABEL_PAD_BOT = 2;

            textSize(12);
            textAlign(LEFT, BOTTOM);

            // 1) Visibility pass (hide later labels that would overlap earlier ones)
            let lastRight = -Infinity;
            const labelVisible = new Array(xs.length).fill(false);
            const labelWidth = new Array(xs.length).fill(0);
            const dateTime = new Array(xs.length);

            for (let k = 0; k < xs.length; k++) {
                const i = start + k;
                const dt = Utils.formatDateTimeFromSeconds(this.commits[i].t);
                dateTime[k] = dt;

                // width is max of both lines + horizontal padding
                const w = Math.max(textWidth(dt.time), textWidth(dt.date)) + LABEL_PAD_X * 2;
                labelWidth[k] = w;

                const leftX = xs[k]; // left of flag aligns to marker line
                if (leftX >= lastRight + TS_MIN_LABEL_GAP) {
                    labelVisible[k] = true;
                    lastRight = leftX + w;
                }
            }

            // 2) Leader (marker) lines: shorter if label hidden
            stroke(40);
            strokeWeight(2);
            for (let k = 0; k < xs.length; k++) {
                const len = labelVisible[k] ? TS_LEADER_LEN : Math.round(TS_LEADER_LEN * 0.55);
                line(xs[k], yLine, xs[k], yLine - len);
            }

            // 3) Knots
            noStroke();
            for (let k = 0; k < xs.length; k++) {
                const i = start + k;
                const sel = this.isSelected && this.isSelected("commit", i);
                fill(sel ? color(30, 140, 255) : color(30));
                circle(xs[k], yLine, sel ? this.knotR + 2 : this.knotR);
            }

            // 4) Timestamp flags as simple rectangles whose BOTTOM touches marker top
            fill(20);
            textSize(12);
            textAlign(LEFT, BOTTOM);
            const lineH = textAscent() + textDescent();

            for (let k = 0; k < xs.length; k++) {
                if (!labelVisible[k]) continue;

                const leftX = xs[k];
                const len = TS_LEADER_LEN;                 // full leader for visible labels
                const bottomY = yLine - len;                 // top of the leader line

                // Flag height: two lines + gap + padding
                const rectH = (lineH * 2) + TS_LINE_GAP + LABEL_PAD_TOP + LABEL_PAD_BOT;
                const rectY = bottomY - rectH;               // so bottom edge is flush with marker top
                const rectW = labelWidth[k];

                // Background + border
                stroke(0);
                noFill();
                rect(leftX, rectY, rectW, rectH);            // simple rectangle (no rounded corners)
                noStroke();
                fill(20);

                // Text baselines inside the flag
                const timeBaseY = bottomY - LABEL_PAD_BOT;   // time on the bottom line
                const dateBaseY = timeBaseY - TS_LINE_GAP;   // date above by the configured gap
                const textX = leftX + LABEL_PAD_X;

                text(dateTime[k].date, textX, dateBaseY);
                text(dateTime[k].time, textX, timeBaseY);
            }


            if (showTimeRibbons && count > 0) {
                // Draw a thin ribbon between each consecutive pair (i, i+1) with >1 full day gap
                noStroke();
                for (let i = Math.max(0, start); i < Math.min(this.commits.length - 1, end); i++) {
                    const a = this.commits[i], b = this.commits[i + 1];
                    const days = Utils.fullDaysBetweenUTC(a.t, b.t);
                    if (days <= 1) continue;

                    const xA = this.coordToX(a.t, drawW);      // left edge at previous commit line
                    const xB = this.coordToX(b.t, drawW);      // right edge at next commit line
                    let left = Math.min(xA, xB) + TIME_GAP_RIBBON_PAD;
                    let right = Math.max(xA, xB) - TIME_GAP_RIBBON_PAD;
                    if (right - left < 12) continue;           // too tight to show

                    // ribbon background
                    fill(255);
                    rect(left, yLine + 2, right - left, TIME_GAP_RIBBON_H, 6);

                    // subtle border / shadow
                    stroke(220);
                    noFill();
                    rect(left, yLine + 2, right - left, TIME_GAP_RIBBON_H, 6);
                    noStroke();

                    // label "N" on top, "days" below (centered)
                    const cx = (left + right) / 2;
                    fill(25);
                    textAlign(CENTER, CENTER);
                    textSize(GAP_BADGE_NUM_SIZE);
                    text(String(days), cx, yLine + 2 + TIME_GAP_RIBBON_H * 0.40);
                    textSize(GAP_BADGE_LBL_SIZE);
                    text("days", cx, yLine + 2 + TIME_GAP_RIBBON_H * 0.78);
                }
            }


            // cards below timeline
            if (!renderCards) {
                this.drawZoomHint();
            } else if (this.mode === "sequence" && this.sequenceShowGaps) {
                // --- SEQUENCE + GAPS: show BOTH commit cards and gap cards, no overlaps,
                //     prioritizing items near the window center (commit cards win ties).
                const chosen = this.pickSequenceCardsAndGaps(start, end, (coord) => this.coordToX(coord, drawW));
                for (const seg of chosen) {
                    if (seg.kind === "commit") {
                        const card = this.cache.get(seg.index);
                        if (!card) continue;
                        const top = yLine + CARD_TOP_GAP + cardYOffset;
                        image(card.gfx, seg.left, top);
                        // record for hit-test
                        this._drawRects.push({
                            kind: "commit",
                            index: seg.index,
                            left: seg.left,
                            top,
                            w: card.w,
                            h: card.h
                        });
                        // highlight if selected
                        if (this.isSelected("commit", seg.index)) this.drawSelectionOutline(seg.left, top, card.w, card.h);
                    } else {
                        const gfx = this.getGapCardGfx(seg.days);
                        const top = yLine + CARD_TOP_GAP + cardYOffset;
                        image(gfx, seg.left, top);
                        this._drawRects.push({
                            kind: "gap",
                            index: seg.index,
                            left: seg.left,
                            top,
                            w: gfx.width,
                            h: gfx.height
                        });
                        if (this.isSelected("gap", seg.index)) this.drawSelectionOutline(seg.left, top, gfx.width, gfx.height);
                    }
                }
            } else {
                // normal cards (time OR sequence without gaps) with overlap filtering
                const chosen = (this.mode === "time")
                    ? this.pickNonOverlappingClosestToCenter(start, end, (c) => this.coordToX(c.t, drawW))
                    : this.pickNonOverlappingClosestToCenter(start, end, (_, i) => this.coordToX(i, drawW));
                for (const seg of chosen) {
                    const card = this.cache.get(seg.index);
                    if (!card) continue;
                    const top = yLine + CARD_TOP_GAP + cardYOffset;
                    image(card.gfx, seg.left, top);
                    this._drawRects.push({kind: "commit", index: seg.index, left: seg.left, top, w: card.w, h: card.h});
                    if (this.isSelected("commit", seg.index)) this.drawSelectionOutline(seg.left, top, card.w, card.h);

                }
            }

            this._lastVisCount = count;          // NEW
            this._lastRenderCards = renderCards; // NEW


            // HUD
            // HUD
            if (this.hudVisible) this.drawHUD(yLine, renderCards, count, statusMsg);
        }

        drawTick(x, y, t, label) {
            if (!Number.isFinite(t)) return;             // guard
            const ms = t * 1000;
            if (!Number.isFinite(ms)) return;            // guard

            const d = new Date(ms);
            if (Number.isNaN(d.getTime())) return;       // guard

            stroke(0);
            line(x, y - 6, x, y + 6);
            noStroke();
            fill(60);
            textSize(12);
            const iso = d.toISOString().slice(0, 10);
            text(`${label}: ${iso}`, x - 40, y + 24);
        }


        drawIndexTick(x, y, v, label) {
            stroke(0);
            line(x, y - 6, x, y + 6);
            noStroke();
            fill(60);
            textSize(12);
            text(`${label}: i=${nf(v, 1, 2)}`, x - 40, y + 24);
        }

        drawZoomHint() {
            const txt = "Too many items in view — zoom in to see cards";
            const w = textWidth(txt) + 24;
            noStroke();
            fill(0, 120);
            rect(16, height - 56, w, 36, 8);
            fill(255);
            textSize(12);
            text(txt, 28, height - 34);
        }

        drawHUD(yLine, renderCards, visCount) {
            const [dMin, dMax] = this.getDomain();
            const spanUnits = this.vMax - this.vMin;
            const label = (this.mode === "time")
                ? `span: ${(spanUnits / 86400).toFixed(2)} days`
                : `span: ${(spanUnits).toFixed(2)} commits`;
            const seqGap = (this.mode === "sequence" && this.sequenceShowGaps) ? " | gaps: on" : "";
            noStroke();
            fill(0, 100);
            rect(width - 290, 12, 274, 70, 8);
            fill(255);
            textSize(12);
            text(
                `Mode: ${this.mode}${seqGap} | ${label}
Visible items: ${visCount}  |  Cards: ${renderCards ? "on" : "off"}`,
                width - 280, 18
            );
            noStroke();
            fill(30);
            circle(width - 220, yLine + 6, 8);
            fill(60);
            text("knot", width - 210, yLine + 1);
        }
    }

    window.TimelineView = TimelineView;
})();
