export async function getApiHealth(): Promise<{status:string}> {
  const response = await fetch("/api/health");
  if (!response.ok) throw new Error("Backend health check failed: " + response.status);
  return response.json() as Promise<{status:string}>;
}
