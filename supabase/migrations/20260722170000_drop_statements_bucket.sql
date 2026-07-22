-- The app no longer stores statement PDFs at all (confirmStatementImport
-- dropped its Storage upload — see the amended design spec §3.1). The
-- `statements` bucket and its objects were removed manually against the
-- live project; this migration keeps a from-scratch environment in sync
-- with that reality instead of recreating a bucket nothing ever writes to.
drop policy if exists "statements bucket: owner read" on storage.objects;
drop policy if exists "statements bucket: owner insert" on storage.objects;
drop policy if exists "statements bucket: owner update" on storage.objects;
drop policy if exists "statements bucket: owner delete" on storage.objects;

delete from storage.objects where bucket_id = 'statements';
delete from storage.buckets where id = 'statements';
