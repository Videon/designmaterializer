// codes_model.js
(function () {
    class CodesModel {
        constructor() {
            this._codes = [];                 // [{id, label}]
            this._nextId = 1;
            this._byCommit = new Map();       // commitIndex -> Set(codeId)
        }

        listCodes() {
            return this._codes.slice();
        }

        addCode(label) {
            const trimmed = String(label || "").trim();
            if (!trimmed) return null;
            // de-dup by label (case-insensitive)
            const exists = this._codes.find(c => c.label.toLowerCase() === trimmed.toLowerCase());
            if (exists) return exists;
            const c = {id: this._nextId++, label: trimmed};
            this._codes.push(c);
            return c;
        }

        removeCode(id) {
            this._codes = this._codes.filter(c => c.id !== id);
            // remove from all commits
            for (const set of this._byCommit.values()) set.delete(id);
        }

        getCodesForCommit(commitIndex) {
            const set = this._byCommit.get(commitIndex);
            if (!set) return [];
            // return code objects (filtered in case some code was removed)
            return this._codes.filter(c => set.has(c.id));
        }

        // Attach (true)/detach (false) a single code to a single commit
        setAssigned(commitIndex, codeId, on) {
            let set = this._byCommit.get(commitIndex);
            if (on) {
                if (!set) {
                    set = new Set();
                    this._byCommit.set(commitIndex, set);
                }
                set.add(codeId);
            } else {
                if (!set) return;
                set.delete(codeId);
                if (set.size === 0) this._byCommit.delete(commitIndex);
            }
        }

        // Toggle assignment of a code for multiple commits
        toggleForCommits(commitIndices, codeId) {
            if (!commitIndices?.length) return;
            // If ALL selected have it -> remove from all; else add to all
            let allHave = true;
            for (const idx of commitIndices) {
                const set = this._byCommit.get(idx);
                if (!set || !set.has(codeId)) {
                    allHave = false;
                    break;
                }
            }
            for (const idx of commitIndices) {
                this.setAssigned(idx, codeId, !allHave);
            }
        }
    }

    window.CodesModel = CodesModel;
})();
