import { useMemo } from "react";
import { SKILL_TEMPLATES } from "../constants";

export function useSkillTemplates() {
  return useMemo(() => SKILL_TEMPLATES, []);
}
