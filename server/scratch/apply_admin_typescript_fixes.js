const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../src/modules/AdminPortal.tsx');
try {
  let content = fs.readFileSync(filePath, 'utf8');

  // Let's find the start of the ContractSettingsView function and replace it to the end of the file.
  const targetStart = "function ContractSettingsView() {";
  const startIdx = content.indexOf(targetStart);
  
  if (startIdx === -1) {
    throw new Error('ContractSettingsView not found in AdminPortal.tsx');
  }

  // Slice off the old untyped ContractSettingsView and append the typed one
  const typedView = `interface ContractAcceptanceRecord {
  id: string;
  userId: string | null;
  email: string | null;
  timestamp: string;
  ipAddress: string | null;
  browserUserAgent: string | null;
  contractVersion: string;
  accepted: boolean;
}

function ContractSettingsView() {
  const { getToken } = useAuth()
  const [version, setVersion] = useState('')
  const [content, setContent] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [acceptances, setAcceptances] = useState<ContractAcceptanceRecord[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadConfigAndAcceptances = async () => {
    setLoading(true)
    setStatus('')
    try {
      const token = await getToken()
      if (!token) throw new Error('Authorization required')

      const configRes = await fetch('http://localhost:4000/api/v1/contracts/active')
      if (!configRes.ok) throw new Error('Failed to load contract config')
      const configData = await configRes.json()
      setVersion(configData.contractVersion)
      setContent(configData.contractContent)
      setLastUpdated(configData.lastUpdated)

      const accRes = await fetch('http://localhost:4000/api/v1/contracts/admin/acceptances', {
        headers: {
          'Authorization': \`Bearer \${token}\`
        }
      })
      if (!accRes.ok) throw new Error('Failed to load acceptance logs')
      const accData = await accRes.json()
      setAcceptances(accData)
    } catch (err: any) {
      setStatus(err.message || 'Error loading data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigAndAcceptances()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!version.trim() || !content.trim()) {
      setStatus('Version and Content are required.')
      return
    }
    setSubmitting(true)
    setStatus('Updating contract compliance configuration...')
    try {
      const token = await getToken()
      if (!token) throw new Error('Authorization required')

      const response = await fetch('http://localhost:4000/api/v1/contracts/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ contractVersion: version, contractContent: content })
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      setLastUpdated(result.lastUpdated)
      setStatus('Contract updated successfully! All visitors and users will be forced to re-accept.')
      loadConfigAndAcceptances()
    } catch (error: any) {
      setStatus(error.message || 'Failed to update contract configuration.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <section className="glass-card" style={{ padding: '24px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scale size={18} /> Edit Active Intellectual Property &amp; Electronic Contract
        </h3>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-soft)', fontSize: '0.82rem' }}>
          Changing the version number will immediately invalidate previous acceptances, prompting all visitors and users to re-accept.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-soft)' }}>Loading contract settings...</p>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '6px', color: 'var(--text-soft)', fontSize: '0.8rem', fontWeight: 700 }}>
                Contract Version
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g. 1.0.0"
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end', fontSize: '0.8rem', color: 'var(--text-soft)', paddingBottom: '10px' }}>
                <span>Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}</span>
              </div>
            </div>

            <label style={{ display: 'grid', gap: '6px', color: 'var(--text-soft)', fontSize: '0.8rem', fontWeight: 700 }}>
              Contract Content (Text / Markdown)
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="Paste contract terms here..."
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              {status && <span style={{ fontSize: '0.82rem', color: status.includes('success') ? 'var(--ok)' : 'var(--gold)', fontWeight: '600' }}>{status}</span>}
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: '10px 20px', cursor: 'pointer' }}>
                Save &amp; Force Re-acceptance
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="glass-card" style={{ padding: '24px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: '0 0 6px 0' }}>
          User Acceptance Registry
        </h3>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-soft)', fontSize: '0.82rem' }}>
          Live record of legal consent captures containing unique Clerk identifiers, email accounts, timestamp, client IP addresses, and User Agent fingerprints.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-soft)' }}>Loading acceptance registry...</p>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '400px' }} className="contract-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                  <th style={{ padding: '10px' }}>User ID / Subject</th>
                  <th style={{ padding: '10px' }}>Email</th>
                  <th style={{ padding: '10px' }}>Accepted Version</th>
                  <th style={{ padding: '10px' }}>IP Address</th>
                  <th style={{ padding: '10px' }}>Timestamp</th>
                  <th style={{ padding: '10px', maxWidth: '200px' }}>User Agent</th>
                </tr>
              </thead>
              <tbody>
                {acceptances.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--line)', color: 'var(--text)' }}>
                    <td style={{ padding: '12px 10px', fontFamily: 'monospace', color: 'var(--gold-soft)' }}>{item.userId || 'Guest (Synced later)'}</td>
                    <td style={{ padding: '12px 10px' }}>{item.email || '—'}</td>
                    <td style={{ padding: '12px 10px', fontWeight: '700' }}>v{item.contractVersion}</td>
                    <td style={{ padding: '12px 10px', fontFamily: 'monospace' }}>{item.ipAddress || '—'}</td>
                    <td style={{ padding: '12px 10px' }}>{new Date(item.timestamp).toLocaleString()}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-soft)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.browserUserAgent || undefined}>
                      {item.browserUserAgent || '—'}
                    </td>
                  </tr>
                ))}
                {!acceptances.length && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-soft)' }}>
                      No contract acceptance logs found in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
`;

  const updatedContent = content.substring(0, startIdx) + typedView;
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log('AdminPortal.tsx updated with types successfully.');
} catch (err) {
  console.error(err);
}
