import { useState, useCallback } from 'react';

export function useAsync<T, E = Error>(
  asyncFn: (...args: unknown[]) => Promise<T>,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (...args: unknown[]) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await asyncFn(...args);
        setData(result);
        return result;
      } catch (err) {
        setError(err as E);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [asyncFn],
  );

  return { data, error, isLoading, execute, setData };
}
