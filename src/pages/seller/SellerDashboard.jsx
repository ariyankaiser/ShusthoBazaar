import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, FileCheck, PackageCheck, ShoppingCart, Wallet } from 'lucide-react';
import { useAuth } from '../../context/authState';
import { api } from '../../services/api';
import StorePicker from '../../components/seller/StorePicker';
import { shortDate, taka } from '../../utils/format';

const statusStyles = {
  Placed: 'bg-amber-100 text-amber-800',
  Confirmed: 'bg-sky-100 text-sky-800',
  'Out for Delivery': 'bg-indigo-100 text-indigo-800',
  Delivered: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-rose-100 text-rose-800',
  Cancelled: 'bg-slate-200 text-slate-700',
};

function monthLabel(month) {
  const [year, index] = month.split('-').map(Number);
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [sellerId, setSellerId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.seller.dashboard(isAdmin ? { sellerId } : {})
      .then((dashboard) => { if (active) { setData(dashboard); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [isAdmin, sellerId]);

  const metrics = data?.metrics;
  const cards = metrics ? [
    { label: 'Earnings (paid)', value: taka(metrics.earnings), detail: `${taka(metrics.pendingEarnings)} awaiting payment`, icon: Wallet },
    { label: 'Total orders', value: metrics.totalOrders, detail: `${metrics.deliveredOrders} delivered · ${metrics.rejectedOrders} rejected`, icon: ShoppingCart },
    { label: 'Open orders', value: metrics.openOrders, detail: `${metrics.newOrders} new · ${metrics.awaitingPrescription} awaiting Rx check`, icon: PackageCheck },
    { label: 'Low stock', value: metrics.lowStockProducts, detail: `${metrics.activeProducts} of ${metrics.totalProducts} products listed`, icon: Boxes },
  ] : [];
  const peak = Math.max(1, ...(data?.monthlySales || []).map((entry) => entry.sales));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Overview</p>
          <h1 className="text-3xl font-bold text-slate-900">Seller dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin ? (sellerId ? 'Viewing one pharmacy.' : 'Marketplace totals across every pharmacy.') : user.storeName}
          </p>
        </div>
        {isAdmin && <StorePicker value={sellerId} onChange={setSellerId} />}
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!data && !error && <p role="status" className="rounded-2xl bg-white p-8 text-center text-sm text-slate-600">Loading dashboard…</p>}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, detail, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{label}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-5 text-3xl font-bold text-slate-900">{value}</p>
                <p className="mt-2 text-xs text-slate-500">{detail}</p>
              </div>
            ))}
          </div>

          {metrics.awaitingPrescription > 0 && (
            <Link to="/seller/prescriptions" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 hover:border-amber-300">
              <FileCheck className="h-5 w-5 shrink-0" />
              <span><strong>{metrics.awaitingPrescription}</strong> order{metrics.awaitingPrescription === 1 ? '' : 's'} cannot be confirmed until the prescription is verified. Open the queue →</span>
            </Link>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <p className="text-sm text-slate-500">Sales overview</p>
              <h2 className="text-xl font-bold text-slate-900">Last 6 months</h2>
              <p className="mt-1 text-xs text-slate-500">Order value excluding rejected and cancelled orders.</p>
              <div className="mt-6 flex h-44 items-end gap-3">
                {data.monthlySales.map((entry) => (
                  <div key={entry.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${entry.orders} orders · ${taka(entry.sales)}`}>
                    <span className="text-[10px] font-semibold text-slate-500">{entry.sales ? taka(entry.sales) : ''}</span>
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-teal-700 to-teal-400"
                      style={{ height: `${Math.max((entry.sales / peak) * 100, entry.sales ? 4 : 1)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {data.monthlySales.map((entry) => <span key={entry.month} className="flex-1">{monthLabel(entry.month)}</span>)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <p className="text-sm text-slate-500">Inventory</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Low stock alerts</h2>
              <div className="mt-5 space-y-3">
                {data.lowStock.length === 0 && <p className="text-sm text-slate-500">Every listed product is above its reorder level.</p>}
                {data.lowStock.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-800">{item.name}</span>
                      <span className={item.stock === 0 ? 'font-semibold text-rose-700' : 'text-slate-500'}>{item.stock} left</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Reorder level {item.lowStockThreshold}{isAdmin && !sellerId ? ` · ${item.sellerName}` : ''}</p>
                  </div>
                ))}
              </div>
              <Link to="/seller/products" className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:underline">Manage inventory</Link>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Recent orders</p>
                  <h2 className="text-xl font-bold text-slate-900">Incoming activity</h2>
                </div>
                <Link to="/seller/orders" className="text-sm font-semibold text-teal-700 hover:underline">View all</Link>
              </div>
              <div className="mt-5 overflow-x-auto">
                {data.recentOrders.length === 0 ? (
                  <p className="text-sm text-slate-500">No orders yet.</p>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        <th className="pb-3 pr-4">Order</th>
                        <th className="pb-3 pr-4">Customer</th>
                        <th className="pb-3 pr-4">Placed</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 pr-4">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {data.recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="py-3 pr-4 font-semibold text-slate-900">{order.id}</td>
                          <td className="py-3 pr-4">{order.customer}</td>
                          <td className="py-3 pr-4">{shortDate(order.createdAt)}</td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyles[order.status] || 'bg-slate-100 text-slate-700'}`}>
                              {order.prescription?.status === 'pending' && order.status === 'Placed' ? 'Awaiting Rx' : order.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 font-semibold text-slate-900">{taka(order.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <p className="text-sm text-slate-500">Best sellers</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Top products</h2>
              <ol className="mt-5 space-y-3">
                {data.topProducts.length === 0 && <li className="text-sm text-slate-500">No sales yet.</li>}
                {data.topProducts.map((product, index) => (
                  <li key={product.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">{index + 1}</span>
                      <span className="font-semibold text-slate-800">{product.name}</span>
                    </span>
                    <span className="text-slate-500">{product.units} sold · {taka(product.revenue)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
