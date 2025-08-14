// data_loader.js
(function () {
    class DataLoader {
        constructor(onLoaded) {
            this.onLoaded = onLoaded; // (commitobj[]) => void
            this.input = null;
        }

        mount(x = 16, y = 16) {
            this.input = createFileInput(this.handleFile.bind(this), false);
            this.input.attribute("accept", "application/json,.json");
            this.input.style("padding", "8px 12px");
            this.input.style("border", "1px solid #ccc");
            this.input.style("border-radius", "8px");
            this.input.position(x, y);
        }

        handleFile(file) {
            if (!file || typeof file.data !== "string") { alert("Please select a valid JSON file."); return; }
            let parsed;
            try { parsed = JSON.parse(file.data); } catch { alert("Invalid JSON format."); return; }
            const arr = Array.isArray(parsed?.commitObjects) ? parsed.commitObjects : [];
            if (!arr.length) { alert("No commitObjects found in JSON."); return; }
            const commits = arr.map((c, i) => new commitobj(c, i)).sort((a, b) => a.t - b.t);
            this.onLoaded(commits);
        }
    }

    window.DataLoader = DataLoader;
})();
