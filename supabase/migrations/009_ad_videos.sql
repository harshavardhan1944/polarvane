-- Private storage for ad videos uploaded to the Video ad checker.
-- Each user can only touch files inside their own folder (<user id>/...).
-- Videos are deleted right after the check finishes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-videos', 'ad-videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Own ad videos: upload" on storage.objects;
create policy "Own ad videos: upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ad-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own ad videos: read" on storage.objects;
create policy "Own ad videos: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'ad-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own ad videos: delete" on storage.objects;
create policy "Own ad videos: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ad-videos' and (storage.foldername(name))[1] = auth.uid()::text);
