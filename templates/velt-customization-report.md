# Velt customization — run report

**Run:** `{runId}` · **Guide version:** `{guideVersion.sha}` ({guideVersion.isoTime})
**Figma:** `{figmaNode}` · **Target repo:** `{targetRepo}` · **Chosen plan:** {per-surface layers}

## Coverage — estimated vs actual

| Surface | Layer | Status | Goals met / total | Estimated % | Actual % | Screenshots |
|---|---|---|---|---|---|---|
| {surface} | {layer} | matched/partial/blocked | {m}/{t} | {est}% | {actual}% | {links} |

**Overall actual coverage:** ~{n}% · **Tokens:** {n} ({per-phase breakdown})

## Blocked / partial (needs attention)

- {surface} — {blocked: why / partial: which goals are SDK gaps → see sdk-gap-report.md}

## Ignored / out of scope

- {figmaNode} — {non-Velt host UI | no Velt surface}

## Code changes

Under `components/velt/ui-customization/` (one stylesheet, one `<VeltWireframe>`):
- {file} — {surface}

## Learnings (from the run journal)

- {one-line root-cause per partial/blocked, for next time}
