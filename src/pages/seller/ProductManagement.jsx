import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/authState';
import { useProducts } from '../../context/productState';
import { api } from '../../services/api';
import StorePicker from '../../components/seller/StorePicker';
import { taka } from '../../utils/format';

const emptyDraft = {
  id: '',
  name: '',
  generic: '',
  description: '',
  categoryId: '',
  price: '',
  stock: '',
  lowStockThreshold: '10',
  image: '',
  requiresPrescription: false,
  isAvailable: true,
  sellerId: '',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-600';

export default function ProductManagement() {
  const { user } = useAuth();
  const { refreshProducts } = useProducts();
  const isAdmin = user.role === 'admin';
  const [sellerFilter, setSellerFilter] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const loadProducts = useCallback(async () => {
    try {
      const { products: list } = await api.seller.products(isAdmin ? { sellerId: sellerFilter } : {});
      setProducts(list);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, sellerFilter]);

  useEffect(() => {
    // Data fetching effect: state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    api.products.categories()
      .then(({ categories: list }) => setCategories(list))
      .catch((requestError) => setError(requestError.message));
  }, []);

  const afterChange = async () => {
    await loadProducts();
    await refreshProducts();
  };

  const openForm = (product) => {
    setFormError('');
    setDraft(product ? {
      ...emptyDraft,
      ...product,
      price: String(product.price),
      stock: String(product.stock),
      lowStockThreshold: String(product.lowStockThreshold),
      image: product.image || '',
    } : { ...emptyDraft, categoryId: categories[0]?.id || '', sellerId: sellerFilter });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const price = Number(draft.price);
    const stock = Number(draft.stock);
    const lowStockThreshold = Number(draft.lowStockThreshold || 0);
    if (!draft.name.trim() || !draft.categoryId) {
      setFormError('Enter a product name and choose a category.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0 || !Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      setFormError('Price must be above zero; stock and reorder level must be whole numbers of 0 or more.');
      return;
    }
    if (isAdmin && !draft.id && !draft.sellerId) {
      setFormError('Choose the pharmacy that sells this product.');
      return;
    }

    const body = {
      name: draft.name.trim(),
      generic: draft.generic.trim(),
      description: draft.description.trim(),
      categoryId: draft.categoryId,
      price,
      stock,
      lowStockThreshold,
      image: draft.image.trim(),
      requiresPrescription: draft.requiresPrescription,
      isAvailable: draft.isAvailable,
    };
    setSaving(true);
    try {
      if (draft.id) {
        await api.seller.updateProduct(draft.id, body);
      } else {
        await api.seller.createProduct(isAdmin ? { ...body, sellerId: draft.sellerId } : body);
      }
      setDraft(null);
      await afterChange();
    } catch (requestError) {
      setFormError(requestError.details?.[0]
        ? `${requestError.details[0].path}: ${requestError.details[0].message}`
        : requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (product) => {
    try {
      await api.seller.updateProduct(product.id, { isAvailable: !product.isAvailable });
      await afterChange();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const removeProduct = async (product) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    try {
      await api.seller.deleteProduct(product.id);
      await afterChange();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const term = query.trim().toLowerCase();
  const visibleProducts = term
    ? products.filter((product) => `${product.name} ${product.generic} ${product.category}`.toLowerCase().includes(term))
    : products;
  const lowStockCount = products.filter((product) => product.isAvailable && product.isLowStock).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Inventory</p>
          <h1 className="text-3xl font-bold text-slate-900">Product management</h1>
          <p className="mt-1 text-sm text-slate-500">
            {products.length} products{lowStockCount ? ` · ${lowStockCount} at or below reorder level` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && <StorePicker value={sellerFilter} onChange={setSellerFilter} />}
          <button
            type="button"
            onClick={() => openForm(null)}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" /> Add product
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {draft && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">{draft.id ? `Edit ${draft.name}` : 'Add a product'}</h2>
            <button type="button" onClick={() => setDraft(null)} aria-label="Close product form" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Product name
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Napa Extra" className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs font-semibold text-slate-600">Generic name
              <input value={draft.generic} onChange={(event) => setDraft({ ...draft, generic: event.target.value })} placeholder="Paracetamol 500mg" className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs font-semibold text-slate-600">Category
              <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })} className={`mt-1 ${inputClass}`}>
                <option value="" disabled>Choose a category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {isAdmin && !draft.id ? (
              <label className="text-xs font-semibold text-slate-600">Pharmacy
                <div className="mt-1"><StorePicker value={draft.sellerId} onChange={(sellerId) => setDraft({ ...draft, sellerId })} allowAll={false} /></div>
              </label>
            ) : (
              <label className="text-xs font-semibold text-slate-600">Image path (optional)
                <input value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} placeholder="/images/product.webp" className={`mt-1 ${inputClass}`} />
              </label>
            )}
            <label className="text-xs font-semibold text-slate-600">Price (৳)
              <input value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} type="number" min="0.01" step="0.01" className={`mt-1 ${inputClass}`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-600">Stock
                <input value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} type="number" min="0" step="1" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-xs font-semibold text-slate-600">Reorder level
                <input value={draft.lowStockThreshold} onChange={(event) => setDraft({ ...draft, lowStockThreshold: event.target.value })} type="number" min="0" step="1" className={`mt-1 ${inputClass}`} />
              </label>
            </div>
            {isAdmin && !draft.id && (
              <label className="text-xs font-semibold text-slate-600">Image path (optional)
                <input value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} placeholder="/images/product.webp" className={`mt-1 ${inputClass}`} />
              </label>
            )}
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">Description
              <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={2} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={draft.requiresPrescription} onChange={(event) => setDraft({ ...draft, requiresPrescription: event.target.checked })} />
              Prescription-only (customers must upload a prescription)
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={draft.isAvailable} onChange={(event) => setDraft({ ...draft, isAvailable: event.target.checked })} />
              Listed in the catalogue
            </label>
            <div className="flex justify-end gap-3 md:col-span-2">
              {formError && <p role="alert" className="mr-auto self-center text-sm text-rose-700">{formError}</p>}
              <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? 'Saving…' : 'Save product'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 p-3">
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="sr-only">Search products</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, generic or category" className="w-full bg-transparent outline-none" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-slate-400">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                {isAdmin && !sellerFilter && <th className="px-4 py-3">Pharmacy</th>}
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Sold</th>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {visibleProducts.map((product) => (
                <tr key={product.id} className={product.isAvailable ? '' : 'bg-slate-50/70'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={product.image} alt="" className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
                      <div>
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          {product.generic}
                          {product.requiresPrescription && <span className="ml-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Rx</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{product.category}</td>
                  {isAdmin && !sellerFilter && <td className="px-4 py-3">{product.sellerName}</td>}
                  <td className="px-4 py-3 font-semibold text-slate-900">{taka(product.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 ${product.isLowStock ? 'font-semibold text-amber-700' : ''}`}>
                      {product.isLowStock && <AlertTriangle className="h-3.5 w-3.5" />}
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">{product.unitsSold}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleAvailability(product)}
                      title={product.isAvailable ? 'Hide from the catalogue' : 'List in the catalogue'}
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        product.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {product.isAvailable ? 'Listed' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openForm(product)} aria-label={`Edit ${product.name}`} className="rounded-lg bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => removeProduct(product)} aria-label={`Delete ${product.name}`} className="rounded-lg bg-rose-50 p-2 text-rose-600 hover:bg-rose-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && visibleProducts.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">{products.length ? 'No products match your search.' : 'No products yet. Add your first product.'}</p>
          )}
          {loading && <p role="status" className="p-8 text-center text-sm text-slate-500">Loading inventory…</p>}
        </div>
      </div>
    </div>
  );
}
