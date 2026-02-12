'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type Status = 'AVAILABLE' | 'IN_USE' | 'DAMAGED';
type Action = 'CHECKOUT' | 'CHECKIN' | 'REPORT_DAMAGED' | 'MARK_FIXED';

type Tool = {
  id: number;
  qr_code: string;
  name: string;
  category: string | null;
  status: Status;
  current_holder_nik?: string | null;
  last_event_at?: string | null;
};

type ToolEvent = {
  id: number;
  event_type: string;
  nik: string | null;
  note: string | null;
  condition: string | null;
  event_time: string;
};

function fmtWIB(iso: string | null | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

export default function ToolClient({ slug }: { slug: string }) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [history, setHistory] = useState<ToolEvent[]>([]);
  const [note, setNote] = useState('');
  const [confirmDamage, setConfirmDamage] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<Action>('CHECKOUT');
  const [nik, setNik] = useState('');

  const status: Status = tool?.status ?? 'AVAILABLE';

  const lastCheckout = useMemo(() => {
    const e = history.find((x) => x.event_type === 'CHECKOUT');
    return e?.event_time ?? null;
  }, [history]);

  const lastCheckin = useMemo(() => {
    const e = history.find((x) => x.event_type === 'CHECKIN');
    return e?.event_time ?? null;
  }, [history]);

  async function fetchTool() {
    const res = await fetch(`/api/tools/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Fetch tool failed: ${res.status}`);

    const json = await res.json();
    setTool(json.tool);
    setHistory(json.history ?? []);
  }

  async function doAction(action: Action, nikValue: string) {
    const res = await fetch(`/api/tools/${encodeURIComponent(slug)}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        nik: nikValue,
        note: note?.trim() ? note.trim() : undefined,
      }),
    });

    if (!res.ok) {
      let msg = 'Aksi gagal';
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {}
      throw new Error(msg);
    }
  }

  function openAction(action: Action) {
    setModalAction(action);
    setNik('');
    setModalOpen(true);
  }

  async function confirmAction() {
    try {
      if (!nik.trim()) {
        alert('NIK wajib diisi');
        return;
      }
      await doAction(modalAction, nik.trim());
      setModalOpen(false);
      setConfirmDamage(false);
      // biar langsung kebaca tanpa nunggu realtime
      await fetchTool();
    } catch (e: any) {
      alert(e?.message ?? 'Aksi gagal');
    }
  }

  // initial fetch
  useEffect(() => {
    fetchTool().catch(() => {
      // silent
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // realtime
  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`tool-${slug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tools', filter: `qr_code=eq.${slug}` },
        () => {
          fetchTool().catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tool_events' },
        () => {
          // simple: refetch (aman)
          fetchTool().catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <main style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0 }}>{tool?.name ?? 'Loading...'}</h2>
          <p style={{ margin: '4px 0 0', opacity: 0.75 }}>
            {slug} • {tool?.category ?? '-'}
          </p>
        </div>
        <button onClick={() => (window.location.href = '/')} style={{ height: 32 }}>
          Keluar
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <strong>Status:</strong>{' '}
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 999,
            border: '1px solid #ddd',
            marginLeft: 6,
          }}
        >
          {status}
        </span>
      </div>

      <div style={{ marginTop: 12, padding: 12, border: '1px solid #eee', borderRadius: 10 }}>
        <strong>Last update (WIB)</strong>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span>Last CHECKOUT</span>
          <span>{fmtWIB(lastCheckout)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span>Last CHECKIN</span>
          <span>{fmtWIB(lastCheckin)}</span>
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (optional) — misal: dipakai ODP / kabel putus / dll"
        style={{ width: '100%', marginTop: 12, minHeight: 90 }}
      />

      <button
        disabled={status !== 'AVAILABLE'}
        onClick={() => openAction('CHECKOUT')}
        style={{ width: '100%', marginTop: 10, height: 40 }}
      >
        Checkout
      </button>

      <button
        disabled={status !== 'IN_USE'}
        onClick={() => openAction('CHECKIN')}
        style={{ width: '100%', marginTop: 8, height: 40, opacity: status !== 'IN_USE' ? 0.6 : 1 }}
      >
        Checkin
      </button>

      <div style={{ marginTop: 14, padding: 12, border: '1px solid #eee', borderRadius: 10 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={confirmDamage}
            onChange={(e) => setConfirmDamage(e.target.checked)}
          />
          <div>
            <div style={{ fontWeight: 600 }}>Konfirmasi sebelum Damage</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Centang ini kalau yakin alat rusak. Tombol Damage baru aktif setelah dicentang.
            </div>
          </div>
        </label>
      </div>

      <button
        disabled={!confirmDamage}
        onClick={() => openAction('REPORT_DAMAGED')}
        style={{
          width: '100%',
          marginTop: 10,
          height: 40,
          background: '#7f1d1d',
          color: '#fff',
          border: '1px solid #7f1d1d',
          opacity: confirmDamage ? 1 : 0.5,
        }}
      >
        Damage
      </button>

{/* MARK FIXED */}
{String(tool?.status).trim().toUpperCase() === 'DAMAGED' && (
  <button
    onClick={() => openAction('MARK_FIXED')}
    style={{
      width: '100%',
      marginTop: 8,
      height: 40,
      background: '#0f766e',
      color: '#fff',
      border: '1px solid #0f766e',
    }}
  >
    Mark Fixed
  </button>
)}


      <hr style={{ margin: '24px 0' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0 }}>Riwayat terakhir</h4>
        <button onClick={() => fetchTool().catch(() => {})}>Refresh</button>
      </div>

      <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
            <th style={{ padding: '8px 0' }}>Waktu (WIB)</th>
            <th style={{ padding: '8px 0' }}>Event</th>
            <th style={{ padding: '8px 0' }}>NIK</th>
            <th style={{ padding: '8px 0' }}>Note</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 12, opacity: 0.7 }}>
                Belum ada riwayat
              </td>
            </tr>
          ) : (
            history.map((h) => (
              <tr key={h.id} style={{ borderBottom: '1px solid #f2f2f2' }}>
                <td style={{ padding: '10px 0' }}>{fmtWIB(h.event_time)}</td>
                <td style={{ padding: '10px 0' }}>{h.event_type}</td>
                <td style={{ padding: '10px 0' }}>{h.nik ?? '-'}</td>
                <td style={{ padding: '10px 0' }}>{h.note ?? '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* simple modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div style={{ width: 'min(520px, 100%)', background: '#fff', padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{modalAction}</div>
            <input
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              placeholder="Masukkan NIK"
              style={{ width: '100%', height: 34, padding: '0 10px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setModalOpen(false)}>Batal</button>
              <button onClick={confirmAction}>Konfirmasi</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
