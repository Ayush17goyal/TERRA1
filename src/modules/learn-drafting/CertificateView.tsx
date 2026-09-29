import { Award, Download, Share2 } from 'lucide-react'
import type { Course } from './types'

interface Props {
  course: Course
  userName: string
  completedAt: string
  onBack: () => void
}

export default function CertificateView({ course, userName, completedAt, onBack }: Props) {
  const date = new Date(completedAt).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const handleDownload = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const W = 841, H = 595

      // Background
      doc.setFillColor(13, 17, 30)
      doc.rect(0, 0, W, H, 'F')

      // Gold border
      doc.setDrawColor(245, 193, 79)
      doc.setLineWidth(3)
      doc.rect(20, 20, W - 40, H - 40, 'S')
      doc.setLineWidth(1)
      doc.rect(28, 28, W - 56, H - 56, 'S')

      // Header
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(245, 193, 79)
      doc.text('LEGATRIXON', W / 2, 80, { align: 'center' })

      doc.setFontSize(28)
      doc.setTextColor(245, 245, 245)
      doc.text('Certificate of Completion', W / 2, 130, { align: 'center' })

      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(12)
      doc.setTextColor(180, 180, 180)
      doc.text('This certifies that', W / 2, 185, { align: 'center' })

      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(32)
      doc.setTextColor(245, 193, 79)
      doc.text(userName, W / 2, 235, { align: 'center' })

      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(12)
      doc.setTextColor(180, 180, 180)
      doc.text('has successfully completed the masterclass', W / 2, 270, { align: 'center' })

      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(245, 245, 245)
      doc.text(course.title, W / 2, 310, { align: 'center' })

      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(120, 120, 120)
      doc.text(`Issued on ${date}`, W / 2, 360, { align: 'center' })

      // Divider
      doc.setDrawColor(245, 193, 79)
      doc.setLineWidth(0.5)
      doc.line(W / 2 - 100, 380, W / 2 + 100, 380)

      doc.setFontSize(9)
      doc.text('Legatrixon Drafting Academy', W / 2, 400, { align: 'center' })

      doc.save(`Certificate_${course.title.replace(/\s+/g, '_')}.pdf`)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="ld-cert-page">
      <div className="ld-cert-frame">
        <div className="ld-cert-inner">
          <div className="ld-cert-header">
            <Award size={48} className="ld-cert-seal" />
            <span className="ld-cert-org">LEGATRIXON</span>
          </div>

          <p className="ld-cert-sub">Certificate of Completion</p>
          <p className="ld-cert-label">This certifies that</p>
          <h2 className="ld-cert-name">{userName}</h2>
          <p className="ld-cert-label">has successfully completed the masterclass</p>
          <h3 className="ld-cert-course">{course.title}</h3>
          <p className="ld-cert-date">Issued on {date}</p>

          <div className="ld-cert-divider" />
          <p className="ld-cert-footer">Legatrixon Drafting Academy</p>
        </div>
      </div>

      <div className="ld-cert-actions">
        <button className="ld-btn-outline" onClick={onBack}>← Back to Course</button>
        <button className="ld-btn-gold" onClick={handleDownload}>
          <Download size={15} /> Download PDF
        </button>
        <button
          className="ld-btn-outline"
          onClick={() => navigator.share?.({ title: course.title, text: `I completed ${course.title} on Legatrixon!` })}
        >
          <Share2 size={15} /> Share
        </button>
      </div>
    </div>
  )
}
