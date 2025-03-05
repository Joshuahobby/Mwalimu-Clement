
import { useLocation } from 'wouter';

export function useQueryParams() {
  const [location] = useLocation();
  
  return {
    get: (param: string) => {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.get(param);
    },
    getAll: () => {
      return new URLSearchParams(window.location.search);
    }
  };
}
