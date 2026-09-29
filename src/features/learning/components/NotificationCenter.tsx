import { Bell, CheckCircle2 } from 'lucide-react';
import type { LearningNotification } from '../types/learning.types';
import { LearningCard } from '../components/LearningCard';

export function NotificationCenter({ notifications }: { notifications: LearningNotification[] }) {
  return <LearningCard title="Notifications" icon={<Bell size={17} />}><div className="learning-notifications">{notifications.map((notification) => <article key={notification.id} className={notification.read ? 'read' : 'unread'}><header><strong>{notification.title}</strong><span>{notification.kind}</span></header><p>{notification.body}</p>{notification.actionHref ? <a href={notification.actionHref}>Open</a> : <CheckCircle2 size={15} />}</article>)}</div></LearningCard>;
}
