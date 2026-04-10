import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  ANIM_MS_HIDE,
  ANIM_MS_SHOW,
  INITIAL_SECTIONS_COLLAPSED,
  INITIAL_VISIBLE_SECTIONS,
  PULSE_MS,
  SECTION_ORDER,
  UNLOCK_STAGGER_MS,
  type QueryPathStep,
  type SectionKey,
} from "./queryForgePageUtils";

type UseQueryForgeSectionStateParams = {
  domainId: number | null;
  hasRehydrateContent: boolean;
  onDomainSelectReset: () => void;
};

type UseQueryForgeSectionStateResult = {
  activeSection: SectionKey;
  fullscreenKey: SectionKey | null;
  inFocusMode: boolean;
  queryPath: QueryPathStep[];
  sectionWrapStyle: (key: SectionKey) => CSSProperties;
  shouldRenderSection: (key: SectionKey) => boolean;
  effectiveCollapsed: (key: SectionKey) => boolean;
  markSectionInteraction: (section: SectionKey) => void;
  focusSection: (key: SectionKey) => void;
  toggleSection: (key: SectionKey) => void;
  hideSection: (key: SectionKey) => void;
  showSection: (key: SectionKey) => void;
  expandSection: (key: SectionKey) => void;
  resetSectionState: () => void;
  setFullscreenKey: (key: SectionKey | null) => void;
  visibleSections: Record<SectionKey, boolean>;
};

export function useQueryForgeSectionState({
  domainId,
  hasRehydrateContent,
  onDomainSelectReset,
}: UseQueryForgeSectionStateParams): UseQueryForgeSectionStateResult {
  const [activeSection, setActiveSection] = useState<SectionKey>("domain");
  const [visibleSections, setVisibleSections] = useState<
    Record<SectionKey, boolean>
  >(INITIAL_VISIBLE_SECTIONS);
  const [sectionAnim, setSectionAnim] = useState<
    Partial<Record<SectionKey, "hiding" | "showing">>
  >({});
  const [, setRailPulse] = useState<Partial<Record<SectionKey, boolean>>>({});
  const [sectionsCollapsed, setSectionsCollapsed] = useState<
    Record<SectionKey, boolean>
  >(INITIAL_SECTIONS_COLLAPSED);
  const [fullscreenKey, setFullscreenKey] = useState<SectionKey | null>(null);
  const [queryPath, setQueryPath] = useState<QueryPathStep[]>([
    { key: "domain", label: "Domain", status: "active" },
    { key: "prompt", label: "Prompt", status: "todo" },
    { key: "suggested", label: "Suggestions", status: "todo" },
    { key: "columns", label: "Columns", status: "todo" },
    { key: "dataprep", label: "Data Prep", status: "todo" },
    { key: "filters", label: "Filters", status: "todo" },
    { key: "aggs", label: "Aggregations", status: "todo" },
    { key: "sorting", label: "Sorting", status: "todo" },
    { key: "preview", label: "Preview", status: "todo" },
  ]);

  const unlockRanForDomainRef = useRef<number | null>(null);
  const inFocusMode = fullscreenKey !== null;

  const setPathActive = (active: SectionKey) => {
    setQueryPath((prev) => {
      const idx = prev.findIndex((s) => s.key === active);
      if (idx < 0) return prev;
      return prev.map((s, i) => {
        if (i < idx) return { ...s, status: "done" };
        if (i === idx) return { ...s, status: "active" };
        return { ...s, status: "todo" };
      });
    });
  };

  const markSectionInteraction = (section: SectionKey) => {
    setActiveSection(section);
    setPathActive(section);
  };

  const pulseRail = (key: SectionKey) => {
    setRailPulse((p) => ({ ...p, [key]: true }));
    window.setTimeout(() => {
      setRailPulse((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }, PULSE_MS);
  };

  const shouldRenderSection = (key: SectionKey) => {
    if (!visibleSections[key]) return false;
    if (!inFocusMode) return true;
    return fullscreenKey === key;
  };

  const effectiveCollapsed = (key: SectionKey) => {
    if (fullscreenKey === key) return false;
    return sectionsCollapsed[key];
  };

  const focusSection = (key: SectionKey) => {
    setActiveSection(key);
    setPathActive(key);

    if (key !== "domain") {
      setSectionsCollapsed((p) => ({ ...p, domain: true }));
    }
  };

  const hideSection = (key: SectionKey) => {
    if (!visibleSections[key] || sectionAnim[key] === "hiding") return;
    if (fullscreenKey === key) setFullscreenKey(null);

    setSectionAnim((p) => ({ ...p, [key]: "hiding" }));

    window.setTimeout(() => {
      setVisibleSections((p) => ({ ...p, [key]: false }));
      setSectionAnim((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });

      pulseRail(key);

      if (activeSection === key) {
        const nextActive =
          SECTION_ORDER.find((candidate) => candidate !== key && visibleSections[candidate]) ??
          "domain";
        setActiveSection(nextActive);
        setPathActive(nextActive);
      }
    }, ANIM_MS_HIDE);
  };

  const showSection = (key: SectionKey) => {
    if (visibleSections[key]) return;

    setVisibleSections((p) => ({ ...p, [key]: true }));

    requestAnimationFrame(() => {
      setSectionAnim((p) => ({ ...p, [key]: "showing" }));
      window.setTimeout(() => {
        setSectionAnim((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      }, ANIM_MS_SHOW);
    });
  };

  const runUnlockFlow = (mode: "domainSelect" | "rehydrate") => {
    const toReveal: SectionKey[] = [
      "prompt",
      "suggested",
      "columns",
      "dataprep",
      "filters",
      "aggs",
      "sorting",
      "preview",
    ];

    setFullscreenKey(null);

    toReveal.forEach((key, idx) => {
      window.setTimeout(() => showSection(key), idx * UNLOCK_STAGGER_MS);
    });

    setSectionsCollapsed((p) => ({
      ...p,
      domain: false,
      prompt: false,
      suggested: true,
      columns: false,
      dataprep: true,
      filters: true,
      aggs: true,
      sorting: true,
      preview: true,
    }));

    setActiveSection("prompt");
    setPathActive("prompt");

    if (mode === "domainSelect") {
      onDomainSelectReset();
    }
  };

  const resetSectionState = () => {
    unlockRanForDomainRef.current = null;
    setFullscreenKey(null);
    setVisibleSections(INITIAL_VISIBLE_SECTIONS);
    setSectionsCollapsed(INITIAL_SECTIONS_COLLAPSED);
    setActiveSection("domain");
    setPathActive("domain");
    setSectionAnim({});
    setRailPulse({});
  };

  useEffect(() => {
    if (domainId == null) {
      resetSectionState();
      return;
    }

    if (unlockRanForDomainRef.current === domainId) return;
    unlockRanForDomainRef.current = domainId;

    runUnlockFlow(hasRehydrateContent ? "rehydrate" : "domainSelect");
  }, [domainId, hasRehydrateContent]);

  const expandSection = (key: SectionKey) => {
    setSectionsCollapsed((prev) => ({ ...prev, [key]: false }));
    focusSection(key);
  };

  const toggleSection = (key: SectionKey) => {
    if (fullscreenKey === key) return;

    setSectionsCollapsed((prev) => {
      const nextCollapsed = !prev[key];

      if (nextCollapsed === false) {
        focusSection(key);
      } else if (activeSection === key) {
        const nextActive =
          SECTION_ORDER.find((candidate) => candidate !== key && prev[candidate] === false) ??
          "domain";
        focusSection(nextActive);
      }

      return { ...prev, [key]: nextCollapsed };
    });
  };

  const sectionWrapStyle = (key: SectionKey): CSSProperties => {
    const isActive = key === activeSection;
    const isFull = fullscreenKey === key;
    const anim = sectionAnim[key];

    const base: CSSProperties = {
      width: "100%",
      minWidth: 0,
      ...(isFull
        ? {
            flex: "1 1 auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }
        : null),
    };

    if (anim === "hiding") {
      return {
        ...base,
        opacity: 0,
        transform: "translateX(-90px) scale(0.92)",
        transformOrigin: "left center",
        transition: `opacity ${ANIM_MS_HIDE}ms ease, transform ${ANIM_MS_HIDE}ms ease`,
        pointerEvents: "none",
      };
    }

    if (anim === "showing") {
      return {
        ...base,
        opacity: 1,
        transform: "translateX(0) scale(1)",
        transformOrigin: "left center",
        animation: `ncq-show ${ANIM_MS_SHOW}ms ease`,
      };
    }

    return {
      ...base,
      opacity: isActive ? 1 : 0.9,
      filter: isActive ? "none" : "grayscale(0.12)",
      transform: isActive ? "none" : "scale(0.998)",
      transition: "opacity 140ms ease, filter 140ms ease, transform 140ms ease",
    };
  };

  return {
    activeSection,
    fullscreenKey,
    inFocusMode,
    queryPath,
    sectionWrapStyle,
    shouldRenderSection,
    effectiveCollapsed,
    markSectionInteraction,
    focusSection,
    toggleSection,
    hideSection,
    showSection,
    expandSection,
    resetSectionState,
    setFullscreenKey,
    visibleSections,
  };
}
