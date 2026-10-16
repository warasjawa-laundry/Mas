export default function AdminLoading() {
  return <main className="admin-workspace">
    <div className="admin-content" role="status" aria-live="polite">
      <p className="admin-kicker">AREA PEMILIK</p>
      <h1>Memuat halaman…</h1>
      <p className="admin-hint">Menyiapkan data dengan aman. Mohon tunggu.</p>
    </div>
  </main>;
}
