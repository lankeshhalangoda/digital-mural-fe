import { useEffect, useMemo, useState } from 'react';
import { fetchSubmissions, getDownloadUrl } from '../api/client.js';

const categoryLabels = {
  challenge: 'Challenge a harmful norm',
  promote: 'Promote a safe practice',
  share: 'Share a positive message'
};

function AdminPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const { submissions: payload = [] } = await fetchSubmissions(controller.signal);
        setSubmissions(payload);
        setLoading(false);
        setError('');
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err.message || 'Unable to load submissions.');
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    return submissions.reduce(
      (acc, entry) => {
        acc.total += 1;
        acc[entry.category] = (acc[entry.category] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [submissions]);

  const handleDownload = () => {
    const url = getDownloadUrl();
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Admin tools</p>
          <h2>Manage community submissions</h2>
        </div>
        <button className="primary-btn" onClick={handleDownload} disabled={loading || !!error}>
          Download submissions (.json)
        </button>
      </header>

      {loading && <div className="status-pill">Loading submissions…</div>}
      {error && <div className="status-pill status-pill--error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <p>Total tiles</p>
              <strong>{stats.total}</strong>
            </div>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <div className="stat-card" key={key}>
                <p>{label}</p>
                <strong>{stats[key] || 0}</strong>
              </div>
            ))}
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Category</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submissions.slice().reverse().map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.message}</td>
                    <td>{categoryLabels[entry.category] || entry.category}</td>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default AdminPage;

