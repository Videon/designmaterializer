// code_manager.js
(function () {
    class CodeManager {
        constructor(commitsRef = null) {
            this._commits = commitsRef;   // array of commitobj
            this._codes = [];             // [{ id:number, label:string }]
            this._nextId = 1;
            this._byCommit = new Map();   // commitIndex -> Set(codeId)
            this._onChange = null;        // optional callback when assignments change
        }

        setCommitsRef(ref) {
            this._commits = ref;
        }

        onChange(fn) {
            this._onChange = typeof fn === 'function' ? fn : null;
        }

        _emitChange() {
            if (this._onChange) this._onChange();
        }

        listCodes() {
            return this._codes.slice();
        }

        _norm(s) {
            return String(s || "").trim();
        }

        findByLabel(label) {
            const n = this._norm(label).toLowerCase();
            return this._codes.find(c => c.label.toLowerCase() === n) || null;
        }

        addCode(label) {
            const trimmed = this._norm(label);
            if (!trimmed) return null;
            const existing = this.findByLabel(trimmed);
            if (existing) return existing;
            const obj = {id: this._nextId++, label: trimmed};
            this._codes.push(obj);
            return obj;
        }

        addOrGet(label) {
            return this.findByLabel(label) || this.addCode(label);
        }

        // Sync model from commit objects' codes arrays (useful after loading JSON)
        // Creates code entries as needed and fills _byCommit map.
        hydrateFromCommits() {
            if (!this._commits) return;
            this._byCommit.clear();
            for (let i = 0; i < this._commits.length; i++) {
                const c = this._commits[i];
                if (!Array.isArray(c.codes)) c.codes = [];
                for (const label of c.codes) {
                    const code = this.addOrGet(label);
                    let set = this._byCommit.get(i);
                    if (!set) {
                        set = new Set();
                        this._byCommit.set(i, set);
                    }
                    set.add(code.id);
                }
            }
            this._emitChange();
        }

        // Low-level assign/remove (keeps commitobj.codes in sync)
        setAssigned(commitIndex, codeId, on) {
            // model map
            let set = this._byCommit.get(commitIndex);
            if (on) {
                if (!set) {
                    set = new Set();
                    this._byCommit.set(commitIndex, set);
                }
                set.add(codeId);
            } else if (set) {
                set.delete(codeId);
                if (set.size === 0) this._byCommit.delete(commitIndex);
            }

            // commit object sync
            if (this._commits && this._commits[commitIndex]) {
                const label = (this._codes.find(c => c.id === codeId) || {}).label;
                if (label) {
                    const arr = this._commits[commitIndex].codes || (this._commits[commitIndex].codes = []);
                    const idx = arr.findIndex(s => s.toLowerCase() === label.toLowerCase());
                    if (on && idx === -1) arr.push(label);
                    if (!on && idx !== -1) arr.splice(idx, 1);
                }
            }

            this._emitChange();
        }

        // Toggle same code for many commits; if all had it -> remove, else add.
        toggleForCommits(commitIndices, codeId) {
            if (!commitIndices?.length) return;
            let allHave = true;
            for (const idx of commitIndices) {
                const set = this._byCommit.get(idx);
                if (!set || !set.has(codeId)) {
                    allHave = false;
                    break;
                }
            }
            for (const idx of commitIndices) this.setAssigned(idx, codeId, !allHave);
        }

        getCodesForCommit(commitIndex) {
            const set = this._byCommit.get(commitIndex);
            if (!set) return [];
            return this._codes.filter(c => set.has(c.id));
        }

        getCommitIndicesForCode(codeId) {
            const res = [];
            for (const [idx, set] of this._byCommit.entries()) {
                if (set.has(codeId)) res.push(idx);
            }
            res.sort((a, b) => a - b);
            return res;
        }

    }

    window.CodeManager = CodeManager;
})();
