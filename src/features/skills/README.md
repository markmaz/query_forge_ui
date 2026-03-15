# Skills Frontend

Skills is a frontend automation layer for QueryForge.

## Scope
- Skills overview page with search/filter/status lifecycle controls
- Skill builder drawer with linear workflow blocks:
  - Trigger (required)
  - Condition(s) (optional)
  - Action(s) (required)
- Template picker and live summary preview
- Run history + event timeline UI scaffolding
- Query-context launch from QueryForge V2 (header button + save-modal attach option)

## Data Contract Strategy
- Uses `@/shared/services/api` and `/skills` endpoints where available
- API adapter in `api.ts` normalizes varied payload envelopes (`rows`, `data.rows`, etc.)
- Run history gracefully returns empty list when run endpoints are unavailable

## Extension Points
- Add new trigger/condition/action types in `types.ts` + `constants.ts`
- Expand config forms in `SkillBlockConfigPanel.tsx`
- Add richer lifecycle actions in `SkillsList.tsx` and `SkillBuilderDrawer.tsx`
- Replace placeholder runs/log behavior by wiring real backend run/event endpoints
