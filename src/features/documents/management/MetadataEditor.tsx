import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { ManagedDocument } from '../types/document.types';
import { documentMetadataSchema } from '../services/DocumentManagementApi';

type MetadataForm = { title: string; description?: string; tagsText: string; category: string; moduleId?: string; lessonId?: string; visibility: 'private' | 'course' | 'platform' };

export function MetadataEditor({ document, onSave }: { document?: ManagedDocument; onSave(id: string, patch: Partial<ManagedDocument>): void }) {
  const form = useForm<MetadataForm>();
  useEffect(() => { if (document) form.reset({ title: document.title, description: document.description, tagsText: document.tags.join(', '), category: document.category, moduleId: document.moduleId, lessonId: document.lessonId, visibility: document.visibility }); }, [document, form]);
  if (!document) return <section className="metadata-editor"><strong>Metadata</strong><p>No document selected.</p></section>;
  return (
    <section className="metadata-editor" aria-label="Metadata management"><header><strong>Metadata</strong></header><form onSubmit={form.handleSubmit((values) => {
      const patch = { title: values.title, description: values.description, tags: values.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean), category: values.category, moduleId: values.moduleId, lessonId: values.lessonId, visibility: values.visibility };
      documentMetadataSchema.parse(patch);
      onSave(document.id, patch);
    })}><label>Title<input {...form.register('title', { required: true })} /></label><label>Description<textarea {...form.register('description')} /></label><label>Tags<input {...form.register('tagsText')} /></label><label>Category<input {...form.register('category', { required: true })} /></label><label>Module<input {...form.register('moduleId')} /></label><label>Lesson<input {...form.register('lessonId')} /></label><label>Visibility<select {...form.register('visibility')}><option value="private">Private</option><option value="course">Course</option><option value="platform">Platform</option></select></label><button type="submit">Save metadata</button></form></section>
  );
}
