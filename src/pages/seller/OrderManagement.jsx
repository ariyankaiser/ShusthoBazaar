import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CheckCircle2, Clock3, FileCheck, PackageCheck } from 'lucide-react';
import { useAuth } from '../../context/authState';
import { api } from '../../services/api';
import { shortDate, taka } from '../../utils/format';

const nextOrderStatus = {
  Placed: { status: 'confirmed', label: 'Confirm', icon: CheckCircle2 },
  Confirmed: { status: 'out_for_delivery', label: 'Dispatch', icon: Clock3 },
  'Out for Delivery': { status: 'delivered', label: 'Mark delivered', icon: PackageCheck },
};

const filters = [
  { id: 'new', label: 'New', match: (order) => order.status === 'Placed' },
  { id: 'active', label: 'In progress', match: (order) => order.status === 'Confirmed' || order.status === 'Out for Delivery' },
  { id: 'done', label: 'Delivered', match: (order) => order.status === 'Delivered' },
  { id: 'rejected', label: 'Rejected', match: (order) => order.status === 'Rejected' || order.status === 'Cancelled' },
  { id: 'all', label: 'All', match: () => true },
];

const rxStyles = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
};

function prescriptionBlocker(order) {
  if (order.status !== 'Placed' || !order.requiresPrescription) return '';
  if (!order.prescription) return 'No prescription was attached. Reject this order.';
  if (order.prescription.status === 'pending') return 'Verify the prescription before confirming.';
  if (order.prescription.status === 'rejected') return 'Prescription rejected. Waiting for the customer to send a new one.';
  return '';
}

export default function OrderManagement() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('new');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    api.orders.list()
      .then(({ orders: savedOrders }) => setOrders(savedOrders))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const replaceOrder = (updatedOrder) => {
    setOrders((current) => current.map((entry) => entry.id === updatedOrder.id ? updatedOrder : entry));
  };

  const advance = async (order) => {
    const transition = nextOrderStatus[order.status];
    if (!transition) return;
    setBusyId(order.id);
    try {
      const { order: updatedOrder } = await api.orders.updateStatus(order.id, transition.status);
      replaceOrder(updatedOrder);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  const reject = async (event) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setError('Write a short reason the customer will see.');
      return;
    }
    setBusyId(rejecting);
    try {
      const { order: updatedOrder } = await api.orders.reject(rejecting, reason.trim());
      replaceOrder(updatedOrder);
      setRejecting(null);
      setReason('');
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  const activeFilter = filters.find((entry) => entry.id === filter);
  const visibleOrders = orders.filter(activeFilter.match);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Orders</p>
        <h1 className="text-3xl font-bold text-slate-900">Order management</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user.role === 'admin'
            ? 'Every pharmacy’s orders. A multi-pharmacy cart becomes one order per pharmacy.'
            : 'Orders for products sold by your pharmacy. Other pharmacies in the same cart handle their own items.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter orders">
        {filters.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={filter === entry.id}
            onClick={() => setFilter(entry.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${filter === entry.id ? 'bg-teal-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {entry.label} ({orders.filter(entry.match).length})
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {loading && <p role="status" className="rounded-2xl bg-white p-8 text-center text-sm text-slate-600">Loading orders…</p>}
      {!loading && visibleOrders.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-semibold text-slate-900">No {activeFilter.label.toLowerCase()} orders</p>
          <p className="mt-1 text-sm text-slate-500">Orders that contain your products will appear here.</p>
        </div>
      )}

      <div className="space-y-4">
        {visibleOrders.map((order) => {
          const transition = nextOrderStatus[order.status];
          const Icon = transition?.icon;
          const blocker = prescriptionBlocker(order);
          const canReject = order.status === 'Placed' || order.status === 'Confirmed';
          return (
            <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900">{order.id}</h2>
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-800">{order.status}</span>
                    {order.prescription && (
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${rxStyles[order.prescription.status]}`}>
                        Rx {order.prescription.statusLabel.toLowerCase()}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {shortDate(order.createdAt)} · {order.customer}
                    {user.role === 'admin' && ` · ${order.sellerName}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{[order.address?.street, order.address?.city].filter(Boolean).join(', ')} · {order.address?.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">{taka(order.total)}</p>
                  <p className="text-xs text-slate-500">{order.paymentMethod} · {order.paymentStatus}</p>
                </div>
              </div>

              <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>
                      {item.name} <span className="text-slate-500">× {item.quantity}</span>
                      {item.requiresPrescription && <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Rx</span>}
                    </span>
                    <span className="font-semibold text-slate-900">{taka(item.quantity * item.price)}</span>
                  </li>
                ))}
              </ul>

              {order.status === 'Rejected' && order.rejectionReason && (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Rejected: {order.rejectionReason}</p>
              )}

              {(transition || canReject) && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {transition && (
                    <button
                      type="button"
                      disabled={Boolean(blocker) || busyId === order.id}
                      onClick={() => advance(order)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon className="h-3.5 w-3.5" /> {transition.label}
                    </button>
                  )}
                  {canReject && rejecting !== order.id && (
                    <button
                      type="button"
                      onClick={() => { setRejecting(order.id); setReason(''); }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      <Ban className="h-3.5 w-3.5" /> Reject order
                    </button>
                  )}
                  {blocker && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-800">
                      <FileCheck className="h-3.5 w-3.5" /> {blocker}
                      {order.prescription?.status === 'pending' && (
                        <Link to="/seller/prescriptions" className="font-semibold underline">Review now</Link>
                      )}
                    </span>
                  )}
                </div>
              )}

              {rejecting === order.id && (
                <form onSubmit={reject} className="mt-3 flex flex-col gap-2 rounded-xl border border-rose-100 bg-rose-50/60 p-3 sm:flex-row">
                  <label className="sr-only" htmlFor={`reason-${order.id}`}>Rejection reason</label>
                  <input
                    id={`reason-${order.id}`}
                    autoFocus
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    placeholder="Reason shown to the customer, e.g. out of stock"
                    className="flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setRejecting(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
                    <button type="submit" disabled={busyId === order.id} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Reject and restock</button>
                  </div>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
