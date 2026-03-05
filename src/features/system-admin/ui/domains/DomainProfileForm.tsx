import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import type {
  DomainProfile,
  DomainProfileCreateRequest,
  DomainProfileUpdateRequest,
  Synonym,
  Acronym,
} from "@/features/system-admin/types";
import TagInput from "./TagInput";
import SynonymEditor from "./SynonymEditor";
import AcronymEditor from "./AcronymEditor";

interface FormValues {
  domain_id: number;
  summary: string;
  keywords: string[];
  entities: string[];
  metrics: string[];
  attributes: string[];
  synonyms: Synonym[];
  acronyms: Acronym[];
  notes: string;
  embedding_text: string;
}

interface DomainProfileFormProps {
  profile?: DomainProfile | null;
  onSave: (data: DomainProfileCreateRequest | DomainProfileUpdateRequest) => void;
  onCancel: () => void;
  busy: boolean;
}

export default function DomainProfileForm({
  profile,
  onSave,
  onCancel,
  busy,
}: DomainProfileFormProps) {
  const isEdit = !!profile;
  const [embeddingOpen, setEmbeddingOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      domain_id: profile?.domain_id ?? 0,
      summary: profile?.summary ?? "",
      keywords: profile?.keywords ?? [],
      entities: profile?.entities ?? [],
      metrics: profile?.metrics ?? [],
      attributes: profile?.attributes ?? [],
      synonyms: profile?.synonyms ?? [],
      acronyms: profile?.acronyms ?? [],
      notes: profile?.notes ?? "",
      embedding_text: profile?.embedding_text ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    const clean = (arr: string[]) => (arr.length ? arr : undefined);
    const cleanObj = <T,>(arr: T[]) => (arr.length ? arr : undefined);

    if (isEdit) {
      const body: DomainProfileUpdateRequest = {
        summary: values.summary || undefined,
        keywords: clean(values.keywords),
        entities: clean(values.entities),
        metrics: clean(values.metrics),
        attributes: clean(values.attributes),
        synonyms: cleanObj(values.synonyms.filter((s) => s.term.trim())),
        acronyms: cleanObj(values.acronyms.filter((a) => a.abbr.trim())),
        notes: values.notes || undefined,
        embedding_text: values.embedding_text || undefined,
      };
      onSave(body);
    } else {
      const body: DomainProfileCreateRequest = {
        domain_id: Number(values.domain_id),
        summary: values.summary || undefined,
        keywords: clean(values.keywords),
        entities: clean(values.entities),
        metrics: clean(values.metrics),
        attributes: clean(values.attributes),
        synonyms: cleanObj(values.synonyms.filter((s) => s.term.trim())),
        acronyms: cleanObj(values.acronyms.filter((a) => a.abbr.trim())),
        notes: values.notes || undefined,
        embedding_text: values.embedding_text || undefined,
      };
      onSave(body);
    }
  }

  return (
    <>
      <div className="sa-drawer-backdrop" onClick={onCancel} />
      <div className="sa-drawer">
        <div className="sa-drawer-header">
          <h2>{isEdit ? "Edit Domain Profile" : "Create Domain Profile"}</h2>
          <button type="button" className="btn btn-sm btn-light" onClick={onCancel}>
            <i className="fa fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="sa-drawer-body">
          <div className="sa-field">
            <label>Domain ID</label>
            <input
              type="number"
              className="form-control form-control-sm"
              disabled={isEdit}
              {...register("domain_id", {
                required: !isEdit && "Domain ID is required",
                min: { value: 1, message: "Must be greater than 0" },
                valueAsNumber: true,
              })}
            />
            {errors.domain_id && <div className="error">{errors.domain_id.message}</div>}
          </div>

          <div className="sa-field">
            <label>Summary</label>
            <textarea
              className="form-control form-control-sm"
              rows={3}
              {...register("summary", { required: "Summary is required" })}
            />
            {errors.summary && <div className="error">{errors.summary.message}</div>}
          </div>

          <div className="sa-field">
            <label>Keywords</label>
            <Controller
              name="keywords"
              control={control}
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="Add keywords…" />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Entities</label>
            <Controller
              name="entities"
              control={control}
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="Add entities…" />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Metrics</label>
            <Controller
              name="metrics"
              control={control}
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="Add metrics…" />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Attributes</label>
            <Controller
              name="attributes"
              control={control}
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="Add attributes…" />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Synonyms</label>
            <Controller
              name="synonyms"
              control={control}
              render={({ field }) => (
                <SynonymEditor value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Acronyms</label>
            <Controller
              name="acronyms"
              control={control}
              render={({ field }) => (
                <AcronymEditor value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="sa-field">
            <label>Notes</label>
            <textarea
              className="form-control form-control-sm"
              rows={3}
              {...register("notes")}
            />
          </div>

          <div className="sa-field">
            <button
              type="button"
              className="sa-collapsible-toggle"
              onClick={() => setEmbeddingOpen(!embeddingOpen)}
            >
              <i className={`fa fa-chevron-${embeddingOpen ? "down" : "right"}`} />{" "}
              Embedding Text
            </button>
            {embeddingOpen && (
              <>
                <textarea
                  className="form-control form-control-sm mt-1"
                  rows={4}
                  {...register("embedding_text")}
                />
                <div className="hint">Auto-generated if left empty</div>
              </>
            )}
          </div>

          {isEdit && profile?.content_hash && (
            <div className="sa-field">
              <label>Content Hash</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={profile.content_hash}
                readOnly
              />
            </div>
          )}

          <div className="sa-drawer-footer" style={{ padding: 0, border: "none", marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
              {busy && <span className="sa-spinner" style={{ marginRight: 6 }} />}
              {isEdit ? "Save Changes" : "Create Profile"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
