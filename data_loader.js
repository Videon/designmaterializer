// data_loader.js
(function () {
    class DataLoader {
        constructor(onLoaded) {
            this.onLoaded = onLoaded; // (commitobj[]) => void
            this.input = null;
            this.sampleBtn = null;     // NEW
            this._pos = {x: 16, y: 16};
        }

        mount(x = 16, y = 16) {
            this._pos = {x, y};

            // File input
            this.input = createFileInput(this.handleFile.bind(this), false);
            this.input.attribute("accept", "application/json,.json");
            this.input.style("padding", "8px 12px");
            this.input.style("border", "1px solid #ccc");
            this.input.style("border-radius", "8px");
            this.input.position(x, y);

            // NEW: "Load sample" button
            this.sampleBtn = createButton("Load sample");
            this.sampleBtn.style("padding", "8px 12px");
            this.sampleBtn.style("border", "1px solid #ccc");
            this.sampleBtn.style("border-radius", "8px");
            this.sampleBtn.mousePressed(() => this.loadSample());

            // place it to the right of the file input
            // (use a small async so offsetWidth is available)
            setTimeout(() => {
                try {
                    const w = this.input?.elt?.offsetWidth || 120;
                    this.sampleBtn.position(x + w + 8, y);
                } catch {
                    this.sampleBtn.position(x + 130, y);
                }
            }, 0);

            return this;
        }

        // --- Visibility helpers (updated to handle both elements) ---
        hide() {
            if (this.input) this.input.hide();
            if (this.sampleBtn) this.sampleBtn.hide();
        }

        show() {
            if (this.input) this.input.show();
            if (this.sampleBtn) this.sampleBtn.show();
            // re-position sample button relative to input
            const {x, y} = this._pos;
            try {
                const w = this.input?.elt?.offsetWidth || 120;
                if (this.sampleBtn) this.sampleBtn.position(x + w + 8, y);
            } catch {
            }
        }

        unmount() {
            if (this.input) {
                this.input.remove();
                this.input = null;
            }
            if (this.sampleBtn) {
                this.sampleBtn.remove();
                this.sampleBtn = null;
            }
        }

        // --- Shared parser so file input and sample use identical logic ---
        processText(text) {
            // strip UTF-8 BOM if present
            if (text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch {
                alert("Invalid JSON format.");
                return;
            }

            const arr = Array.isArray(parsed?.commitObjects) ? parsed.commitObjects : [];
            if (!arr.length) {
                alert("No commitObjects found in JSON.");
                return;
            }

            const commits = arr.map((c, i) => new commitobj(c, i)).sort((a, b) => a.t - b.t);
            this.onLoaded(commits);

            // hide controls after a successful load
            this.hide();
        }

        handleFile(file) {
            // Old path: p5 already gave us the text
            if (file && typeof file.data === "string" && file.data.length) {
                this.processText(file.data);
                return;
            }

            // Fallback: read the underlying File directly (varies by browser/p5 version)
            if (file && file.file instanceof File) {
                const fr = new FileReader();
                fr.onerror = () => alert("Failed to read file.");
                fr.onload = () => this.processText(String(fr.result || ""));
                fr.readAsText(file.file);
                return;
            }

            alert("Please select a valid JSON file.");
        }

        // --- NEW: load sample_commits.json from project root ---
        async loadSample() {
            try {
                const resp = await fetch("sample_commits.json", {cache: "no-store"});
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const text = await resp.text();
                this.processText(text);
            } catch (e) {
                alert("Couldn't load sample_commits.json. Make sure it's in the project root and you're running via a local server (not file://).");
                console.error(e);
            }
        }
    }

    window.DataLoader = DataLoader;
})();
