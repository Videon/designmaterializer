// sketch.js
let view, nav, loader;
let commits = [];
let ready = false;
let statusMsg = "Select a commits.json file…";

let modeBtn;       // time ↔ sequence
let gapsToggle;    // checkbox for sequence gaps

let redrawScheduled = false;

let codesModel;
let codesPanel;

function scheduleRedraw() {
    if (redrawScheduled) return;
    redrawScheduled = true;
    requestAnimationFrame(() => {
        redraw();
        redrawScheduled = false;
    });
}

function layoutUI() {

    const timelineY = height * 0.7;     // match TimelineView’s 70% timeline line
    const panelTop = 96;        // below your loader + buttons row
    const panelH = Math.max(80, timelineY - panelTop - 140);    // breathing room before timeline
    if (codesPanel) codesPanel.setBounds(16, panelTop, width - 32, panelH);
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    noLoop();

    view = new TimelineView(60, 40);

    // NEW:
    codesModel = new CodesModel();
    codesPanel = new CodesPanel(codesModel);

    nav = new NavController(view, () => scheduleRedraw());
    loader = new DataLoader((loaded) => {
        commits = loaded;
        view.setData(commits);
        ready = true;
        statusMsg = `Loaded ${commits.length} commits. Scroll to zoom, drag to pan. 0 = reset.`;
        if (view.getMode() === "sequence") view.initSequenceViewEdgeToEdge();
        scheduleRedraw();
    });
    loader.mount(16, 16);

    // Mode toggle
    modeBtn = createButton("Mode: time");
    modeBtn.position(180, 16);
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
    gapsToggle.position(300, 18);
    gapsToggle.changed(() => {
        view.setSequenceGapMode(gapsToggle.checked());
        if (ready && view.getMode() === "sequence" && gapsToggle.checked()) {
            view.initSequenceViewEdgeToEdge();
        }
        scheduleRedraw();
    });

    // NEW:
    layoutUI();
    codesPanel.show();

    scheduleRedraw();
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
        text("How to use:\n1) Choose your commits.json\n2) Scroll to zoom; drag to pan\n3) Press 0 to reset view\n4) Use Mode to switch layouts\n5) In Sequence mode, toggle 'Show day gaps' to see gap cards", 30, 100);
        return;
    }

    // 1) draw the timeline (clears background internally)
    view.draw(statusMsg);

    // 2) derive selected commit indices from TimelineView and draw the panel on top
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

    // selected commits from view
    const selectedCommitIndices = Array.from(view.selected)
        .filter(k => k.startsWith('commit:'))
        .map(k => parseInt(k.split(':')[1], 10));

    // Panel takes priority
    if (codesPanel.handleClick(mouseX, mouseY, selectedCommitIndices)) {
        scheduleRedraw();
        return;
    }

    // Otherwise, selection/pan in the timeline view
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

function keyPressed() {
    if (ready && key === '0') nav.reset();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    layoutUI();                 // NEW
    if (ready) nav.windowResized();
    scheduleRedraw();
}

