// card_cache.js
(function () {
    class CardCache {
        constructor() {
            this.items = [];     // [{gfx, w, h}]
            this.width = 0;
            // style
            this.titleSize = 15;
            this.msgSize = 12;
            this.padX = 12;
            this.padY = 10;
            this.sepH = 1;
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

                textSize(this.titleSize); textStyle(BOLD);
                const tLines = this.wrapLines(title, this.width - 2 * this.padX);
                const leadT = textAscent() + textDescent();
                const tH = Math.max(tLines.length, 1) * leadT * 1.2;

                textSize(this.msgSize); textStyle(NORMAL);
                const mLines = this.wrapLines(msg, this.width - 2 * this.padX);
                const leadM = textAscent() + textDescent();
                const mH = Math.max(mLines.length, 0) * leadM * 1.3;

                const innerH = tH + 8 + this.sepH + 8 + mH;
                const h = Math.ceil(innerH + 2 * this.padY);

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
                this.drawLines(gfx, tLines, cx, cy, this.width - 2 * this.padX, leadT * 1.2);
                cy += tH + 8;

                // separator
                gfx.stroke(220); gfx.strokeWeight(this.sepH);
                gfx.line(cx, cy, this.width - this.padX, cy);
                cy += 8;

                // message
                gfx.noStroke(); gfx.fill(40);
                gfx.textSize(this.msgSize); gfx.textStyle(NORMAL);
                this.drawLines(gfx, mLines, cx, cy, this.width - 2 * this.padX, leadM * 1.3);

                this.items[i] = { gfx, w: this.width, h };
            }
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
