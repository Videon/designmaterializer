// codes_panel.js
(function () {
    const PANEL_PAD = 12;
    const CHIP_H = 28;
    const CHIP_PAD_X = 10;
    const CHIP_GAP = 8;
    const ROW_GAP = 8;
    const TITLE_H = 20;
    const UI_GAP_Y = 10;

    class CodesPanel {
        constructor(codeManager) {
            this.model = codeManager;
            this.bounds = {x: 0, y: 0, w: 100, h: 100};

            // p5 DOM elements for adding a code
            this.input = createInput('');
            this.addBtn = createButton('Add code');
            this.input.attribute('placeholder', 'New code…');
            this.addBtn.mousePressed(() => {
                const v = this.input.value();
                const c = this.model.addCode(v);
                if (c) this.input.value('');
            });

            // chip layout cache for hit-testing per frame
            this._chipRects = [];  // [{id, x,y,w,h}]
        }

        setBounds(x, y, w, h) {
            this.bounds = {x, y, w, h};
            // position DOM elements inside the panel (top-left)
            const domY = y + PANEL_PAD + TITLE_H + UI_GAP_Y;
            this.input.position(x + PANEL_PAD, domY);
            this.input.size(Math.max(120, Math.min(260, w - PANEL_PAD * 3 - 90)));
            this.addBtn.position(this.input.x + this.input.width + 8, domY);
        }

        hide() {
            this.input.hide();
            this.addBtn.hide();
        }

        show() {
            this.input.show();
            this.addBtn.show();
        }

        draw(selectedCommitIndices) {
            const {x, y, w, h} = this.bounds;

            // panel background
            noStroke();
            fill(245);
            rect(x, y, w, h, 10);

            // title
            fill(30);
            textSize(14);
            textAlign(LEFT, TOP);
            text('Codes', x + PANEL_PAD, y + PANEL_PAD);

            // chips area starts below input row
            const chipsTop = y + PANEL_PAD + TITLE_H + UI_GAP_Y + Math.max(this.input.height, this.addBtn.height) + 10;
            const chipsLeft = x + PANEL_PAD;
            const chipsRight = x + w - PANEL_PAD;

            // build chips, wrap rows
            this._chipRects = [];
            let cx = chipsLeft;
            let cy = chipsTop;

            textSize(12);
            textAlign(LEFT, CENTER);

            const codes = this.model.listCodes();
            for (const code of codes) {
                const label = code.label;
                const tw = textWidth(label);
                const chipW = Math.max(50, tw + CHIP_PAD_X * 2);
                if (cx + chipW > chipsRight) {
                    // wrap
                    cx = chipsLeft;
                    cy += CHIP_H + ROW_GAP;
                }

                // Determine selection state: if ALL selected commits have this code, show “active”
                let allHave = false;
                if (selectedCommitIndices?.length) {
                    allHave = true;
                    for (const idx of selectedCommitIndices) {
                        const assigned = this.model.getCodesForCommit(idx).some(c => c.id === code.id);
                        if (!assigned) {
                            allHave = false;
                            break;
                        }
                    }
                }

                // chip bg
                noStroke();
                fill(allHave ? color(30, 140, 255) : color(255));
                rect(cx, cy, chipW, CHIP_H, 14);

                // chip border
                stroke(allHave ? color(30, 140, 255) : color(220));
                noFill();
                rect(cx, cy, chipW, CHIP_H, 14);

                // chip text
                noStroke();
                fill(allHave ? 255 : 30);
                text(label, cx + CHIP_PAD_X, cy + CHIP_H / 2);

                // store rect for hit-testing
                this._chipRects.push({id: code.id, x: cx, y: cy, w: chipW, h: CHIP_H});

                cx += chipW + CHIP_GAP;
            }
        }

        handleClick(mx, my, selectedCommitIndices) {
            // If clicked inside a chip, toggle assignment for selected commits
            for (let i = this._chipRects.length - 1; i >= 0; i--) {
                const r = this._chipRects[i];
                if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                    if (selectedCommitIndices?.length) {
                        this.model.toggleForCommits(selectedCommitIndices, r.id);
                    }
                    return true;
                }
            }
            return false;
        }
    }

    window.CodesPanel = CodesPanel;
})();
