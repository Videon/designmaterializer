// nav_controller.js
(function () {
    class NavController {
        constructor(view, onChange) {
            this.view = view;
            this.onChange = onChange;
            this.dragging = false;
            this.lastMouseX = 0;

            this.ZOOM_STEP_PER_NOTCH = 1.10;
        }

        clampView() {
            const [dMin, dMax] = this.view.getDomain();
            let [vMin, vMax] = this.view.getView();
            const fullSpan = Math.max(1e-6, dMax - dMin);
            let span = Math.max(1e-6, vMax - vMin);
            const MIN_SPAN = fullSpan / 1e6;

            if (span < MIN_SPAN) {
                const mid = (vMin + vMax) / 2;
                span = MIN_SPAN; vMin = mid - span / 2; vMax = mid + span / 2;
            }
            if (vMin < dMin) { const s = dMin - vMin; vMin += s; vMax += s; }
            if (vMax > dMax) { const s = vMax - dMax; vMin -= s; vMax -= s; }

            this.view.setView(vMin, vMax);
        }

        mouseWheel(event) {
            const marginL = this.view.marginL, marginR = this.view.marginR;
            if (mouseX < marginL || mouseX > width - marginR) return;
            const [vMin, vMax] = this.view.getView();
            const drawW = width - marginL - marginR;
            const notches = Utils.normalizeWheelNotches(event);
            if (notches === 0) return false;

            const factor = Math.pow(this.ZOOM_STEP_PER_NOTCH, notches);
            const focusCoord = map(mouseX, marginL, marginL + drawW, vMin, vMax);
            const oldSpan = vMax - vMin;

            const [dMin, dMax] = this.view.getDomain();
            const fullSpan = Math.max(1e-6, dMax - dMin);
            let newSpan = constrain(oldSpan * factor, fullSpan / 1e6, fullSpan);

            let newMin = focusCoord - (focusCoord - vMin) * (newSpan / oldSpan);
            let newMax = newMin + newSpan;
            this.view.setView(newMin, newMax);
            this.clampView();
            this.onChange();
            return false;
        }

        mousePressed() {
            const marginL = this.view.marginL, marginR = this.view.marginR;
            if (mouseX >= marginL && mouseX <= width - marginR) {
                this.dragging = true; this.lastMouseX = mouseX;
            }
        }
        mouseDragged() {
            if (!this.dragging) return;
            const marginL = this.view.marginL, marginR = this.view.marginR;
            const drawW = width - marginL - marginR;
            const [vMin, vMax] = this.view.getView();
            const span = vMax - vMin;
            const dx = mouseX - this.lastMouseX; this.lastMouseX = mouseX;
            const dCoord = -dx * (span / drawW);
            this.view.setView(vMin + dCoord, vMax + dCoord);
            this.clampView();
            this.onChange();
        }
        mouseReleased() { this.dragging = false; }

        reset() {
            // Reset to a sensible default based on mode
            if (this.view.getMode() === "time") {
                const [tMin, tMax] = this.view.getDomain();
                this.view.setView(tMin, tMax);
            } else {
                this.view.initSequenceViewEdgeToEdge();
            }
            this.onChange();
        }

        windowResized() { this.view.rebuildCache(); this.onChange(); }
    }

    window.NavController = NavController;
})();
