-- ביטול התאריך 20.08.2026 אצל 21 תלמידים שהתאריך שלהם לא אושר עסקית (4 B + 17 ללא שכ"ל/מטבע)
-- מחזיר ל-NULL רק אם התאריך עדיין 20.08.2026. הטריגר של v5 מתיר זאת רק ל-postgres (SQL Editor), ומתעד.
BEGIN;
DO $$
DECLARE
  ids uuid[] := ARRAY[
    '04945423-3ea0-4d9a-b2ad-0d9366ea10dd',
    '132f755c-c9d3-4326-b0bd-e28d06445f39',
    '19430cce-1f4d-4280-8b87-11d0d3ce72dd',
    '1eb95a5f-41e5-4777-9b81-451b7f261c08',
    '213c71b3-7b6e-4b31-b717-e28f9252194c',
    '2bc62d7a-f92d-4d43-b560-5a6453b2a919',
    '2edab336-70b5-46ff-b597-060b69718345',
    '330560d4-91f2-4b5a-9556-49a32f019d32',
    '3efe99e9-0ce7-48f1-b4ee-d00b4dd32c4e',
    '501fe5ba-d2a3-44be-a348-39b9aca09901',
    '5ca8bf6d-5ba2-4210-966e-afe7ae3260ea',
    '5f253de5-40be-4111-9e69-ab225aa15d1a',
    '71c0b95c-b6a3-4fcd-a6cc-f3865adb99ac',
    '72f89f9d-b7f7-485b-82af-b302ea97eb01',
    '9150a8c2-305c-4358-a7ab-9f38a41d960b',
    '95123b15-69d0-403c-86c0-e1f6b40af591',
    '97d29168-9741-4655-b3c0-108c16182fcd',
    'd75f6608-b648-41ea-95a0-d2d964e71a1b',
    'db138d62-a0cd-4471-9be1-175dc98e2c3c',
    'e9e6caf4-b75a-4871-807d-8dd9fadcb869',
    'fd6ba8c2-37de-4c5b-aa87-bb2ec3ba8c83'
  ]::uuid[];
  n integer;
BEGIN
  IF cardinality(ids) <> 21 THEN RAISE EXCEPTION 'expected 21 ids, got %', cardinality(ids); END IF;
  UPDATE public.students SET tuition_start_date = NULL
   WHERE id = ANY (ids) AND tuition_start_date = DATE '2026-08-20';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 21 THEN RAISE EXCEPTION 'expected to revert 21, would revert % — rolled back', n; END IF;
  RAISE NOTICE 'reverted: %', n;
END $$;
COMMIT;
