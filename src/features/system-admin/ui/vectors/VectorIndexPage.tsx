import { useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  useRebuildAll,
  useRebuildSemanticConcepts,
  useRebuildEmbeddings,
  useReindexDomainVectors,
} from "@/features/system-admin/hooks";
import type { IndexCardState } from "@/features/system-admin/types";
import IndexCard from "./IndexCard";
import RebuildAllDialog from "./RebuildAllDialog";
import "../systemAdmin.css";

type CardKey =
  | "semantic_concepts"
  | "table_catalog"
  | "column_catalog"
  | "domain_vectors";

const INITIAL_STATE: IndexCardState = { status: "idle" };

const CARD_DEFS: Array<{
  key: CardKey;
  title: string;
  description: string;
}> = [
  {
    key: "semantic_concepts",
    title: "Semantic Concepts",
    description: "Concepts + aliases from semantic registry",
  },
  {
    key: "table_catalog",
    title: "Table Catalog",
    description: "Model tables for search",
  },
  {
    key: "column_catalog",
    title: "Column Catalog",
    description: "Workspace columns for search",
  },
  {
    key: "domain_vectors",
    title: "Domain Vectors",
    description: "Domain profiles for planner routing",
  },
];

export default function VectorIndexPage() {
  const [cards, setCards] = useState<Record<CardKey, IndexCardState>>({
    semantic_concepts: INITIAL_STATE,
    table_catalog: INITIAL_STATE,
    column_catalog: INITIAL_STATE,
    domain_vectors: INITIAL_STATE,
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const rebuildAll = useRebuildAll();
  const rebuildSemantic = useRebuildSemanticConcepts();
  const rebuildEmbeddings = useRebuildEmbeddings();
  const reindexDomain = useReindexDomainVectors();

  const anyBuilding = Object.values(cards).some((c) => c.status === "building");

  const patchCard = useCallback(
    (key: CardKey, patch: Partial<IndexCardState>) =>
      setCards((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } })),
    [],
  );

  const handleRebuildSemantic = useCallback(() => {
    patchCard("semantic_concepts", { status: "building", error: undefined });
    rebuildSemantic.mutate(
      {},
      {
        onSuccess: (data) => {
          patchCard("semantic_concepts", {
            status: "completed",
            result: data.result as unknown as Record<string, unknown>,
          });
          toast.success("Semantic concepts rebuilt");
        },
        onError: (err) => {
          patchCard("semantic_concepts", { status: "error", error: err.message });
          toast.error(`Semantic concepts failed: ${err.message}`);
        },
      },
    );
  }, [rebuildSemantic, patchCard]);

  const handleRebuildEmbeddings = useCallback(
    (key: "table_catalog" | "column_catalog") => {
      patchCard(key, { status: "building", error: undefined });
      rebuildEmbeddings.mutate(
        { include_tables: key === "table_catalog" },
        {
          onSuccess: (data) => {
            patchCard(key, {
              status: "completed",
              result: data.result as unknown as Record<string, unknown>,
            });
            toast.success(`${key === "table_catalog" ? "Table" : "Column"} catalog rebuilt`);
          },
          onError: (err) => {
            patchCard(key, { status: "error", error: err.message });
            toast.error(`${key === "table_catalog" ? "Table" : "Column"} catalog failed: ${err.message}`);
          },
        },
      );
    },
    [rebuildEmbeddings, patchCard],
  );

  const handleReindexDomain = useCallback(() => {
    patchCard("domain_vectors", { status: "building", error: undefined });
    reindexDomain.mutate(
      {},
      {
        onSuccess: (data) => {
          patchCard("domain_vectors", {
            status: "completed",
            result: data.result as unknown as Record<string, unknown>,
          });
          toast.success("Domain vectors reindexed");
        },
        onError: (err) => {
          patchCard("domain_vectors", { status: "error", error: err.message });
          toast.error(`Domain vectors failed: ${err.message}`);
        },
      },
    );
  }, [reindexDomain, patchCard]);

  const handleIndividualRebuild = useCallback(
    (key: CardKey) => {
      switch (key) {
        case "semantic_concepts":
          return handleRebuildSemantic();
        case "table_catalog":
        case "column_catalog":
          return handleRebuildEmbeddings(key);
        case "domain_vectors":
          return handleReindexDomain();
      }
    },
    [handleRebuildSemantic, handleRebuildEmbeddings, handleReindexDomain],
  );

  const handleRebuildAllConfirm = useCallback(
    (force: boolean) => {
      const allKeys: CardKey[] = [
        "semantic_concepts",
        "table_catalog",
        "column_catalog",
        "domain_vectors",
      ];
      for (const k of allKeys) {
        patchCard(k, { status: "building", error: undefined, result: undefined });
      }

      rebuildAll.mutate(
        { force },
        {
          onSuccess: (data) => {
            if (data.results.semantic_concepts) {
              patchCard("semantic_concepts", {
                status: data.errors.semantic_concepts ? "error" : "completed",
                result: data.results.semantic_concepts as unknown as Record<string, unknown>,
                error: data.errors.semantic_concepts,
              });
            } else {
              patchCard("semantic_concepts", {
                status: data.errors.semantic_concepts ? "error" : "completed",
                error: data.errors.semantic_concepts,
              });
            }

            if (data.results.embeddings) {
              const embResult = data.results.embeddings as unknown as Record<string, unknown>;
              patchCard("table_catalog", {
                status: data.errors.table_catalog ? "error" : "completed",
                result: embResult,
                error: data.errors.table_catalog,
              });
              patchCard("column_catalog", {
                status: data.errors.column_catalog ? "error" : "completed",
                result: embResult,
                error: data.errors.column_catalog,
              });
            } else {
              patchCard("table_catalog", {
                status: data.errors.table_catalog ? "error" : "completed",
                error: data.errors.table_catalog,
              });
              patchCard("column_catalog", {
                status: data.errors.column_catalog ? "error" : "completed",
                error: data.errors.column_catalog,
              });
            }

            if (data.results.domain_vectors) {
              patchCard("domain_vectors", {
                status: data.errors.domain_vectors ? "error" : "completed",
                result: data.results.domain_vectors as unknown as Record<string, unknown>,
                error: data.errors.domain_vectors,
              });
            } else {
              patchCard("domain_vectors", {
                status: data.errors.domain_vectors ? "error" : "completed",
                error: data.errors.domain_vectors,
              });
            }

            if (data.status === "completed") {
              toast.success("All indexes rebuilt successfully");
            } else {
              toast.warning("Rebuild completed with errors");
            }
            setDialogOpen(false);
          },
          onError: (err) => {
            for (const k of allKeys) {
              patchCard(k, { status: "error", error: err.message });
            }
            toast.error(`Rebuild all failed: ${err.message}`);
            setDialogOpen(false);
          },
        },
      );
    },
    [rebuildAll, patchCard],
  );

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Vector Index Management</h1>
          <p className="sa-page-subtitle">
            Rebuild and monitor vector indexes for semantic search
          </p>
        </div>
        <button
          className="btn btn-primary"
          disabled={anyBuilding}
          onClick={() => setDialogOpen(true)}
        >
          <i className="fa fa-refresh" /> Rebuild All
        </button>
      </div>

      <div className="sa-build-order">
        <h4>Build Order</h4>
        <ol>
          <li>Semantic Concepts <span className="note">— concepts &amp; aliases</span></li>
          <li>Table &amp; Column Catalog <span className="note">— embeddings</span></li>
          <li>Domain Vectors <span className="note">— planner routing profiles</span></li>
        </ol>
      </div>

      <div className="sa-card-grid">
        {CARD_DEFS.map((def) => (
          <IndexCard
            key={def.key}
            title={def.title}
            description={def.description}
            status={cards[def.key].status}
            result={cards[def.key].result}
            error={cards[def.key].error}
            onRebuild={() => handleIndividualRebuild(def.key)}
            disabled={anyBuilding}
          />
        ))}
      </div>

      <RebuildAllDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleRebuildAllConfirm}
        busy={rebuildAll.isPending}
      />
    </div>
  );
}
