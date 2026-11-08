-- tiny assertion helpers (included by each test with \i)
CREATE OR REPLACE FUNCTION pg_temp.check(ok boolean, label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RETURN 'ok ' || label;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.eq(actual anyelement, expected anyelement, label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAILED: % — expected %, got %', label, expected, actual;
  END IF;
  RETURN 'ok ' || label;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.raises(stmt text, label text, as_role text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'ok ' || label || ' (' || left(SQLERRM, 80) || ')';
  END;
  RAISE EXCEPTION 'FAILED: % — statement did not raise', label;
END $$;
\pset tuples_only on
\pset format unaligned
