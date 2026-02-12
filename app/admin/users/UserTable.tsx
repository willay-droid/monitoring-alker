"use client";

import type { ProfileRow } from "./actions";

type Role = "ADMIN" | "TECH";

export default function UserTable(props: {
  rows: ProfileRow[];
  pending: boolean;

  editingId: string | null;
  editNik: string;
  editName: string;
  editRole: Role;

  setEditNik: (v: string) => void;
  setEditName: (v: string) => void;
  setEditRole: (v: Role) => void;

  onStartEdit: (row: ProfileRow) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (id: string) => void;

  onToggleActive: (row: ProfileRow) => void;
  onDelete: (row: ProfileRow) => void;
}) {
  const {
    rows,
    pending,
    editingId,
    editNik,
    editName,
    editRole,
    setEditNik,
    setEditName,
    setEditRole,
    onStartEdit,
    onCancelEdit,
    onSubmitEdit,
    onToggleActive,
    onDelete,
  } = props;

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#fafafa" }}>
          <tr>
            <th style={th}>NIK</th>
            <th style={th}>Nama</th>
            <th style={th}>Role</th>
            <th style={th}>Active</th>
            <th style={th}>Created</th>
            <th style={{ ...th, textAlign: "right" }}>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => {
            const isEdit = editingId === r.id;

            return (
              <tr key={r.id}>
                <td style={td}>
                  {isEdit ? (
                    <input value={editNik} onChange={(e) => setEditNik(e.target.value)} style={miniInput} />
                  ) : (
                    r.nik
                  )}
                </td>

                <td style={td}>
                  {isEdit ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...miniInput, width: "100%" }} />
                  ) : (
                    r.name
                  )}
                </td>

                <td style={td}>
                  {isEdit ? (
                    <select value={editRole} onChange={(e) => setEditRole(e.target.value as Role)} style={miniInput}>
                      <option value="TECH">TECH</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  ) : (
                    r.role
                  )}
                </td>

                <td style={td}>
                  <span style={pill(r.active)}>{r.active ? "ACTIVE" : "INACTIVE"}</span>
                </td>

                <td style={td}>{new Date(r.created_at).toLocaleString()}</td>

                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  {isEdit ? (
                    <>
                      <button
                        disabled={pending}
                        onClick={() => onSubmitEdit(r.id)}
                        style={btnSolid}
                      >
                        Simpan
                      </button>
                      <button disabled={pending} onClick={onCancelEdit} style={btnGhost}>
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button disabled={pending} onClick={() => onStartEdit(r)} style={btnGhost}>
                        Edit
                      </button>

                      <button
                        disabled={pending}
                        onClick={() => onToggleActive(r)}
                        style={btnWarn}
                      >
                        {r.active ? "Nonaktif" : "Aktif"}
                      </button>

                      <button disabled={pending} onClick={() => onDelete(r)} style={btnDanger}>
                        Hapus
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td style={{ ...td, textAlign: "center" }} colSpan={6}>
                Tidak ada user
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  fontSize: 12,
  color: "#444",
  borderBottom: "1px solid #eee",
};

const td: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #f2f2f2",
  verticalAlign: "middle",
};

const miniInput: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  minWidth: 120,
};

const btnGhost: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  marginLeft: 8,
};

const btnSolid: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  marginLeft: 8,
};

const btnWarn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #f0ad4e",
  background: "#fff",
  cursor: "pointer",
  marginLeft: 8,
};

const btnDanger: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #dc3545",
  background: "#fff",
  cursor: "pointer",
  marginLeft: 8,
};

const pill = (active: boolean): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  border: `1px solid ${active ? "#b6e3c1" : "#f5c2c7"}`,
  background: active ? "#eaf7ee" : "#f8d7da",
  color: active ? "#0f5132" : "#842029",
});
