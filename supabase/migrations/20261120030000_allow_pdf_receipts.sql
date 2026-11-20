-- El frontend permite adjuntar recibos en PDF (hasta 5 MB). Alinea el bucket y
-- la tabla de imágenes con ese contrato. Las fotos siguen comprimiéndose a 1.5 MB.

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    file_size_limit = 5242880
where id = 'receipts';

alter table public.expense_images drop constraint if exists expense_images_mime_type_check;
alter table public.expense_images add constraint expense_images_mime_type_check
  check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'));
