import { queryOptions } from "@tanstack/react-query";
import { getWorkspaceData } from "../workspace.functions";

/** The whole shared workspace, loaded through the server. */
export const workspaceQuery = queryOptions({
  queryKey: ["workspace"],
  queryFn: () => getWorkspaceData(),
  // Saved data is reloaded after every change and on page refresh. No background
  // refetch, so a draft being typed is never overwritten mid-sentence.
  staleTime: Infinity,
  refetchOnWindowFocus: false,
});
