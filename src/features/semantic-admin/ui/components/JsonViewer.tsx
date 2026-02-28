import React from "react";

type Props = {
  value: unknown;
};

export function JsonViewer({ value }: Props) {
  return <pre className="semantic-admin-json">{JSON.stringify(value, null, 2)}</pre>;
}

export default JsonViewer;

