import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { api } from '../../services/api';

// Admins can look at one pharmacy or the whole marketplace. Sellers never see this.
export default function StorePicker({ value, onChange, allowAll = true, label = 'Pharmacy' }) {
  const [stores, setStores] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.seller.stores()
      .then(({ sellers }) => { if (active) setStores(sellers); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, []);

  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-xs">
      <Store className="h-4 w-4 text-teal-700" />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent font-semibold outline-none"
      >
        {allowAll && <option value="">All pharmacies</option>}
        {stores.map((store) => (
          <option key={store.id} value={store.id}>{store.storeName}</option>
        ))}
      </select>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </label>
  );
}
