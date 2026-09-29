export function CourseCardSkeleton() {
  return (
    <div className="ld-skeleton-card">
      <div className="ld-sk ld-sk-thumb" />
      <div className="ld-skeleton-body">
        <div className="ld-sk ld-sk-title" />
        <div className="ld-sk ld-sk-text" />
        <div className="ld-sk ld-sk-text ld-sk-short" />
        <div className="ld-sk ld-sk-bar" />
        <div className="ld-sk ld-sk-btn" />
      </div>
    </div>
  )
}

export function LessonRowSkeleton() {
  return (
    <div className="ld-sk-lesson-row">
      <div className="ld-sk ld-sk-num" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="ld-sk ld-sk-text" />
        <div className="ld-sk ld-sk-text ld-sk-short" />
      </div>
    </div>
  )
}

export function PlayerSkeleton() {
  return (
    <div className="ld-sk-player">
      <div className="ld-sk ld-sk-video" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 24px' }}>
        <div className="ld-sk ld-sk-title" />
        <div className="ld-sk ld-sk-text" />
      </div>
    </div>
  )
}
