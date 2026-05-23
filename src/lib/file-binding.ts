export function basenameFromPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").split("/").pop() ?? filePath;
}

export interface FileBindingState {
  activeFilePath: string | null;
  activeFileName: string | null;
  recentFiles: string[];
}

/** Resolve path for Save overwrite; heals rehydrate desync (name without path). */
export function resolveActiveFilePath(store: FileBindingState): string | null {
  const direct = store.activeFilePath?.trim();
  if (direct) return direct;
  const name = store.activeFileName?.trim();
  if (!name) return null;
  const match = store.recentFiles.find((p) => basenameFromPath(p) === name);
  return match?.trim() || null;
}

/** Apply after persist rehydrate: drop orphan names or heal path from recents. */
export function normalizePersistedFileBinding(
  state: FileBindingState,
): Partial<FileBindingState> | null {
  const path = resolveActiveFilePath(state);
  if (state.activeFileName && !path) return { activeFileName: null };
  if (path && !state.activeFilePath?.trim()) return { activeFilePath: path };
  return null;
}
