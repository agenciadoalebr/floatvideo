-- =========================================================================
-- Migration: 0003_storage_videos_bucket
-- Cria o bucket "videos" no Supabase Storage (usado como storage + CDN dos
-- vídeos, no lugar de um provedor externo como R2/S3 — simplifica o setup
-- inicial; pode ser trocado depois sem mudar o schema de `videos`).
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 524288000, array['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "public can read videos bucket"
  on storage.objects for select
  to public
  using (bucket_id = 'videos');

create policy "authenticated users can upload their own videos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authenticated users can update their own videos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authenticated users can delete their own videos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
