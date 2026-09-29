import { Suspense } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { AiSection, AnalyticsSection, AuditSection, BareActSection, CurriculumSection, NotificationSection, OverviewSection, PatternSection, QueueSection, RoleSection, SettingsSection, StudentsSection } from '../components/AdminSections';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { useAdminDashboard, useAdminMutations } from '../hooks/useAdminDashboard';
import { useAdminUi } from '../store/useAdminUi';
import '../styles/admin-dashboard.css';

function LoadingState({ label }: { label: string }) {
  return <main className="bam-admin-loading" role="status"><Loader2 className="spin" size={24} /><strong>{label}</strong></main>;
}

function Unauthorized() {
  return <main className="bam-admin-denied"><ShieldAlert size={42} /><h1>Admin access required</h1><p>This dashboard is restricted to administrator and instructor roles. Sign in with an authorized Supabase account or use the existing founder-admin approval flow.</p></main>;
}

function ErrorState({ message }: { message: string }) {
  return <main className="bam-admin-denied"><AlertTriangle size={42} /><h1>Admin dashboard unavailable</h1><p>{message}</p></main>;
}

export function BareActAdminDashboardPage() {
  const ui = useAdminUi();
  const access = useAdminAccess();
  const dashboard = useAdminDashboard();
  const mutations = useAdminMutations();

  if (access.isLoading) return <LoadingState label="Checking administrator permissions" />;
  if (!access.data?.allowed) return <Unauthorized />;
  if (dashboard.isLoading) return <LoadingState label="Loading mentor operations data" />;
  if (dashboard.isError || !dashboard.data) return <ErrorState message={dashboard.error instanceof Error ? dashboard.error.message : 'Unable to load admin records.'} />;

  const data = dashboard.data;
  return (
    <AdminLayout view={ui.view} onView={ui.setView} query={ui.query} onQuery={ui.setQuery} range={ui.range} onRange={ui.setRange}>
      <Suspense fallback={<LoadingState label="Loading admin section" />}>
        {ui.view === 'overview' && <OverviewSection data={data} />}
        {ui.view === 'students' && <StudentsSection data={data} query={ui.query} mutations={mutations} />}
        {ui.view === 'curriculum' && <CurriculumSection data={data} mutations={mutations} />}
        {ui.view === 'patterns' && <PatternSection data={data} query={ui.query} mutations={mutations} />}
        {ui.view === 'bareActs' && <BareActSection data={data} query={ui.query} mutations={mutations} />}
        {ui.view === 'ai' && <AiSection data={data} />}
        {ui.view === 'queues' && <QueueSection data={data} mutations={mutations} />}
        {ui.view === 'analytics' && <AnalyticsSection data={data} />}
        {ui.view === 'settings' && <SettingsSection data={data} mutations={mutations} />}
        {ui.view === 'audit' && <AuditSection data={data} query={ui.query} />}
        {ui.view === 'roles' && <RoleSection data={data} mutations={mutations} />}
        {ui.view === 'notifications' && <NotificationSection data={data} mutations={mutations} />}
      </Suspense>
    </AdminLayout>
  );
}
