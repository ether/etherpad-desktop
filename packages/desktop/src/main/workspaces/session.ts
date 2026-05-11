export type SessionApi = {
  fromPartition(partition: string): { clearStorageData(): Promise<void> };
};

export function partitionFor(workspaceId: string): string {
  return `persist:ws-${workspaceId}`;
}

export async function clearWorkspaceStorage(
  sessionApi: SessionApi,
  workspaceId: string,
): Promise<void> {
  await sessionApi.fromPartition(partitionFor(workspaceId)).clearStorageData();
}
