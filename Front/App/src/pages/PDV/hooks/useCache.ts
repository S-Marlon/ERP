// useCache.ts - Hook para caching de dados
import { useState, useEffect, useRef } from 'react';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export function useCache<T>(
    fetchFn: () => Promise<T>,
    key: string,
    ttl: number = 5 * 60 * 1000 // 5 minutos por padrão
): {
    data: T | null;
    loading: boolean;
    error: Error | null;
} {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());

    useEffect(() => {
        const cached = cacheRef.current.get(key);
        const now = Date.now();

        // Se está em cache e não expirou, usar
        if (cached && now - cached.timestamp < ttl) {
            setData(cached.data);
            setLoading(false);
            return;
        }

        // Caso contrário, fetchar
        (async () => {
            try {
                setLoading(true);
                const result = await fetchFn();
                
                // Armazenar em cache
                cacheRef.current.set(key, {
                    data: result,
                    timestamp: now
                });

                setData(result);
                setError(null);
            } catch (err) {
                setError(err as Error);
                setData(null);
            } finally {
                setLoading(false);
            }
        })();
    }, [key, fetchFn, ttl]);

    return { data, loading, error };
}

// Utility para limpar cache globalmente
export const clearAllCaches = () => {
    if (typeof window !== 'undefined') {
        sessionStorage.clear();
    }
};
