/**
 * Workspace mode preference (Seller vs Planner/Analyst), stored only in this browser.
 * Switching mode never touches imported data — both modes read the same analytics engine.
 */
export type WorkspaceMode = 'seller' | 'analyst';

export const WORKSPACE_MODE_KEY = 'ecompulse_workspace_mode';

export function getSavedWorkspaceMode(): WorkspaceMode | null {
  try {
    const v = localStorage.getItem(WORKSPACE_MODE_KEY);
    return v === 'seller' || v === 'analyst' ? v : null;
  } catch {
    return null;
  }
}

export function saveWorkspaceMode(mode: WorkspaceMode): void {
  try {
    localStorage.setItem(WORKSPACE_MODE_KEY, mode);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this session only.
  }
}
