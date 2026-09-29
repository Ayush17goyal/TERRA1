import { API_BASE_URL } from '../lib/api'
import { useEffect, useState, type FormEvent } from 'react'
import {
  ShieldCheck,
  UserCheck,
  Upload,
  Loader2,
  Clock,
  XCircle,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Download,
  GraduationCap,
  Scale,
  Activity,
  User,
  ArrowRight,
  ArrowLeft
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || `${API_BASE_URL}`

type VerificationStatus = {
  id?: string
  status: 'unsubmitted' | 'pending' | 'verified' | 'rejected'
  fullName?: string
  universityName?: string
  course?: string
  yearOfStudy?: string
  studentEmail?: string
  studentIdNumber?: string
  isAcademicEmail?: boolean
  rejectionReason?: string
  createdAt?: string
}

type AdminRequest = VerificationStatus & {
  documents: Array<{ id: string; fileName: string; documentType: string; createdAt: string }>
}

type VerificationAnalytics = {
  totalVerifiedStudents: number
  pendingReviews: number
  rejectedApplications: number
  verificationSuccessRate: string
  totalRequests: number
}

async function apiCall(path: string, options: RequestInit = {}) {
  const token = await (window as any).Clerk?.session?.getToken()
  if (!token) throw new Error('Authenticated Clerk session required')
  
  const headers = options.body instanceof FormData
    ? { Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

export default function StudentVerificationPortal({ isAdmin = false, onVerificationSuccess }: { isAdmin?: boolean; onVerificationSuccess?: () => void }) {
  const [status, setStatus] = useState<VerificationStatus>({ status: 'unsubmitted' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  
  // Multi-step signup form state
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState('')
  const [universityName, setUniversityName] = useState('')
  const [course, setCourse] = useState('')
  const [yearOfStudy, setYearOfStudy] = useState('1st Year')
  const [studentEmail, setStudentEmail] = useState('')
  const [studentIdNumber, setStudentIdNumber] = useState('')
  const [idCardFile, setIdCardFile] = useState<File | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)

  // Admin Dashboard State
  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([])
  const [analytics, setAnalytics] = useState<VerificationAnalytics | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null)

  async function loadStatus() {
    try {
      const res = await apiCall('/student-verification/status')
      setStatus(res)
      if (res.status === 'verified' && onVerificationSuccess) {
        onVerificationSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load verification status.')
    } finally {
      setLoading(false)
    }
  }

  async function loadAdminData() {
    if (!isAdmin) return
    setLoading(true)
    try {
      const [requestsList, analyticsData] = await Promise.all([
        apiCall('/student-verification/admin/list'),
        apiCall('/student-verification/admin/analytics')
      ])
      setAdminRequests(requestsList)
      setAnalytics(analyticsData)
    } catch (err: any) {
      setError(err.message || 'Failed to load admin data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    if (isAdmin) {
      loadAdminData()
    }
  }, [isAdmin])

  const checkAcademicDomain = (email: string) => {
    const domains = ['.ac.in', '.edu', '.edu.in', '.ac.uk']
    const lower = email.toLowerCase().trim()
    return domains.some(d => lower.endsWith(d))
  }

  const isAcademic = checkAcademicDomain(studentEmail)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!checkAcademicDomain(studentEmail)) {
      setError('Only academic student email addresses (ending in .edu, .ac.in, .edu.in, .ac.uk) are accepted.')
      return
    }
    setBusy('Submitting request...')
    setError('')

    try {
      const formData = new FormData()
      formData.append('fullName', fullName)
      formData.append('universityName', universityName)
      formData.append('course', course)
      formData.append('yearOfStudy', yearOfStudy)
      formData.append('studentEmail', studentEmail)
      formData.append('studentIdNumber', studentIdNumber)

      if (idCardFile) formData.append('studentIdCard', idCardFile)
      if (proofFile) formData.append('enrollmentProof', proofFile)

      const result = await apiCall('/student-verification/submit', {
        method: 'POST',
        body: formData
      })
      setStatus(result)
      setBusy('')
      if (result.status === 'verified' && onVerificationSuccess) {
        onVerificationSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Submission failed.')
      setBusy('')
    }
  }

  async function handleApprove(requestId: string) {
    setBusy('Approving student...')
    try {
      await apiCall(`/student-verification/admin/${requestId}/approve`, { method: 'POST' })
      await loadAdminData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function handleReject(requestId: string) {
    if (!rejectionReason.trim()) {
      alert('Please state a reason for rejection.')
      return
    }
    setBusy('Rejecting student...')
    try {
      await apiCall(`/student-verification/admin/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason })
      })
      setSelectedReqId(null)
      setRejectionReason('')
      await loadAdminData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  if (loading) {
    return (
      <div className="portal-loading">
        <Loader2 className="animate-spin" size={32} />
        <p>Loading Verification Portal...</p>
      </div>
    )
  }

  // Admin Dashboard Render
  if (isAdmin) {
    return (
      <div className="admin-verification-dashboard">
        <style>{`
          .admin-verification-dashboard { color: var(--text); display: grid; gap: 24px; }
          .admin-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
          .metric-card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
          .metric-card span { color: var(--text-soft); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
          .metric-card strong { font-size: 1.8rem; color: var(--gold); }
          .requests-table-container { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 20px; overflow-x: auto; }
          .requests-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
          .requests-table th, .requests-table td { padding: 12px; border-bottom: 1px solid var(--line); }
          .requests-table th { color: var(--text-soft); font-weight: 700; text-transform: uppercase; font-size: 0.76rem; }
          .status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.72rem; text-transform: uppercase; }
          .status-badge.pending { background: rgba(245, 193, 79, 0.1); color: var(--gold); border: 1px solid rgba(245, 193, 79, 0.3); }
          .status-badge.verified { background: rgba(46, 204, 113, 0.1); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3); }
          .status-badge.rejected { background: rgba(231, 76, 60, 0.1); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); }
          .doc-link { color: var(--gold); display: inline-flex; align-items: center; gap: 4px; text-decoration: none; font-weight: 600; margin-right: 12px; }
          .doc-link:hover { text-decoration: underline; }
          .action-btn { background: var(--panel-strong); border: 1px solid var(--line); border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; font-weight: 700; color: var(--text); cursor: pointer; transition: 180ms ease; margin-right: 8px; }
          .action-btn.approve { background: #2ecc71; color: #171717; border-color: #2ecc71; }
          .action-btn.reject { background: #e74c3c; color: #fff; border-color: #e74c3c; }
          .rejection-panel { background: rgba(0,0,0,0.2); border: 1px solid var(--line); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
          .rejection-input { background: var(--bg); border: 1px solid var(--line); color: var(--text); border-radius: 6px; padding: 8px; font-family: inherit; font-size: 0.85rem; outline: none; }
        `}</style>
        
        <div className="dashboard-head">
          <h2>Student Verification Dashboard</h2>
          <p style={{ color: 'var(--text-soft)' }}>Review student applications, verify credentials, and approve access to LEGATRIXON.</p>
        </div>

        {analytics && (
          <div className="admin-metrics">
            <div className="metric-card">
              <span>Total Verified Students</span>
              <strong>{analytics.totalVerifiedStudents}</strong>
            </div>
            <div className="metric-card">
              <span>Pending Reviews</span>
              <strong>{analytics.pendingReviews}</strong>
            </div>
            <div className="metric-card">
              <span>Rejected Applications</span>
              <strong>{analytics.rejectedApplications}</strong>
            </div>
            <div className="metric-card">
              <span>Verification Success Rate</span>
              <strong>{analytics.verificationSuccessRate}</strong>
            </div>
          </div>
        )}

        <div className="requests-table-container">
          <h3>Submitted Applications</h3>
          {adminRequests.length === 0 ? (
            <p style={{ color: 'var(--text-soft)', margin: '20px 0 0' }}>No verification requests submitted yet.</p>
          ) : (
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>University & Course</th>
                  <th>Student Email</th>
                  <th>ID Number</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Documents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminRequests.map((req) => (
                  <tr key={req.id}>
                    <td><strong>{req.fullName}</strong></td>
                    <td>
                      {req.universityName}<br />
                      <small style={{ color: 'var(--text-soft)' }}>{req.course} · {req.yearOfStudy}</small>
                    </td>
                    <td>{req.studentEmail}</td>
                    <td><code>{req.studentIdNumber}</code></td>
                    <td>
                      <span style={{ fontSize: '0.74rem', color: req.isAcademicEmail ? '#2ecc71' : 'var(--gold)' }}>
                        {req.isAcademicEmail ? 'Academic Email' : 'Manual Upload'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${req.status}`}>
                        {req.status === 'pending' && <Clock size={10} />}
                        {req.status === 'verified' && <CheckCircle2 size={10} />}
                        {req.status === 'rejected' && <XCircle size={10} />}
                        {req.status}
                      </span>
                    </td>
                    <td>
                      {req.documents?.map(doc => (
                        <a 
                          key={doc.id}
                          href={`${API_BASE}/student-verification/documents/${doc.id}`}
                          className="doc-link"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download size={12} /> {doc.documentType}
                        </a>
                      ))}
                      {req.documents?.length === 0 && <span style={{ color: 'var(--text-soft)' }}>None</span>}
                    </td>
                    <td>
                      {req.status === 'pending' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex' }}>
                            <button className="action-btn approve" onClick={() => handleApprove(req.id!)}>Approve</button>
                            <button className="action-btn reject" onClick={() => setSelectedReqId(req.id!)}>Reject</button>
                          </div>
                          {selectedReqId === req.id && (
                            <div className="rejection-panel">
                              <input 
                                className="rejection-input"
                                placeholder="Rejection reason..." 
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                              />
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="action-btn" onClick={() => handleReject(req.id!)}>Submit Rejection</button>
                                <button className="action-btn" onClick={() => setSelectedReqId(null)}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {req.status !== 'pending' && (
                        <span style={{ color: 'var(--text-soft)' }}>Decided</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // Verification Portal for Student Flow
  return (
    <div className="student-verification-portal">
      <style>{`
        .student-verification-portal { max-width: 680px; margin: 0 auto; color: var(--text); }
        .verification-card { background: rgba(30, 41, 59, 0.45); border: 1px solid var(--line); border-radius: 16px; padding: 32px; backdrop-filter: blur(12px); display: flex; flex-direction: column; gap: 24px; box-shadow: 0 20px 45px rgba(0,0,0,0.4); }
        .portal-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; gap: 12px; color: var(--text-soft); }
        .badge-header { display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 16px; }
        .badge-header h2 { font-size: 1.4rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px; }
        .form-steps-indicator { display: flex; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 16px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--text-soft); }
        .form-step-dot { display: flex; align-items: center; gap: 6px; }
        .form-step-dot.active { color: var(--gold); }
        .form-step-dot.completed { color: #2ecc71; }
        .portal-field { display: flex; flex-direction: column; gap: 8px; }
        .portal-field label { font-size: 0.76rem; font-weight: 700; color: var(--text-soft); text-transform: uppercase; }
        .portal-field input, .portal-field select { background: rgba(15, 23, 42, 0.6); border: 1px solid var(--line); border-radius: 8px; padding: 12px; color: var(--text); font-family: inherit; font-size: 0.9rem; outline: none; transition: 180ms ease; }
        .portal-field input:focus, .portal-field select:focus { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(245, 193, 79, 0.2); }
        .file-upload-box { border: 2px dashed var(--line); border-radius: 10px; padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: 180ms ease; background: rgba(15, 23, 42, 0.2); }
        .file-upload-box:hover { border-color: var(--gold); background: rgba(245, 193, 79, 0.02); }
        .file-selected-bar { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 12px; background: rgba(46, 204, 113, 0.1); border: 1px solid rgba(46, 204, 113, 0.2); border-radius: 8px; font-size: 0.8rem; color: #2ecc71; }
        .btn-row { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; }
        .btn-verification { background: var(--gold); color: #171717; border: 1px solid var(--gold); font-weight: 800; border-radius: 8px; padding: 12px 24px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.9rem; transition: 180ms ease; }
        .btn-verification:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-verification.secondary { background: transparent; border-color: var(--line); color: var(--text); }
        .btn-verification.secondary:hover { background: rgba(255,255,255,0.05); }
        .academic-badge { background: rgba(46, 204, 113, 0.1); border: 1px solid #2ecc71; color: #2ecc71; font-weight: 700; border-radius: 4px; padding: 4px 8px; font-size: 0.72rem; text-transform: uppercase; align-self: flex-start; }
        .alert-error { color: #fca5a5; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 8px; font-size: 0.85rem; }
        .success-box { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; padding: 16px 0; }
        .success-icon { background: rgba(46, 204, 113, 0.1); border: 1px solid #2ecc71; color: #2ecc71; border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; }
        .verified-badge-card { background: linear-gradient(135deg, rgba(245, 193, 79, 0.08) 0%, rgba(30, 41, 59, 0.5) 100%); border: 2px solid var(--gold); padding: 24px; border-radius: 12px; display: flex; flex-direction: column; gap: 12px; width: 100%; box-shadow: 0 10px 30px rgba(245, 193, 79, 0.1); }
      `}</style>

      {/* Verification Status: Verified Screen */}
      {status.status === 'verified' && (
        <div className="verification-card">
          <div className="badge-header">
            <CheckCircle2 size={32} style={{ color: '#2ecc71' }} />
            <div>
              <h2>Verification Success</h2>
              <p style={{ color: 'var(--text-soft)', margin: '4px 0 0' }}>Your student profile has been validated.</p>
            </div>
          </div>
          
          <div className="success-box">
            <div className="verified-badge-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: '1.25rem', color: '#fff', display: 'block' }}>{status.fullName}</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-soft)' }}>{status.universityName}</span>
                </div>
                <span className="academic-badge" style={{ background: 'rgba(245, 193, 79, 0.1)', color: 'var(--gold)', borderColor: 'var(--gold)' }}>
                  ✓ Verified Law Student
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.78rem', color: 'var(--text-soft)', borderTop: '1px solid var(--line)', paddingTop: '12px', marginTop: '8px' }}>
                <span><strong>Course:</strong> {status.course}</span>
                <span><strong>Year:</strong> {status.yearOfStudy}</span>
                <span><strong>ID:</strong> {status.studentIdNumber}</span>
                <span><strong>Verified:</strong> {status.createdAt ? new Date(status.createdAt).toLocaleDateString() : 'Active'}</span>
              </div>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-soft)' }}>
              Thank you! You now have unrestricted access to premium moot court, research, and analysis suites on LEGATRIXON.
            </p>
          </div>
        </div>
      )}

      {/* Verification Status: Pending Screen */}
      {status.status === 'pending' && (
        <div className="verification-card">
          <div className="badge-header">
            <Clock size={32} style={{ color: 'var(--gold)' }} />
            <div>
              <h2>Verification Pending</h2>
              <p style={{ color: 'var(--text-soft)', margin: '4px 0 0' }}>Manual credentials review in progress.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
              Your academic information is currently undergoing review by the LEGATRIXON administration team. Since you signed up with a personal email address, we are validating your uploaded student credentials manually.
            </p>

            <div style={{ border: '1px solid var(--line)', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>SUBMITTED PARTICULARS</span>
              <span><strong>Name:</strong> {status.fullName}</span>
              <span><strong>University:</strong> {status.universityName}</span>
              <span><strong>Course:</strong> {status.course} · {status.yearOfStudy}</span>
              <span><strong>ID Card Number:</strong> {status.studentIdNumber}</span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>
              Reviews are typically completed within 12–24 hours. You will receive unrestricted access automatically upon approval.
            </p>
          </div>
        </div>
      )}

      {/* Verification Status: Rejected Screen */}
      {status.status === 'rejected' && (
        <div className="verification-card">
          <div className="badge-header">
            <XCircle size={32} style={{ color: '#e74c3c' }} />
            <div>
              <h2>Application Rejected</h2>
              <p style={{ color: 'var(--text-soft)', margin: '4px 0 0' }}>The credentials provided could not be verified.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="alert-error" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> Reason for Rejection:</strong>
              <p style={{ margin: 0, fontStyle: 'italic' }}>{status.rejectionReason || 'Uploaded documents were blurry or invalid.'}</p>
            </div>

            <p style={{ fontSize: '0.9rem' }}>
              Please review the rejection details above and re-submit your verification form with the correct academic documents.
            </p>

            <button 
              className="btn-verification" 
              type="button" 
              onClick={() => setStatus({ status: 'unsubmitted' })}
            >
              Re-submit Verification Application
            </button>
          </div>
        </div>
      )}

      {/* Multi-Step Application Form */}
      {status.status === 'unsubmitted' && (
        <form className="verification-card" onSubmit={handleSubmit}>
          <div className="badge-header">
            <GraduationCap size={32} style={{ color: 'var(--gold)' }} />
            <div>
              <h2>Student Verification</h2>
              <p style={{ color: 'var(--text-soft)', margin: '4px 0 0' }}>Complete your profile to unlock verified platform access.</p>
            </div>
          </div>

          <div className="form-steps-indicator">
            <span className={`form-step-dot ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
              Step 1: Account
            </span>
            <span className={`form-step-dot ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
              Step 2: Academic
            </span>
            <span className={`form-step-dot ${step === 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
              Step 3: Verification
            </span>
            <span className={`form-step-dot ${step === 4 ? 'active' : ''}`}>
              Step 4: Review
            </span>
          </div>

          {error && <div className="alert-error">{error}</div>}

          {/* STEP 1: ACCOUNT CREATION STATUS (Clerk managed) */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--gold)' }}>Clerk Credentials Verification</h3>
              <p style={{ fontSize: '0.88rem' }}>
                LEGATRIXON uses Clerk to securely verify email addresses. Your login credentials and primary session are managed automatically.
              </p>
              <div style={{ background: 'rgba(46, 204, 113, 0.1)', border: '1px solid #2ecc71', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 style={{ color: '#2ecc71' }} size={20} />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#2ecc71' }}>Email Authenticated via Clerk Session</span>
              </div>
              <button 
                className="btn-verification" 
                type="button" 
                style={{ alignSelf: 'flex-end', marginTop: '16px' }}
                onClick={() => setStep(2)}
              >
                Proceed to Academic Form <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: ACADEMIC DETAILS */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--gold)' }}>University Details</h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-soft)' }}>Specify your institution and academic course.</p>
              
              <div className="portal-field">
                <label>Full Name</label>
                <input 
                  required 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  placeholder="Your legal name"
                />
              </div>

              <div className="portal-field">
                <label>University / College Name</label>
                <input 
                  required 
                  value={universityName} 
                  onChange={(e) => setUniversityName(e.target.value)} 
                  placeholder="e.g., National Law School of India University"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div className="portal-field">
                  <label>Course / Program</label>
                  <input 
                    required 
                    value={course} 
                    onChange={(e) => setCourse(e.target.value)} 
                    placeholder="e.g., B.A. LL.B (Hons.)"
                  />
                </div>
                <div className="portal-field">
                  <label>Year of Study</label>
                  <select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}>
                    <option>1st Year</option>
                    <option>2nd Year</option>
                    <option>3rd Year</option>
                    <option>4th Year</option>
                    <option>5th Year</option>
                    <option>LL.M / PG Student</option>
                  </select>
                </div>
              </div>

              <div className="portal-field">
                <label>Student Email Address</label>
                <input 
                  required 
                  type="email" 
                  value={studentEmail} 
                  onChange={(e) => {
                    setStudentEmail(e.target.value)
                    setError('')
                  }} 
                  placeholder="e.g., name@nls.ac.in"
                />
              </div>

              {studentEmail && !isAcademic && (
                <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '-8px', fontWeight: '700' }}>
                  ⚠ Only academic student emails (ending in .edu, .ac.in, .edu.in, .ac.uk) are accepted. Personal email domains are not allowed.
                </div>
              )}

              <div className="portal-field">
                <label>Student ID Number</label>
                <input 
                  required 
                  value={studentIdNumber} 
                  onChange={(e) => setStudentIdNumber(e.target.value)} 
                  placeholder="e.g., NLS-2026-429"
                />
              </div>

              {isAcademic && (
                <div className="academic-badge">
                  Verified Academic Domain Detected (.ac.in / .edu / .ac.uk)
                </div>
              )}

              <div className="btn-row">
                <button className="btn-verification secondary" type="button" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button>
                <button 
                  className="btn-verification" 
                  type="button" 
                  disabled={!fullName || !universityName || !course || !studentEmail || !studentIdNumber || !isAcademic}
                  onClick={() => setStep(3)}
                >
                  Next: Document Verification <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: DOCUMENT UPLOAD */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--gold)' }}>Credentials Upload</h3>
              
              {isAcademic ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ background: 'rgba(46, 204, 113, 0.1)', border: '1px solid #2ecc71', borderRadius: '8px', padding: '16px', color: '#2ecc71' }}>
                    <strong>Instant verification qualified!</strong> Since you provided an email address under a registered academic domain (<code>{studentEmail}</code>), you do not need to upload physical ID cards.
                  </div>
                  <p style={{ fontSize: '0.86rem' }}>You may skip this step and click next to finalize.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: 'rgba(245, 193, 79, 0.06)', border: '1px solid rgba(245,193,79,0.3)', borderRadius: '8px', padding: '16px', fontSize: '0.86rem' }}>
                    <strong>Personal Email detected:</strong> Because you are registering with a general email, you must upload a legible copy of your student ID card or enrollment proof for manual validation.
                  </div>

                  <div className="portal-field">
                    <label>Student ID Card (Front)</label>
                    {idCardFile ? (
                      <div className="file-selected-bar">
                        <span>ðŸ“„ {idCardFile.name} ({(idCardFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button type="button" style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setIdCardFile(null)}>Remove</button>
                      </div>
                    ) : (
                      <label className="file-upload-box">
                        <Upload size={20} style={{ color: 'var(--gold)' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Click to upload Student ID Card</span>
                        <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => setIdCardFile(e.target.files?.[0] || null)} />
                      </label>
                    )}
                  </div>

                  <div className="portal-field">
                    <label>Enrollment Proof / College Fee Receipt</label>
                    {proofFile ? (
                      <div className="file-selected-bar">
                        <span>ðŸ“„ {proofFile.name} ({(proofFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button type="button" style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setProofFile(null)}>Remove</button>
                      </div>
                    ) : (
                      <label className="file-upload-box">
                        <Upload size={20} style={{ color: 'var(--gold)' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Click to upload Enrollment Proof</span>
                        <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="btn-row">
                <button className="btn-verification secondary" type="button" onClick={() => setStep(2)}><ArrowLeft size={16} /> Back</button>
                <button 
                  className="btn-verification" 
                  type="button" 
                  disabled={!isAcademic && (!idCardFile && !proofFile)}
                  onClick={() => setStep(4)}
                >
                  Next: Review and Submit <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW AND SUBMIT */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--gold)' }}>Review Particulars</h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-soft)' }}>Please confirm that all submitted fields are accurate before uploading.</p>

              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--line)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem' }}>
                <span><strong>Student Name:</strong> {fullName}</span>
                <span><strong>University Name:</strong> {universityName}</span>
                <span><strong>Course &amp; Year:</strong> {course} · {yearOfStudy}</span>
                <span><strong>Student Email:</strong> {studentEmail}</span>
                <span><strong>ID Number:</strong> <code>{studentIdNumber}</code></span>
                <span><strong>Verification Mode:</strong> {isAcademic ? 'Instant Academic Email' : 'Manual Document Review'}</span>
                
                {!isAcademic && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--line)', paddingTop: '8px', marginTop: '4px' }}>
                    <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.72rem' }}>ATTACHMENTS</span>
                    {idCardFile && <span>✓ ID Card: {idCardFile.name}</span>}
                    {proofFile && <span>✓ Proof: {proofFile.name}</span>}
                  </div>
                )}
              </div>

              <div className="btn-row">
                <button className="btn-verification secondary" type="button" onClick={() => setStep(3)}><ArrowLeft size={16} /> Back</button>
                <button 
                  className="btn-verification" 
                  type="submit" 
                  disabled={!!busy}
                >
                  {busy ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Submitting...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} /> Submit Verification Request
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  )
}

