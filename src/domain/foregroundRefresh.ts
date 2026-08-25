export type AppVisibility = "active" | "background" | "inactive" | "unknown";

export function shouldRefreshOnAppResume(input: {
  enabled: boolean;
  previousState: AppVisibility;
  nextState: AppVisibility;
  hasSession: boolean;
  isSyncing: boolean;
}) {
  const returnedToForeground = (input.previousState === "background" || input.previousState === "inactive") && input.nextState === "active";
  return input.enabled && returnedToForeground && input.hasSession && !input.isSyncing;
}
