import { useQuery } from '@tanstack/react-query';
import { documentManagementApi } from '../services/DocumentManagementApi';

export function useDocumentBackendHints() {
  return useQuery({
    queryKey: ['bare-act-documents', 'backend-hints'],
    queryFn: () => documentManagementApi.loadBackendHints(),
    staleTime: 60_000,
    retry: 1,
  });
}
