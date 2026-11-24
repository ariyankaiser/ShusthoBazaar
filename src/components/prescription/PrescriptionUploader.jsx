import { useEffect, useRef, useState } from 'react';
import { FileText, ImageIcon, UploadCloud, X } from 'lucide-react';
import { api } from '../../services/api';

const MAX_PRESCRIPTION_BYTES = 5 * 1024 * 1024;
const ACCEPTED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
};
const ACCEPT_ATTRIBUTE = Object.entries(ACCEPTED).flatMap(([type, extensions]) => [type, ...extensions]).join(',');

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Quick checks so the customer gets instant feedback. The server re-validates
// the file by its content, so these checks are a convenience, not a control.
function validatePrescriptionFile(file) {
  if (!file) return 'Choose a file to upload.';
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  const typeAllowed = ACCEPTED[file.type] || Object.values(ACCEPTED).some((list) => list.includes(extension));
  if (!typeAllowed) return 'Only JPEG, PNG or PDF files are accepted.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_PRESCRIPTION_BYTES) return `This file is ${formatSize(file.size)}. The limit is 5 MB.`;
  return '';
}

export default function PrescriptionUploader({ onUploaded, compact = false }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const choose = (nextFile) => {
    const problem = validatePrescriptionFile(nextFile);
    setError(problem);
    if (problem) return;
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const clear = () => {
    setFile(null);
    setPreviewUrl('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const { prescription } = await api.prescriptions.upload(file);
      clear();
      onUploaded(prescription);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploading(false);
    }
  };

  const isPdf = file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

  return (
    <div>
      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length > 1) {
              setError('Upload one file at a time.');
              return;
            }
            choose(event.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition ${compact ? 'p-5' : 'p-8'} ${dragging ? 'border-teal-500 bg-teal-50' : 'border-slate-300 bg-slate-50 hover:border-teal-400'}`}
        >
          <UploadCloud className="h-8 w-8 text-teal-700" />
          <p className="mt-2 text-sm font-semibold text-slate-900">Drag your prescription here, or click to browse</p>
          <p className="mt-1 text-xs text-slate-500">JPEG, PNG or PDF · up to 5 MB · the doctor’s name, date and medicines must be readable</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
              {isPdf ? <FileText className="h-4 w-4 shrink-0 text-teal-700" /> : <ImageIcon className="h-4 w-4 shrink-0 text-teal-700" />}
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 font-normal text-slate-500">{formatSize(file.size)}</span>
            </p>
            <button type="button" onClick={clear} aria-label="Remove selected file" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
            {isPdf ? (
              <object data={previewUrl} type="application/pdf" className="h-72 w-full" aria-label="PDF preview">
                <p className="p-4 text-sm text-slate-500">PDF preview is not available in this browser.</p>
              </object>
            ) : (
              <img src={previewUrl} alt="Selected prescription preview" className="mx-auto max-h-72 object-contain" />
            )}
          </div>
          <button type="button" disabled={uploading} onClick={upload} className="mt-3 w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
            {uploading ? 'Uploading…' : 'Upload prescription'}
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => choose(event.target.files?.[0])}
      />
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
