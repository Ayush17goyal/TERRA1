import type { ReactNode } from 'react';
import type { AdminView } from '../types/admin.types';
import { Activity, BarChart3, Bell, BookOpen, Bot, Database, FileStack, GraduationCap, LayoutDashboard, ListChecks, LockKeyhole, ScrollText, Settings, Shield, Users } from 'lucide-react';

const nav: Array<{ id: AdminView; label: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
  { id: 'students', label: 'Students', icon: <Users size={17} /> },
  { id: 'curriculum', label: 'Curriculum', icon: <GraduationCap size={17} /> },
  { id: 'patterns', label: 'Patterns', icon: <ListChecks size={17} /> },
  { id: 'bareActs', label: 'Bare Acts', icon: <FileStack size={17} /> },
  { id: 'ai', label: 'AI Monitoring', icon: <Bot size={17} /> },
  { id: 'queues', label: 'Queues', icon: <Activity size={17} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={17} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={17} /> },
  { id: 'audit', label: 'Audit Logs', icon: <ScrollText size={17} /> },
  { id: 'roles', label: 'Roles', icon: <Shield size={17} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={17} /> },
];

export function AdminLayout({ view, onView, query, onQuery, range, onRange, children }: { view: AdminView; onView(view: AdminView): void; query: string; onQuery(value: string): void; range: string; onRange(value: 'today' | '7d' | '30d' | 'all'): void; children: ReactNode }) {
  return (
    <main className="bam-admin-page">
      <aside className="bam-admin-sidebar" aria-label="Bare Act Mentor admin navigation">
        <div className="bam-admin-brand"><Database size={22} /><div><strong>Mentor Admin</strong><span>Bare Act Drafting</span></div></div>
        <nav>{nav.map((item) => <button key={item.id} type="button" className={view === item.id ? 'active' : ''} onClick={() => onView(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav>
      </aside>
      <section className="bam-admin-shell">
        <header className="bam-admin-topbar">
          <div><span><LockKeyhole size={14} /> RBAC protected</span><h1>{nav.find((item) => item.id === view)?.label}</h1></div>
          <label aria-label="Search admin records"><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search students, patterns, queues" /></label>
          <select value={range} onChange={(event) => onRange(event.target.value as 'today' | '7d' | '30d' | 'all')} aria-label="Analytics date range"><option value="today">Today</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="all">All time</option></select>
        </header>
        {children}
      </section>
    </main>
  );
}
