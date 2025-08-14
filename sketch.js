// sketch.js
let view, nav, loader;
let commits = [];
let ready = false;
let statusMsg = "Select a commits.json file…";

let modeBtn;       // time ↔ sequence
let gapsToggle;    // checkbox for sequence gaps

let redrawScheduled = false;

let codesManager;
let codesPanel;

let composing = false;
let composeBuf = "";

// Info panel rect (used to place controls beneath it)
let infoPanelRect = {x: 16, y: 16, w: 360, h: 0};

function scheduleRedraw() {
    if (redrawScheduled) return;
    redrawScheduled = true;
    requestAnimationFrame(() => {
        redraw();
        redrawScheduled = false;
    });
}

function layoutUI() {
    // Codes panel under the top controls/info area; height responds to window size
    const timelineY = height * 0.7;        // this is just for picking a sensible codes panel height
    const panelTop = 96;                   // under the loader+buttons row
    const panelH = Math.max(80, timelineY - panelTop - 140);
    if (codesPanel) codesPanel.setBounds(16, panelTop, width - 32, panelH);
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    noLoop();

    view = new TimelineView(60, 40);
    if (typeof view.setHUDVisible === "function") view.setHUDVisible(false); // we'll draw our own panel

    codesManager = new CodeManager(commits);

    codesPanel = new CodesPanel(codesManager, (indices) => {
        // Replace selection with all commits that have the clicked code
        view.clearSelection();
        for (const idx of indices) view.selected.add(`commit:${idx}`);
        scheduleRedraw();
    });

    // Rebuild card cache when codes change so chips appear/disappear
    codesManager.onChange(() => {
        if (!ready) return;
        view.cache.build(view.commits, view.currentCardW);
        scheduleRedraw();
    });

    nav = new NavController(view, () => scheduleRedraw());

    loader = new DataLoader((loaded) => {
        if (window.CommitFactory) loaded = CommitFactory.toCommitObjs(loaded);
        commits = loaded;

        // ensure codes arrays exist
        for (const c of commits) if (!Array.isArray(c.codes)) c.codes = [];

        view.setData(commits);

        // keep manager in sync with the loaded array, then hydrate codes mapping
        codesManager.setCommitsRef(commits);
        codesManager.hydrateFromCommits();

        ready = true;
        statusMsg = `Loaded ${commits.length} commits. Scroll to zoom, drag to pan. 0 = reset.`;
        if (view.getMode() === "sequence") view.initSequenceViewEdgeToEdge();
        scheduleRedraw();
    });
    loader.mount(16, 16);

    // Mode toggle
    modeBtn = createButton("Mode: time");
    modeBtn.style("padding", "8px 12px");
    modeBtn.style("border", "1px solid #ccc");
    modeBtn.style("border-radius", "8px");
    modeBtn.mousePressed(() => {
        if (view.getMode() === "time") {
            view.setMode("sequence");
            modeBtn.html("Mode: sequence");
            view.rebuildCache();
            view.initSequenceViewEdgeToEdge();
        } else {
            view.setMode("time");
            modeBtn.html("Mode: time");
            const [tMin, tMax] = view.getDomain();
            view.setView(tMin, tMax);
        }
        scheduleRedraw();
    });

    // Sequence gaps toggle
    gapsToggle = createCheckbox("Show day gaps (sequence)", false);
    gapsToggle.changed(() => {
        view.setSequenceGapMode(gapsToggle.checked());
        if (ready && view.getMode() === "sequence" && gapsToggle.checked()) {
            view.initSequenceViewEdgeToEdge();
        }
        scheduleRedraw();
    });

    layoutUI();
    scheduleRedraw();
}

function drawInfoPanel() {
    // Left-aligned info panel at the top
    const x = 16, y = 16, w = Math.min(400, width - 32);
    let cy = y + 12;

    // Stats snapshot from the view (fallbacks if method not present)
    const stats = view?.getFrameStats?.() || {visibleCount: 0, renderCards: true};
    const span = view.getView ? (view.getView()[1] - view.getView()[0]) : 0;
    const spanLabel = (view.getMode() === "time")
        ? `span: ${(span / 86400).toFixed(2)} days`
        : `span: ${span.toFixed(2)} commits`;
    const gaps = (view.getMode() === "sequence" && view.getSequenceGapMode?.()) ? " | gaps: on" : "";
    const line1 = statusMsg || "";
    const line2 = `Mode: ${view.getMode()}${gaps} | ${spanLabel}`;
    const line3 = `Visible: ${stats.visibleCount}  |  Cards: ${stats.renderCards ? "on" : "off"}`;
    const instr = "Scroll to zoom, drag to pan. Press 0 to reset. Type to add code, Enter to assign.";

    // Measure height & draw panel
    textSize(12);
    const lh = 18;
    const lines = [line1, line2, line3, instr];
    const totalH = 12 + lines.length * lh + 12;

    noStroke();
    fill(0, 100);
    rect(x, y, w, totalH, 8);

    fill(255);
    textAlign(LEFT, TOP);
    for (const line of lines) {
        text(line, x + 10, cy);
        cy += lh;
    }

    // expose rect so we can place controls underneath
    infoPanelRect = {x, y, w, h: totalH};
}

function placeControlsUnderInfoPanel() {
    if (!modeBtn || !gapsToggle) return;

    const gapY = 8;
    const x = infoPanelRect.x + 4;
    const y = infoPanelRect.y + infoPanelRect.h + gapY;

    // Measure actual DOM sizes (with safe fallbacks)
    let btnW = 110, btnH = 34;
    let chkW = 220, chkH = 24;
    try {
        const b = modeBtn.elt.getBoundingClientRect();
        btnW = Math.max(btnW, Math.round(b.width));
        btnH = Math.max(btnH, Math.round(b.height));
    } catch {
    }
    try {
        const c = gapsToggle.elt.getBoundingClientRect();
        chkW = Math.max(120, Math.round(c.width));
        chkH = Math.max(chkH, Math.round(c.height));
    } catch {
    }

    // Available width inside the info panel box (some inner padding)
    const availW = Math.max(160, infoPanelRect.w - 16);

    // Position button
    modeBtn.position(x, y);

    // Place checkbox to the right if it fits; otherwise wrap to next line
    const rightX = x + btnW + 12;
    if (btnW + 12 + chkW <= availW) {
        gapsToggle.position(rightX, y + Math.max(0, Math.floor((btnH - chkH) / 2)));
    } else {
        gapsToggle.position(x, y + btnH + 6);
    }
}

function layoutCodesPanelBelowControls() {
    if (!codesPanel) return;

    // --- find controls' bottom in page coords
    let btnBottom = 0, chkBottom = 0;
    try {
        const b = modeBtn?.elt?.getBoundingClientRect();
        if (b) btnBottom = b.top + b.height;
    } catch {
    }
    try {
        const c = gapsToggle?.elt?.getBoundingClientRect();
        if (c) chkBottom = c.top + c.height;
    } catch {
    }

    // --- canvas top in page coords
    let canvasTop = 0;
    try {
        const r = (window._renderer?.elt || document.querySelector("canvas"))?.getBoundingClientRect();
        if (r) canvasTop = r.top;
    } catch {
    }

    const controlsBottomY = Math.max(btnBottom, chkBottom) - canvasTop;

    // --- codes panel top just under controls (and below info panel)
    const topGap = 8;
    const panelY = Math.max(
        controlsBottomY + topGap,
        infoPanelRect.y + infoPanelRect.h + topGap
    );

    // --- hard cap so panel ends ABOVE timestamp area
    const safeTop = (typeof view.getTimelineSafeTopY === "function")
        ? view.getTimelineSafeTopY()
        : ((typeof view.getTimelineY === "function") ? view.getTimelineY() - 44 : height * 0.70 - 44); // fallback

    const bottomGap = 4; // tiny breathing room
    const maxH = Math.max(0, safeTop - bottomGap - panelY);

    // prefer at least 80px if there's room, otherwise whatever fits
    const desiredMin = 80;
    const panelH = Math.max(0, Math.min(Math.max(desiredMin, 0), maxH));

    codesPanel.setBounds(16, panelY, width - 32, panelH);
}


function draw() {
    if (!ready) {
        background(248);
        noStroke();
        fill(30);
        textSize(16);
        text(statusMsg, 16, 60);
        noStroke();
        fill(255);
        rect(16, 80, min(560, width - 32), 130, 12);
        fill(30);
        textSize(14);
        text(
            "How to use:\n1) Choose your commits.json\n2) Scroll to zoom; drag to pan\n3) Press 0 to reset view\n4) Use Mode to switch layouts\n5) In Sequence mode, toggle 'Show day gaps' to see gap cards",
            30, 100
        );
        return;
    }

    // 1) timeline (it clears background internally)
    view.draw(statusMsg);


    // 2) unified info panel + control placement
    drawInfoPanel();
    placeControlsUnderInfoPanel();

    // 3) now that controls are placed, lay out the codes panel below them
    layoutCodesPanelBelowControls();

    // 4) draw the codes panel (needs current selection)
    const selectedCommitIndices = Array.from(view.selected)
        .filter(k => k.startsWith('commit:'))
        .map(k => parseInt(k.split(':')[1], 10))
        .sort((a, b) => a - b);

    codesPanel.draw(selectedCommitIndices);
}

// delegate inputs
function mouseWheel(e) {
    if (ready) return nav.mouseWheel(e);
}

function mousePressed() {
    if (!ready) return;

    if (codesPanel.handleClick(mouseX, mouseY)) {
        scheduleRedraw();
        return;
    }

    const handled = view.handleClick(mouseX, mouseY, keyIsDown(SHIFT));
    if (handled) {
        scheduleRedraw();
        return;
    }

    nav.mousePressed();
}

function mouseDragged() {
    if (ready) nav.mouseDragged();
}

function mouseReleased() {
    if (ready) nav.mouseReleased();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    layoutUI();
    placeControlsUnderInfoPanel();
    if (ready) nav.windowResized();
    scheduleRedraw();
}

function keyTyped() {
    if (!ready) return;
    const hasSelection = Array.from(view.selected).some(k => k.startsWith('commit:'));
    if (!hasSelection) return;

    if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;

    const ch = key;
    if (ch && ch.length === 1 && ch >= ' ' && ch !== '\u007F') {
        if (!composing) {
            composing = true;
            composeBuf = "";
        }
        composeBuf += ch;
        scheduleRedraw();
    }
}

function keyPressed() {
    if (!ready) return;
    if (key === '0') {
        nav.reset();
        return;
    }
    if (!composing) return;

    if (keyCode === ENTER || keyCode === RETURN) {
        const label = (composeBuf || "").trim();
        if (label) {
            const codeObj = codesManager.addOrGet(label); // reuse or create
            const selectedCommitIndices = Array.from(view.selected)
                .filter(k => k.startsWith('commit:'))
                .map(k => parseInt(k.split(':')[1], 10));
            for (const idx of selectedCommitIndices) {
                codesManager.setAssigned(idx, codeObj.id, /*on=*/true);
            }
        }
        composing = false;
        composeBuf = "";
        scheduleRedraw();
    } else if (keyCode === ESCAPE) {
        composing = false;
        composeBuf = "";
        scheduleRedraw();
    } else if (keyCode === BACKSPACE) {
        if (composeBuf.length > 0) {
            composeBuf = composeBuf.slice(0, -1);
            scheduleRedraw();
        }
        return false; // prevent browser nav
    }
}
