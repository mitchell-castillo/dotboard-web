// Use the existing authenticated transport. Never return a cached workspace on failure.
export async function readFreshWorkspace(apiFetch) {
  const response = await apiFetch('/api/workspace', {method:'GET', cache:'no-store'});
  if (!response.ok) throw new Error(`Workspace GET failed (${response.status}).`);
  const data = await response.json();
  const workspace = data?.workspace;
  if (!workspace || !Number.isSafeInteger(workspace.revision) || workspace.revision < 0 || !Array.isArray(workspace.boards)) {
    throw new Error('Workspace GET returned an invalid response.');
  }
  return workspace;
}
