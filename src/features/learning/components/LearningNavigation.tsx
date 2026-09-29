import { Award, BarChart3, Bell, BookOpen, CheckSquare, ClipboardCheck, FileText, Flag, GraduationCap, LayoutDashboard, MessageSquare, PenLine, Settings, Target } from 'lucide-react';
import type { LearningView } from '../types/learning.types';

const nav: Array<{ id: LearningView | 'drafting' | 'mentor'; label: string; href?: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'curriculum', label: 'Curriculum', icon: BookOpen },
  { id: 'lesson', label: 'Lessons', icon: GraduationCap },
  { id: 'drafting', label: 'Drafting Workspace', href: '/bare-act-drafting', icon: PenLine },
  { id: 'mentor', label: 'Drafting Journey', href: '/bare-act-mentor', icon: MessageSquare },
  { id: 'assessment', label: 'Assessments', icon: ClipboardCheck },
  { id: 'quiz', label: 'Quizzes', icon: CheckSquare },
  { id: 'capstone', label: 'Capstone', icon: Flag },
  { id: 'mastery', label: 'Mastery', icon: Award },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function LearningNavigation({ active, onNavigate }: { active: LearningView; onNavigate(view: LearningView): void }) {
  return (
    <nav className="learning-nav" aria-label="Bare Act Mentor learning navigation">
      <header><Target size={18} /><div><strong>Bare Act Mentor</strong><span>Learning Platform</span></div></header>
      {nav.map((item) => {
        const Icon = item.icon;
        if (item.href) return <a key={item.id} href={item.href}><Icon size={16} />{item.label}</a>;
        return <button key={item.id} type="button" className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id as LearningView)}><Icon size={16} />{item.label}</button>;
      })}
    </nav>
  );
}


