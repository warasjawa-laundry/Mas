export default function AdminLoading() {
  return <main className="admin-workspace">
    <div className="admin-content" role="status" aria-live="polite">
      <h1>Memuat halaman…</h1>
      <p className="admin-hint">Sedang mengambil data outlet. Mohon tunggu.</p>
    </div>
  </main>;
}
