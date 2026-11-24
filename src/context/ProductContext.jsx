import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProductContext } from './productState';
import { api } from '../services/api';

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.products.list({ limit: 100 })
      .then(({ products: catalogue }) => {
        if (active) setProducts(catalogue);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Sellers change inventory through the API; reload the public catalogue afterwards.
  const refreshProducts = useCallback(async () => {
    try {
      const { products: catalogue } = await api.products.list({ limit: 100 });
      setProducts(catalogue);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  const value = useMemo(() => ({
    products,
    loading,
    error,
    refreshProducts,
  }), [products, loading, error, refreshProducts]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}
