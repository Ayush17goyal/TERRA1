import { useMemo, useState } from 'react';
import type { AdminView } from '../types/admin.types';

export function useAdminUi() {
  const [view, setView] = useState<AdminView>('overview');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'all'>('30d');
  return useMemo(() => ({ view, setView, query, setQuery, range, setRange }), [query, range, view]);
}
