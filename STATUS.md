# Server status

GitHub Actions queries 83.143.117.49:20415 every ten minutes and publishes
`status.json` to the `server-status` branch using the built-in GITHUB_TOKEN.
No additional secrets or hosting subscription are required for this public repo.
The site reads that public snapshot directly from raw.githubusercontent.com.
Snapshot commits start with `[CF-Pages-Skip]` to avoid repeated Pages builds.

Run the first check from Actions → Farlands server status → Run workflow.
Subsequent scheduled checks may be delayed by GitHub. If GitHub disables the
schedule after 60 days of repository inactivity, re-enable it in Actions.
To stop checks, disable this workflow in Actions.

The page refreshes the saved snapshot once a minute while visible. The refresh
button does not trigger a new UDP query. Snapshots older than 30 minutes are
marked stale. An unanswered query is not proof that the game server is down.

Version is the raw A2S version reported by the server, currently 1.0.0.0;
it must not be interpreted as the installed Valheim release number.
