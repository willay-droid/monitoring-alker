'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Status = 'AVAILABLE' | 'IN_USE' | 'DAMAGED';
type EventType = 'CHECKOUT' | 'CHECKIN' | 'REPORT_DAMAGED' | 'MARK_FIXED';

type HistoryItem = {
  id?: string;
  event_type: EventType;
  nik: string;
  note?: string | null;
  event_time: string;
};

type ToolInfo = {
  name?: string | null;
  category?: string | null;
  qr_code?: string | null;
  status: Status;
};

function formatWIB(iso: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function ToolPage() {
  const router = useRouter();
  const params = useParams();

  const slug = useMemo(() => {
    const v = (params as any)?.slug;
    return Array.isArray(v) ? v[0] : v;
  }, [params]);

  const [loading, setLoading] = useState(true);

  // ✅ tool info dari DB (name/category/qr_code/status)
  const [toolInfo, setToolInfo] = useState<ToolInfo | null>(null);

  const [status, setStatus] = useState<Status>('AVAILABLE');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [note, setNote] = useState('');

  const [confirmDamage, setConfirmDamage] = useState(false);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<EventType>('CHECKOUT');
  const [nik, setNik] = useState('');

  async function fetchTool(toolSlug: string) {
    const res = await fetch(`/api/tools/${toolSlug}`);
    if (!res.ok) throw new Error('Gagal load tool');
    return res.json() as Promise<{
      tool: ToolInfo;
      history: HistoryItem[];
    }>;
  }

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    fetchTool(slug)
      .then(({ tool, history }) => {
        setToolInfo(tool); // ✅ simpan name/category/qr_code
        setStatus(tool.status);
        setHistory(history ?? []);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  // ambil event TERAKHIR (bukan yang pertama ketemu)
  const lastCheckout = [...(history ?? [])].reverse().find((h) => h.event_type === 'CHECKOUT');
  const lastCheckin = [...(history ?? [])].reverse().find((h) => h.event_type === 'CHECKIN');

  function openAction(action: EventType) {
    setModalAction(action);
    setNik('');

    // note cuma relevan untuk damage, jadi reset kalau bukan damage
    if (action !== 'REPORT_DAMAGED') setNote('');

    setModalOpen(true);
  }

  async function applyAction() {
    if (!slug) return;
    if (!nik.trim()) return;

    const payload = {
      action: modalAction,
      nik: nik.trim(),
      note: modalAction === 'REPORT_DAMAGED' ? note : undefined,
    };

    const res = await fetch(`/api/tools/${slug}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const ct = res.headers.get('content-type') || '';
      const detail = ct.includes('application/json')
        ? await res.json().catch(() => ({}))
        : await res.text().catch(() => '');

      console.error('ACTION_ERROR', res.status, detail);
      alert(
        typeof detail === 'string'
          ? detail || `Aksi gagal (${res.status})`
          : detail?.error || detail?.message || `Aksi gagal (${res.status})`
      );
      return;
    }

    // refresh data
    const { tool, history } = await fetchTool(slug);
    setToolInfo(tool);
    setStatus(tool.status);
    setHistory(history ?? []);

    setNote('');
    setConfirmDamage(false);
    setModalOpen(false);
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  const noteEnabled = modalAction === 'REPORT_DAMAGED';

  return (
    <main style={{ padding: 16, maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {/* ✅ Judul dinamis dari DB */}
          <h1 style={{ margin: 0 }}>{toolInfo?.name ?? 'Tool'}</h1>
          <div style={{ opacity: 0.7 }}>
            {(toolInfo?.qr_code ?? slug) + ' • ' + (toolInfo?.category ?? '-')}
          </div>
        </div>

        {/* tombol keluar kalau mau disembunyiin */}
        <button onClick={() => router.push('/')} style={{ display: 'none' }}>
          Keluar
        </button>
      </div>

      {/* Status */}
      <div style={{ marginTop: 16 }}>
        <strong>Status:</strong> {status}
      </div>

      {/* Last update */}
      <div style={{ marginTop: 12, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
        <div>
          <strong>Last update (WIB)</strong>
        </div>
        <div>Last CHECKOUT: {lastCheckout ? formatWIB(lastCheckout.event_time) : '-'}</div>
        <div>Last CHECKIN: {lastCheckin ? formatWIB(lastCheckin.event_time) : '-'}</div>
      </div>

      {/* Note (aktif cuma untuk Damage) */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={noteEnabled ? 'Catatan kerusakan' : 'Catatan hanya untuk Damage'}
        disabled={!noteEnabled}
        style={{
          width: '100%',
          minHeight: 90,
          marginTop: 12,
          opacity: noteEnabled ? 1 : 0.6,
        }}
      />

      {/* Actions */}
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <button disabled={status !== 'AVAILABLE'} onClick={() => openAction('CHECKOUT')}>
          Checkout
        </button>

        <button disabled={status !== 'IN_USE'} onClick={() => openAction('CHECKIN')}>
          Checkin
        </button>

        <label>
          <input
            type="checkbox"
            checked={confirmDamage}
            onChange={(e) => setConfirmDamage(e.target.checked)}
          />{' '}
          Konfirmasi sebelum Damage
        </label>

        <button
          disabled={!confirmDamage}
          onClick={() => openAction('REPORT_DAMAGED')}
          style={{ background: '#7f1d1d', color: '#fff' }}
        >
          Damage
        </button>

        <button disabled={status !== 'DAMAGED'} onClick={() => openAction('MARK_FIXED')}>
          Mark Fixed
        </button>
      </div>

      {/* History */}
      <div style={{ marginTop: 20 }}>
        <h3>Riwayat terakhir</h3>
        <table width="100%">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Event</th>
              <th>NIK</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, idx) => (
              <tr key={h.id ?? `${h.event_time}-${h.event_type}-${h.nik}-${idx}`}>
                <td>{formatWIB(h.event_time)}</td>
                <td>{h.event_type}</td>
                <td>{h.nik}</td>
                <td>{h.note ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'grid',
            placeItems: 'center',
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{ background: '#fff', padding: 16, borderRadius: 8, width: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <strong>{modalAction}</strong>

            <input
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              placeholder="NIK teknisi"
              style={{ width: '100%', marginTop: 12 }}
            />

            {modalAction === 'REPORT_DAMAGED' && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan kerusakan"
                style={{ width: '100%', marginTop: 12, minHeight: 80 }}
              />
            )}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModalOpen(false)}>Batal</button>
              <button disabled={!nik.trim()} onClick={applyAction}>
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
