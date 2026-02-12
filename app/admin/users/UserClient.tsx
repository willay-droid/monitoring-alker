"use client";

import { useMemo, useState, useTransition } from "react";
import type { ProfileRow } from "./actions";
import {
  createProfile,
  listProfiles,
  updateProfile,
  toggleActive,
  deleteProfile,
} from "./actions";
import UserTable from "./UserTable";

type Role = "ADMIN" | "TECH";

function norm(s: string) {
  return (s ?? "").toString().trim().toLowerCase();
}

export default function UserClient({
  initialProfiles,
}: {
  initialProfiles: ProfileRow[];
}) {
  const [profiles, setProfiles] = useState<ProfileRow[]>(initialProfiles);
  const [pending, startTransition] = useTransition();

  // form tambah
  const [nik, setNik] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("TECH");

  // search
  const [search, setSearch] = useState("");

  // edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNik, setEditNik] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("TECH");

  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => nik.trim() && name.trim(), [nik, name]);

  const filteredProfiles = useMemo(() => {
    const q = norm(search);
    if (!q) return profiles;

    return profiles.filter((p) => {
      const nikMatch = norm(p.nik).includes(q);
      const nameMatch = norm(p.name).includes(q);
      return nikMatch || nameMatch;
    });
  }, [profiles, search]);

  async function refresh() {
    const data = await listProfiles();
    setProfiles(data);
  }

  function startEdit(row: ProfileRow) {
    setEditingId(row.id);
    setEditNik(row.nik);
    setEditName(row.name);
    setEditRole(row.role);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditNik("");
    setEditName("");
    setEditRole("TECH");
  }

  function submitCreate() {
    setError(null);

    const fd = new FormData();
    fd.set("nik", nik);
    fd.set("name", name);
    fd.set("role", role);

    startTransition(async () => {
      try {
        const res = await createProfile(fd);

        if (!res?.ok) {
          setError(res?.message ?? "Gagal tambah user");
          return;
        }

        setNik("");
        setName("");
        setRole("TECH");
        await refresh();
      } catch (e: any) {
        setError(e?.message ?? "Gagal tambah user");
      }
    });
  }

  function submitUpdate(id: string) {
    setError(null);

    startTransition(async () => {
      try {
        const res = await updateProfile({
          id,
          nik: editNik.trim(),
          name: editName.trim(),
          role: editRole,
        });

        if (!res?.ok) {
          setError(res?.message ?? "Gagal update user");
          return;
        }

        cancelEdit();
        await refresh();
      } catch (e: any) {
        setError(e?.message ?? "Gagal update user");
      }
    });
  }

  function onToggleActive(row: ProfileRow) {
    setError(null);

    startTransition(async () => {
      try {
        const res = await toggleActive({ id: row.id, active: !row.active });

        if (!res?.ok) {
          setError(res?.message ?? "Gagal ubah status");
          return;
        }

        await refresh();
      } catch (e: any) {
        setError(e?.message ?? "Gagal ubah status");
      }
    });
  }

  function onDelete(row: ProfileRow) {
    setError(null);

    const ok = confirm(`Hapus user ${row.nik} - ${row.name}?`);
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await deleteProfile({ id: row.id });

        if (!res?.ok) {
          setError(res?.message ?? "Gagal hapus user");
          return;
        }

        await refresh();
      } catch (e: any) {
        setError(e?.message ?? "Gagal hapus user");
      }
    });
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Kelola Teknisi
      </h2>
      <p style={{ color: "#666", marginBottom: 16 }}>
        Kelola user teknisi/admin: tambah, edit, nonaktif, hapus.
      </p>

      {/* form tambah + search */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={nik}
            onChange={(e) => setNik(e.target.value)}
            placeholder="NIK"
            style={input}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama"
            style={{ ...input, minWidth: 260, flex: 1 }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={input}
          >
            <option value="TECH">TECH</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <button
            disabled={!canSubmit || pending}
            onClick={submitCreate}
            style={primaryBtn(pending)}
          >
            {pending ? "Menyimpan..." : "Tambah"}
          </button>

          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  setError(null);
                  await refresh();
                } catch (e: any) {
                  setError(e?.message ?? "Gagal refresh");
                }
              })
            }
            style={secondaryBtn}
          >
            Refresh
          </button>

          {/* SEARCH */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search NIK / Nama..."
            style={{ ...input, minWidth: 220 }}
          />

          <button
            disabled={pending || !search.trim()}
            onClick={() => setSearch("")}
            style={secondaryBtn}
          >
            Clear
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
          Menampilkan <b>{filteredProfiles.length}</b> dari{" "}
          <b>{profiles.length}</b> user.
        </div>

        {error && <div style={errorBox}>{error}</div>}
      </div>

      <UserTable
        rows={filteredProfiles}
        pending={pending}
        editingId={editingId}
        editNik={editNik}
        editName={editName}
        editRole={editRole}
        setEditNik={setEditNik}
        setEditName={setEditName}
        setEditRole={setEditRole}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onSubmitEdit={submitUpdate}
        onToggleActive={onToggleActive}
        onDelete={onDelete}
      />
    </div>
  );
}

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  minWidth: 160,
};

const primaryBtn = (pending: boolean): React.CSSProperties => ({
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  background: pending ? "#333" : "#111",
  color: "#fff",
  cursor: pending ? "not-allowed" : "pointer",
});

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #f5c2c7",
  background: "#f8d7da",
  color: "#842029",
};
