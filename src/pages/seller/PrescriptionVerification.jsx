import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Eye, FileText, ShieldAlert, X, XCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { useAuth } from '../../context/authState';
import { api } from '../../services/api';
import { shortDate } from '../../utils/format';

const tabs = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: '', label: 'All' },
];

const statusStyles = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
};

function PrescriptionViewer({ review, onClose }) {
  const [zoom, setZoom] = useState(1);
  const { prescription } = review;
  const isPdf = prescription.fileType === 'application/pdf';

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4" role="dialog" aria-modal="true" aria-label={`Prescription for order ${review.orderId}`}>
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900">{prescription.fileName}</p>
            <p className="text-xs text-slate-500">{review.orderId} · {review.customer} · {prescription.id}</p>
          </div>
          <div className="flex items-center gap-1">
            {!isPdf && (
              <>
                <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} disabled={zoom <= 1} aria-label="Zoom out" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"><ZoomOut className="h-4 w-4" /></button>
                <span className="w-12 text-center text-xs font-semibold text-slate-600">{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom((value) => Math.min(4, value + 0.5))} disabled={zoom >= 4} aria-label="Zoom in" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"><ZoomIn className="h-4 w-4" /></button>
              </>
            )}
            <a href={prescription.fileUrl} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:underline">Open in new tab</a>
            <button type="button" onClick={onClose} aria-label="Close viewer" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100">
          {isPdf ? (
            <iframe src={prescription.fileUrl} title="Prescription PDF" className="h-[75vh] w-full" />
          ) : (
            <img
              src={prescription.fileUrl}
              alt={`Prescription uploaded by ${review.customer}`}
              onClick={() => setZoom((value) => (value >= 4 ? 1 : value + 1))}
              style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? '100%' : 'none' }}
              className={`mx-auto block ${zoom >= 4 ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PrescriptionVerification() {
  const { user } = useAuth();
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState({ counts: { pending: 0, approved: 0, rejected: 0 }, reviews: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.prescriptions.reviews({ status }));
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // Data fetching effect: state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const decide = async (review, decision) => {
    if (decision === 'rejected' && reason.trim().length < 3) {
      setError('Tell the customer why the prescription was rejected.');
      return;
    }
    setBusyId(review.orderId);
    try {
      await api.prescriptions.review(review.orderId, decision === 'rejected' ? { decision, reason: reason.trim() } : { decision });
      setRejecting(null);
      setReason('');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Verification queue</p>
        <h1 className="text-3xl font-bold text-slate-900">Prescription review</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Orders with prescription-only medicine stay unconfirmed until you approve the prescription.
          Check the patient name, prescriber, date and that every Rx item below is prescribed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['pending', 'Awaiting review'],
          ['approved', 'Approved'],
          ['rejected', 'Rejected'],
        ].map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{data.counts[key]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter prescriptions">
        {tabs.map((tab) => (
          <button
            key={tab.id || 'all'}
            type="button"
            role="tab"
            aria-selected={status === tab.id}
            onClick={() => { setStatus(tab.id); setRejecting(null); }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${status === tab.id ? 'bg-teal-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {loading && <p role="status" className="rounded-2xl bg-white p-8 text-center text-sm text-slate-600">Loading prescriptions…</p>}
      {!loading && data.reviews.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-semibold text-slate-900">Nothing here</p>
          <p className="mt-1 text-sm text-slate-500">Prescriptions customers send with their orders will appear in this queue.</p>
        </div>
      )}

      <div className="space-y-4">
        {data.reviews.map((review) => (
          <article key={review.orderId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-900">{review.customer}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{review.orderId}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[review.status]}`}>{review.statusLabel}</span>
                </div>
                <p className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1"><FileText className="h-4 w-4" /> {review.prescription.fileName}</span>
                  <span>Sent {shortDate(review.submittedAt)}</span>
                  <span>Order {review.orderStatus.toLowerCase()}</span>
                  {user.role === 'admin' && <span>{review.sellerName}</span>}
                </p>
                <p className="text-sm text-slate-700">
                  Rx items: {review.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}
                </p>
              </div>
              <button type="button" onClick={() => setViewing(review)} className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Eye className="h-4 w-4" /> View prescription
              </button>
            </div>

            {review.canReview && rejecting !== review.orderId && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" disabled={busyId === review.orderId} onClick={() => decide(review, 'approved')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button type="button" onClick={() => { setRejecting(review.orderId); setReason(''); }} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            )}

            {rejecting === review.orderId && (
              <form onSubmit={(event) => { event.preventDefault(); decide(review, 'rejected'); }} className="mt-4 rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                <label htmlFor={`rx-reason-${review.orderId}`} className="text-xs font-semibold text-rose-900">Reason the customer will see</label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <input
                    id={`rx-reason-${review.orderId}`}
                    autoFocus
                    value={reason}
                    maxLength={500}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="e.g. Prescription is older than 6 months"
                    className="flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setRejecting(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
                    <button type="submit" disabled={busyId === review.orderId} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Reject prescription</button>
                  </div>
                </div>
              </form>
            )}

            {review.status !== 'pending' && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>
                  {review.statusLabel} {review.reviewedBy ? `by ${review.reviewedBy}` : ''} {review.reviewedAt ? `on ${shortDate(review.reviewedAt)}` : ''}.
                  {review.rejectionReason && ` Reason: ${review.rejectionReason}`}
                  {review.status === 'rejected' && review.orderStatus === 'Placed' && ' The customer can send a new prescription, or you can reject the order from Order management.'}
                </span>
              </div>
            )}
            {review.status === 'pending' && !review.canReview && (
              <p className="mt-4 text-sm text-slate-500">This order is no longer awaiting confirmation, so the prescription cannot be reviewed.</p>
            )}
          </article>
        ))}
      </div>

      <p className="text-xs text-slate-500">This is a manual check by pharmacy staff. The platform only verifies that the upload is a JPEG, PNG or PDF file; it does not validate prescriptions medically.</p>

      {viewing && <PrescriptionViewer review={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
