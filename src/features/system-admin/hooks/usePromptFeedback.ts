import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  deletePromptFeedback,
  listPromptFeedback,
} from "../api";
import type {
  PromptFeedbackListParams,
  PromptFeedbackListResponse,
} from "../types";

const QUERY_KEY = ["admin", "prompt-feedback"] as const;

export function usePromptFeedbackList(params: PromptFeedbackListParams) {
  return useQuery<PromptFeedbackListResponse>({
    queryKey: [...QUERY_KEY, params],
    queryFn: () => listPromptFeedback(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useDeletePromptFeedback() {
  const queryClient = useQueryClient();
  return useMutation<{ deleted: boolean }, Error, number>({
    mutationFn: deletePromptFeedback,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
