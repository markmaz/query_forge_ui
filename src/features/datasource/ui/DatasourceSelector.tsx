import React, { useRef, useEffect } from "react";
import { Label, FormGroup, Input, Spinner } from "reactstrap";
import { useAppDispatch, useAppSelector } from "../../../shared/runtime/hooks";
import { setSelectedDatasource } from "../model/datasourceSlice";
import { useDatasources } from "../hooks/useDatasources";

export const DatasourceSelector: React.FC = () => {
  const dispatch = useAppDispatch();
  const selectedDatasource = useAppSelector(
    (state) => state.datasource.selectedDatasource,
  );
  const { datasources, isLoading, isError, error, refetch } = useDatasources();

  // Used to restore focus to the select after a successful retry.
  // When the error branch is replaced by the happy-path branch, the Retry
  // button is removed from the DOM, which would otherwise drop focus to
  // document.body (WCAG 2.4.3).
  const selectRef = useRef<HTMLInputElement>(null);
  const wasInErrorState = useRef(false);

  // Track transitions out of error state so we know when a retry succeeded.
  useEffect(() => {
    if (isError) {
      wasInErrorState.current = true;
    }
  }, [isError]);

  // After data loads following an error, move focus to the select element so
  // keyboard and screen-reader users land on the newly available control
  // rather than losing focus to document.body (WCAG 2.4.3).
  useEffect(() => {
    if (
      !isLoading &&
      !isError &&
      datasources.length > 0 &&
      wasInErrorState.current
    ) {
      wasInErrorState.current = false;
      selectRef.current?.focus();
    }
  }, [isLoading, isError, datasources.length]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSelectedDatasource(e.target.value));
  };

  if (isLoading) {
    return (
      // role="status" on the wrapper ensures the loading announcement is
      // conveyed as a polite status message (WCAG 4.1.3). The visible "Data
      // Source" text is rendered as a <span> rather than a <Label> because
      // there is no form control to associate it with in this branch.
      <FormGroup
        className="mb-0 d-flex align-items-center gap-2"
        role="status"
        aria-label="Data Source: loading"
      >
        <span
          className="mb-0 text-muted small fw-semibold"
          style={{ whiteSpace: "nowrap" }}
          aria-hidden="true"
        >
          Data Source
        </span>
        {/* aria-hidden because the role="status" wrapper already provides the
            accessible announcement; the spinner is purely decorative here. */}
        <Spinner size="sm" color="secondary" aria-hidden="true" />
      </FormGroup>
    );
  }

  if (isError) {
    const message =
      error instanceof Error ? error.message : "Failed to load datasources.";
    return (
      <FormGroup className="mb-0">
        {/* Visible label kept as <span> — no associated control in this
            branch (WCAG 1.3.1). */}
        <span
          className="mb-0 text-muted small fw-semibold"
          style={{ whiteSpace: "nowrap" }}
        >
          Data Source
        </span>
        <div className="d-flex align-items-center gap-2 mt-1">
          {/* role="alert" triggers an immediate announcement on state entry
              (WCAG 3.3.1, 4.1.3). */}
          <span
            id="datasource-error"
            className="text-danger small"
            role="alert"
          >
            {message}
          </span>
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-danger"
            onClick={() => void refetch()}
            aria-label="Retry loading datasources"
          >
            Retry
          </button>
        </div>
      </FormGroup>
    );
  }

  if (datasources.length === 0) {
    return (
      <FormGroup className="mb-0">
        <span
          className="mb-0 text-muted small fw-semibold"
          style={{ whiteSpace: "nowrap" }}
        >
          Data Source
        </span>
        <span className="text-muted small ms-2" role="status">
          No datasources configured
        </span>
      </FormGroup>
    );
  }

  return (
    <FormGroup className="mb-0 d-flex align-items-center gap-2">
      <Label
        for="datasource-select"
        className="mb-0 text-muted small fw-semibold"
        style={{ whiteSpace: "nowrap" }}
      >
        Data Source
      </Label>
      {/* aria-label removed: the visible <Label> already provides the
          programmatic name via htmlFor/id association. A redundant aria-label
          would override the visible label text in screen reader output, making
          the announced name ("Select data source") differ from what is
          displayed ("Data Source") — violating the accessible name consistency
          expectation of WCAG 2.5.3 (AAA) and creating unnecessary confusion.
          The <label> association alone is sufficient (WCAG 1.3.1, 3.3.2). */}
      <Input
        type="select"
        id="datasource-select"
        name="datasource"
        bsSize="sm"
        value={selectedDatasource}
        onChange={handleChange}
        style={{ width: "auto", minWidth: 120 }}
        innerRef={selectRef}
      >
        {datasources.map((ds) => (
          <option key={ds.name} value={ds.name}>
            {ds.name}
          </option>
        ))}
      </Input>
    </FormGroup>
  );
};
