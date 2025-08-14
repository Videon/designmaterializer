#!/usr/bin/env python3
"""
export_commits.py
--------------------------------
Export Git commit data (timestamp, title, message) to a JSON file
for use in a p5.js app, inside a top-level "commitObjects" array,
ordered from earliest to most recent.
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

FIELD_SEP = "\x1f"  # Unit Separator
REC_SEP = "\x1e"    # Record Separator

def run_git_log(repo_path: str, since: str, until: str, max_count: int | None) -> str:
    pretty = f"%ct{FIELD_SEP}%s{FIELD_SEP}%b{REC_SEP}"
    cmd = ["git", "-C", repo_path, "log", f"--pretty=format:{pretty}"]
    if max_count is not None:
        cmd.extend(["--max-count", str(max_count)])
    if since:
        cmd.extend(["--since", since])
    if until:
        cmd.extend(["--until", until])

    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        return out.decode("utf-8", errors="replace")
    except subprocess.CalledProcessError as e:
        print("Failed to run git log:\n", e.output.decode("utf-8", errors="replace"), file=sys.stderr)
        sys.exit(1)

def parse_git_output(raw: str):
    commits = []
    for rec in filter(None, raw.split(REC_SEP)):
        parts = rec.split(FIELD_SEP)
        if len(parts) < 3:
            continue

        unix_ts_str, title, body = parts[0], parts[1], parts[2]
        try:
            unix_ts = int(unix_ts_str)
            dt = datetime.fromtimestamp(unix_ts, tz=timezone.utc)
            iso_ts = dt.isoformat().replace("+00:00", "Z")
        except ValueError:
            continue

        message = body.replace("\r\n", "\n").rstrip()

        commits.append({
            "timestamp": iso_ts,
            "title": title.strip(),
            "message": message
        })
    return commits

def main():
    parser = argparse.ArgumentParser(description="Export Git commits to JSON for p5.js.")
    parser.add_argument("--repo", default=".", help="Path to the Git repository.")
    parser.add_argument("--out", default="commits.json", help="Output JSON file path.")
    parser.add_argument("--since", default="", help='Only include commits after this date/time (e.g., "2024-01-01").')
    parser.add_argument("--until", default="", help='Only include commits before this date/time (e.g., "2025-08-13").')
    parser.add_argument("--max-count", type=int, default=None, help="Limit to N most recent commits.")
    args = parser.parse_args()

    if not os.path.isdir(args.repo):
        print(f"Repository path does not exist: {args.repo}", file=sys.stderr)
        sys.exit(1)

    try:
        subprocess.check_output(["git", "-C", args.repo, "rev-parse", "--is-inside-work-tree"], stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError:
        print(f"Path is not a Git repository: {args.repo}", file=sys.stderr)
        sys.exit(1)

    raw = run_git_log(args.repo, args.since, args.until, args.max_count)
    commits = parse_git_output(raw)

    # Reverse to earliest → latest
    commits.reverse()

    output_data = {
        "commitObjects": commits
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(commits)} commits (earliest to latest) inside 'commitObjects' to {args.out}")

if __name__ == "__main__":
    main()
