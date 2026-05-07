import type { RecentItem, TreeNode, TreeResponse } from "@/shared/domain-state/savedQueries";

export type FlowForgeSavedQueryOption = {
  id: string;
  name: string;
  location: "Mine" | "Shared" | "Library" | "Recent" | "Existing";
  updatedAt?: string | null;
  queryType?: string;
};

type HydratedQueryTree = {
  trees?: {
    library?: TreeResponse;
    shared?: TreeResponse;
    my?: TreeResponse;
    trash?: TreeResponse;
  };
  recent?: RecentItem[];
};

function addOption(
  options: Map<string, FlowForgeSavedQueryOption>,
  option: FlowForgeSavedQueryOption,
): void {
  if (!option.id || options.has(option.id)) return;
  options.set(option.id, option);
}

function collectTreeQueries(
  nodes: TreeNode[],
  location: FlowForgeSavedQueryOption["location"],
  options: Map<string, FlowForgeSavedQueryOption>,
): void {
  nodes.forEach((node) => {
    if (node.nodeType === "folder") {
      collectTreeQueries(node.children ?? [], location, options);
      return;
    }
    addOption(options, {
      id: node.id,
      name: node.name,
      location,
      updatedAt: node.updatedAt ?? null,
      queryType: node.queryType,
    });
  });
}

export function savedQueryOptionsFromTreeData(data?: HydratedQueryTree): FlowForgeSavedQueryOption[] {
  const options = new Map<string, FlowForgeSavedQueryOption>();
  collectTreeQueries(data?.trees?.my?.rootNodes ?? [], "Mine", options);
  collectTreeQueries(data?.trees?.shared?.rootNodes ?? [], "Shared", options);
  collectTreeQueries(data?.trees?.library?.rootNodes ?? [], "Library", options);
  (data?.recent ?? []).forEach((query) =>
    addOption(options, {
      id: query.id,
      name: query.title,
      location: "Recent",
      updatedAt: query.updatedAt ?? null,
      queryType: query.queryType,
    }),
  );
  return [...options.values()].sort((left, right) => left.name.localeCompare(right.name));
}
