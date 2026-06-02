export const swrFetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const error = new Error(`Request failed: ${res.status}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return (await res.json()) as T;
};
