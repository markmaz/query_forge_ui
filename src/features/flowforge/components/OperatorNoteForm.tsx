import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addFlowForgeRunNote } from "../api/runsApi";

interface OperatorNoteFormProps {
  runId: number;
  canAddNote: boolean;
}

const buildIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function OperatorNoteForm({ runId, canAddNote }: OperatorNoteFormProps) {
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => addFlowForgeRunNote(runId, { note, idempotency_key: buildIdempotencyKey() }),
    onSuccess: async () => {
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "run", runId] });
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "run-events", runId] });
    },
  });

  if (!canAddNote) {
    return <div className="ff-empty-state">Operator notes require Workflow Studio admin access.</div>;
  }

  return (
    <form
      className="ff-note-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (note.trim()) mutation.mutate();
      }}
    >
      <label htmlFor="flowforge-note">Add operator note</label>
      <textarea
        id="flowforge-note"
        value={note}
        maxLength={4000}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Document a call, exception, or routing decision for this run."
      />
      <div className="ff-note-actions">
        {mutation.isError ? <span>Unable to save note.</span> : <span>{note.length}/4000</span>}
        <button type="submit" className="btn btn-primary" disabled={!note.trim() || mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Note"}
        </button>
      </div>
    </form>
  );
}
