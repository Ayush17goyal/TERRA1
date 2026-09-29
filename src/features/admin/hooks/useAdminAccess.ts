import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../services/AdminApi';

export function useAdminAccess() {
  return useQuery({ queryKey: ['bare-act-admin', 'access'], queryFn: () => adminApi.getAccess(), staleTime: 30_000 });
}
