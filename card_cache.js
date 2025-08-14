// card_cache.js
(function () {
    class CardCache {
        constructor() {
            this.items = [];     // [{gfx, w, h}]
            this.width = 0;
            // style
            this.titleSize = 15;
            this.msgSize = 12;
            this.codeSize = 11;     // NEW: code chip font size
            this.padX = 12;
            this.padY = 10;
            this.sepH = 1;

            // NEW: code chip layout
            this.codeChipH = 20;
            this.codeChipPadX = 8;
            this.codeChipGap = 6;
            this.codeRowGap = 6;
            this.codeTopGap = 10;   // gap between message and first chip row
        }

        build(commits, cardW) {
            this.width = Math.ceil(cardW);
            this.items = new Array(commits.length);

            // pre-measure using the main canvas context
            textWrap(WORD);

            for (let i = 0; i < commits.length; i++) {
                const c = commits[i];
                const title = c.title || "(no title)";
                const msg = c.message || "";
                const codes = Array.isArray(c.codes) ? c.codes : [];

                // --- measure title ---
                textSize(this.titleSize); textStyle(BOLD);
                const tLines = this.wrapLines(title, this.width - 2 * this.padX);
                const leadT = textAscent() + textDescent();
                const tH = Math.max(tLines.length, 1) * leadT * 1.2;

                // --- measure message ---
                textSize(this.msgSize); textStyle(NORMAL);
                const mLines = this.wrapLines(msg, this.width - 2 * this.padX);
                const leadM = textAscent() + textDescent();
                const mH = Math.max(mLines.length, 0) * leadM * 1.3;

                // --- measure codes section ---
                const innerW = this.width - 2 * this.padX;
                const codesExtraH = this.measureCodesHeight(codes, innerW);

                const innerH = tH + 8 + this.sepH + 8 + mH + codesExtraH;
                const h = Math.ceil(innerH + 2 * this.padY);

                // --- render card gfx ---
                const gfx = createGraphics(this.width + 4, h + 4);
                gfx.textWrap(WORD);

                // shadow
                gfx.noStroke(); gfx.fill(0, 20);
                gfx.rect(2, 2, this.width, h, 10);
                // slate
                gfx.fill(255); gfx.rect(0, 0, this.width, h, 10);
                gfx.noFill(); gfx.stroke(220); gfx.rect(0, 0, this.width, h, 10);

                let cx = this.padX, cy = this.padY;

                // title
                gfx.noStroke(); gfx.fill(20);
                gfx.textSize(this.titleSize); gfx.textStyle(BOLD);
                this.drawLines(gfx, tLines, cx, cy, innerW, leadT * 1.2);
                cy += tH + 8;

                // separator
                gfx.stroke(220); gfx.strokeWeight(this.sepH);
                gfx.line(cx, cy, this.width - this.padX, cy);
                cy += 8;

                // message
                gfx.noStroke(); gfx.fill(40);
                gfx.textSize(this.msgSize); gfx.textStyle(NORMAL);
                this.drawLines(gfx, mLines, cx, cy, innerW, leadM * 1.3);
                cy += mH;

                // NEW: codes section (chips) under message
                cy = this.drawCodesSection(gfx, codes, cx, cy, innerW);

                this.items[i] = { gfx, w: this.width, h };
            }
        }

        // --- measure how much height codes chips will need for given width ---
        measureCodesHeight(codes, maxW) {
            if (!codes || !codes.length) return 0;

            // use main canvas context for measuring
            textSize(this.codeSize);
            let rows = 1;
            let runW = 0;

            for (const label of codes) {
                const tw = textWidth(label);
                const chipW = Math.max(40, tw + this.codeChipPadX * 2);
                if (runW > 0 && runW + chipW > maxW) {
                    rows++;
                    runW = 0;
                }
                runW += chipW + this.codeChipGap;
            }

            const chipsH = rows * this.codeChipH + (rows - 1) * this.codeRowGap;
            return this.codeTopGap + chipsH;
        }

        // --- draw codes chips and return new baseline y ---
        drawCodesSection(gfx, codes, x, y, maxW) {
            if (!codes || !codes.length) return y;

            let cx = x;
            let cy = y + this.codeTopGap;

            gfx.push();
            gfx.textSize(this.codeSize);
            gfx.textAlign(LEFT, CENTER);

            for (const label of codes) {
                const tw = gfx.textWidth(label);
                const chipW = Math.max(40, tw + this.codeChipPadX * 2);

                // wrap to next row if needed
                if (cx > x && cx + chipW > x + maxW) {
                    cx = x;
                    cy += this.codeChipH + this.codeRowGap;
                }

                // chip bg
                gfx.noStroke();
                gfx.fill(230);
                gfx.rect(cx, cy, chipW, this.codeChipH, 10);

                // chip border
                gfx.noFill();
                gfx.stroke(200);
                gfx.rect(cx, cy, chipW, this.codeChipH, 10);

                // label
                gfx.noStroke();
                gfx.fill(40);
                gfx.text(label, cx + this.codeChipPadX, cy + this.codeChipH / 2);

                cx += chipW + this.codeChipGap;
            }

            gfx.pop();
            return cy + this.codeChipH;
        }

        wrapLines(textStr, maxW) {
            if (!textStr) return [];
            const words = textStr.split(/\s+/);
            const lines = []; let line = "";
            for (const w of words) {
                const test = line ? line + " " + w : w;
                if (textWidth(test) <= maxW) line = test;
                else {
                    if (line) lines.push(line);
                    if (textWidth(w) > maxW) {
                        // hard-wrap long word
                        let chunk = "";
                        for (const ch of w) {
                            const t2 = chunk + ch;
                            if (textWidth(t2) <= maxW) chunk = t2; else { lines.push(chunk); chunk = ch; }
                        }
                        line = chunk;
                    } else line = w;
                }
            }
            if (line) lines.push(line);
            return lines;
        }

        drawLines(gfx, lines, x, y, maxW, leading) {
            for (const ln of lines) { gfx.text(ln, x, y, maxW, leading * 1.05); y += leading; }
        }

        get(i) { return this.items[i]; }
    }

    window.CardCache = CardCache;
})();
