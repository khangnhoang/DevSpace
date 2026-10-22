-- The baseline is the whole pre-H1 schema, so undoing it would drop production tables and data.
-- It is recorded on hosted only through `migration repair`; a revert is `--status reverted`, never this file.
do $$
begin
  raise exception 'The baseline migration 20261021000000 cannot be rolled back.';
end;
$$;
