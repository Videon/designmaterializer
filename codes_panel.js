// codes_panel.js
(function () {
    const PANEL_PAD = 12, CHIP_H = 28, CHIP_PAD_X = 10, CHIP_GAP = 8, ROW_GAP = 8, TITLE_H = 20;

    class CodesPanel {
        constructor(codeManager, onSelectCommits) {
            this.model = codeManager;
            this.onSelectCommits = typeof onSelectCommits === 'function' ? onSelectCommits : null;
            this.bounds = { x: 0, y: 0, w: 100, h: 100 };
            this._chipRects = [];
        }

        setBounds(x, y, w, h) { this.bounds = { x, y, w, h }; }
        hide() {} show() {}

        draw(selectedCommitIndices) {
            const { x, y, w, h } = this.bounds;

            noStroke(); fill(245); rect(x, y, w, h, 10);
            fill(30); textSize(14); textAlign(LEFT, TOP);
            text('Codes', x + PANEL_PAD, y + PANEL_PAD);

            // Updated hint: clicking selects commits
            fill(80); textSize(12);
            text('Tip: Click a code to select all commits with that code. Type to add; Enter to assign to selection.',
                x + PANEL_PAD, y + PANEL_PAD + TITLE_H + 6);

            const chipsTop = y + PANEL_PAD + TITLE_H + 28;
            const chipsLeft = x + PANEL_PAD;
            const chipsRight = x + w - PANEL_PAD;

            this._chipRects = [];
            let cx = chipsLeft, cy = chipsTop;

            textSize(12); textAlign(LEFT, CENTER);
            const codes = this.model.listCodes();

            for (const code of codes) {
                const label = code.label;
                const tw = textWidth(label);
                const chipW = Math.max(50, tw + CHIP_PAD_X * 2);
                if (cx + chipW > chipsRight) { cx = chipsLeft; cy += CHIP_H + ROW_GAP; }

                // Visual state: highlight if all currently selected commits share this code
                let allHave = false;
                if (selectedCommitIndices?.length) {
                    allHave = true;
                    for (const idx of selectedCommitIndices) {
                        const objs = this.model.getCodesForCommit(idx);
                        if (!objs.some(c => c.id === code.id)) { allHave = false; break; }
                    }
                }

                noStroke();
                fill(allHave ? color(30,140,255) : color(255));
                rect(cx, cy, chipW, CHIP_H, 14);
                stroke(allHave ? color(30,140,255) : color(220)); noFill();
                rect(cx, cy, chipW, CHIP_H, 14);
                noStroke(); fill(allHave ? 255 : 30);
                text(label, cx + CHIP_PAD_X, cy + CHIP_H/2);

                this._chipRects.push({ id: code.id, x: cx, y: cy, w: chipW, h: CHIP_H });
                cx += chipW + CHIP_GAP;
            }
        }

        handleClick(mx, my /*, selectedCommitIndices */) {
            // On chip click: compute matching commits and notify
            for (let i = this._chipRects.length - 1; i >= 0; i--) {
                const r = this._chipRects[i];
                if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                    if (this.onSelectCommits) {
                        const indices = this.model.getCommitIndicesForCode(r.id);
                        this.onSelectCommits(indices);
                    }
                    return true;
                }
            }
            return false;
        }
    }

    window.CodesPanel = CodesPanel;
})();
