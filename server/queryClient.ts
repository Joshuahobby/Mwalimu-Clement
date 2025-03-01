// Simple in-memory query cache for server-side caching
const cache = new Map<string, any>();

export const queryClient = {
  invalidateQueries: ({ queryKey }: { queryKey: string[] }) => {
    const key = queryKey.join('/');
    cache.delete(key);
  },
  
  setQueryData: (queryKey: string[], data: any) => {
    const key = queryKey.join('/');
    cache.set(key, data);
  },
  
  getQueryData: (queryKey: string[]) => {
    const key = queryKey.join('/');
    return cache.get(key);
  }
};
