# dsh-tool-compact

The `/compact` command, exposed as a tool **the model calls** — over DSH's backend-independent compaction seam.

## Why

dsh already compacts on its own: `dsh-compaction-basic` watches `agent/pre-step` for token pressure and `agent/request-error` for a provider-confirmed overflow. Both are reactive — they fire when the window is nearly gone, at a boundary chosen by an arithmetic threshold rather than by where the work actually has a seam. The model is the only party that knows it just finished reading forty files it will never look at again. `dsh-compaction`'s own README lists the gap: *"Human command, not a model tool"*.

So this plugin adds no compaction of its own. It calls the same seam `/compact` calls, from inside a tool body — which is the one thing the human command cannot do: `compactNow()` requires an **idle** agent (`runMaintenance` throws synchronously otherwise), and a tool always runs mid-turn. `compactIfNeeded(agent, 'context-overflow', signal)` is the mid-turn entry; its range selection is `selectCompactableRange(session, measurement, 0)` — the same call `compactNow` makes. Same summary, same retention, different door.

## Install

```bash
dsh plugin --profile <profile> add /path/to/dsh-tool-compact
```

## Placement

`inject: ['tools', 'compaction']` — **both required, and that is deliberate**: this row belongs wherever `compaction` is, and nowhere else.

It ships no `cordis.patch.yml`, for the same reason its twin `@deepseek-ai/dsh-command-compact` ships none — the engine is not on one fixed plane:

- **Flat composition (headless):** a profile-level sibling, next to `command-compact`.
- **Under agent presets (web):** the web bundle disables the host row, and each preset mounts its own inside a group carrying `isolate: {compaction: true}` — where nothing outside can resolve it.

Placement is therefore manual, per composition, next to `command-compact`. A row put anywhere else fails the boot loudly instead of sitting there registering nothing.

## License

MIT
