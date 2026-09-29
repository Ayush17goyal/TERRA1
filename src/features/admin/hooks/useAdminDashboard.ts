import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/AdminApi';
import type { AdminSettings } from '../types/admin.types';

const dashboardKey = ['bare-act-admin', 'dashboard'];

export function useAdminDashboard() {
  return useQuery({ queryKey: dashboardKey, queryFn: () => adminApi.getDashboard(), refetchInterval: 45_000, staleTime: 20_000 });
}

export function useAdminMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: dashboardKey });
  return {
    studentAction: useMutation({ mutationFn: ({ id, action }: { id: string; action: 'reset' | 'archive' }) => adminApi.updateStudent(id, action), onSuccess: invalidate }),
    saveModule: useMutation({ mutationFn: (input: any) => adminApi.saveModule(input), onSuccess: invalidate }),
    saveLesson: useMutation({ mutationFn: (input: any) => adminApi.saveLesson(input), onSuccess: invalidate }),
    savePattern: useMutation({ mutationFn: (input: any) => adminApi.savePattern(input), onSuccess: invalidate }),
    saveSettings: useMutation({ mutationFn: (input: AdminSettings) => adminApi.saveSettings(input), onSuccess: invalidate }),
    assignRole: useMutation({ mutationFn: (input: { email: string; role: any; permissions: string }) => adminApi.assignRole(input), onSuccess: invalidate }),
    publishNotification: useMutation({ mutationFn: (input: any) => adminApi.publishNotification(input), onSuccess: invalidate }),
    queueAction: useMutation({ mutationFn: ({ queueName, action }: { queueName: string; action: 'retry' | 'pause' | 'resume' | 'inspect' }) => adminApi.queueAction(queueName, action), onSuccess: invalidate }),
    reindexBareAct: useMutation({ mutationFn: (id: string) => adminApi.reindexBareAct(id), onSuccess: invalidate }),
  };
}
