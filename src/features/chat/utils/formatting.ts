export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function readableBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function workflowLabel(state?: string): string {
  switch (state) {
    case 'PENDING': return 'Preparing your request...';
    case 'RUNNING': return 'Understanding your request...';
    case 'WAITING_FOR_LLM': return 'Generating educational feedback...';
    case 'VALIDATING': return 'Validating response...';
    case 'UPDATING_PROGRESS': return 'Updating learning progress...';
    case 'COMPLETED': return 'Completed.';
    case 'FAILED': return 'The workflow could not finish.';
    case 'CANCELLED': return 'Generation stopped.';
    default: return 'Ready.';
  }
}

export function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ['.pdf', '.docx', '.txt', '.md', '.markdown'].some((suffix) => name.endsWith(suffix));
}

