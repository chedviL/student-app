-- שחזור 74 תאריכי תחילת גבייה ל-20.08.2026 (תלמידים שחויבו אוטומטית מאוגוסט 2026 ותאריכם נמחק)
BEGIN;
DO $$
DECLARE
  ids uuid[] := ARRAY[
    '0efc8a88-a67c-4f58-a7f3-42ef033ebac0',
    '1013f87e-6353-4d7e-974a-34c01813a168',
    '137d2660-6953-46f1-9467-b67a38ad9124',
    '1395f15f-4924-4dff-9fe9-338f0af2aba4',
    '179f2e61-e7bb-4ff4-8930-da38b19516e6',
    '199b6d20-d59b-4791-b992-fc1365ba241a',
    '19a34fad-1bf2-4125-94f4-3388ab167a67',
    '19e44c7f-e48e-4a47-9e84-96392e1666b8',
    '1c49ed44-fc17-41fa-a385-90eb4d319950',
    '1dc8758f-2e5a-40d7-8c3b-fa54e90d14a0',
    '1e204f28-d69e-4581-bc50-617875be0994',
    '1f17cc8c-c6ab-4398-9c8e-8905a94152fb',
    '29144157-9342-4267-b1f8-20117e3e7a46',
    '2a7e63be-f3ea-4ea9-a9c6-ee6e044f9a9c',
    '2ad2a1ee-7481-4b0e-a86e-7e5cc24e3f12',
    '2c032359-f975-4d61-81c6-50afc5ad84d8',
    '325af694-d913-497c-93b6-393de7282962',
    '389f2bea-4487-496f-bb39-4254c5b1c794',
    '3c816883-02f1-455e-a7df-db525f7e3d8e',
    '3d5a4ef8-1081-46c0-8997-cfbd9cb29662',
    '3e3e0b95-6a91-4c31-ac36-c556416c27fb',
    '3f005b4b-6d60-4d55-9b6f-8a7ec3010d40',
    '40f91654-28c8-4aab-a655-31879c0235d0',
    '4147079b-b2a6-4063-a8ab-423815e5ac96',
    '41e2589b-7549-452f-baa3-d0dbb06f79f6',
    '439a1ae4-33f5-4243-855f-df5b2f8a36de',
    '4d958063-de25-41ed-a827-681537d5740f',
    '536829d6-5b05-4397-8d99-1212fa499692',
    '5eb9dd56-bb68-4202-89da-76db88e44169',
    '5f7f867e-16b9-4234-9b35-a19f9345435e',
    '62cef4a9-3b2b-45fa-8831-a326140f53c2',
    '6547fed7-8272-464e-a7e9-59fa8c2d0356',
    '68de3f5d-0239-4109-a000-7968d96d1ce4',
    '69a9674e-f3b4-47ef-8f77-e38a41c75c95',
    '69c8ef52-93fb-4808-8dab-6f327a37022e',
    '6d45f61b-42de-4d9e-b14b-2d6816e286c3',
    '6dd4d7bc-3713-4fae-aadc-49b31edeeb76',
    '787066cc-6003-41e3-ac93-c06a276d2887',
    '7d22520e-a25b-4891-ad14-52dea8bb3aa9',
    '80e89f26-2ec8-4376-bb90-a9514a8a822a',
    '884e2e9d-6a85-4fc4-9ffc-110a6585356e',
    '8ee49062-3d3f-43e3-be5e-1ed9420845d6',
    '9c86d355-a76c-4c6f-a88b-a6bc26e9ce6a',
    '9fec856f-b15b-4adc-9bf8-8aaea7e98967',
    'a1414718-14e7-4eea-abfc-7c48f8dab629',
    'a145c25a-6357-420d-a51a-0e52d6ca2556',
    'a1ddeef9-256b-43cc-a9b9-2d791e667097',
    'a2670d88-908a-4e29-a94d-bff8dfc3e044',
    'a2c8092e-5e80-461d-9086-d5a1b11142b2',
    'ae8f92ef-06ba-420f-a00e-436ee8dd8dc7',
    'b595ee9f-a389-41b9-afb0-88f4b344eeef',
    'c00e1c33-e8df-4716-b0d0-8101ae9937d4',
    'c1cf99f9-a345-4e0f-ac2d-9c160df49515',
    'c2fdb5de-3e1b-429e-8b22-2192b66049d3',
    'c702dd5e-5d89-42a9-8887-b303c180c264',
    'cbf77040-850e-42e4-9890-d56d08c1c475',
    'ccc72536-d088-46c5-917e-62ea3ea391f9',
    'cf0acd62-1ea3-4231-a485-9eb57f475a55',
    'd0aa936b-3df3-4992-9d6a-c8f3a08ac238',
    'd559a04c-c31c-4f92-a119-d7043c133679',
    'd57624e9-7f6e-44ca-a94c-8fe89beac064',
    'd80ab3e5-4113-4a5d-9384-456eaabd3166',
    'de298541-569d-4861-8a05-ff4b9fa2f0d1',
    'e32b4092-7068-43ca-b177-a61dc90a2a48',
    'e333a2ce-9f87-44be-8705-c3016011b12a',
    'e3e020cd-87e2-4fe3-96a8-4fe5cbe52478',
    'e544a694-862d-4384-9f7e-c68f936a2898',
    'f1ff1e11-a801-4247-895a-21757208e309',
    'f4d9f6e1-d50d-4314-b0de-9460919beefb',
    'f59663a7-8153-4d5b-8434-8eb6f88738fb',
    'f7a8b97d-e092-4d0c-9c0a-f5ebd4a9326c',
    'fab9fbc4-25d8-40f7-b9ec-7c7c6e0e7eb0',
    'fbe61345-675e-4857-bf51-08c07540fd17',
    'fc5ba944-ae99-4a16-a079-bd0a5959fb7b'
  ]::uuid[];
  n_updated  integer;
  n_restored integer;
BEGIN
  IF cardinality(ids) <> 74 THEN RAISE EXCEPTION 'expected 74 ids, got %', cardinality(ids); END IF;
  UPDATE public.students SET tuition_start_date = DATE '2026-08-20'
   WHERE id = ANY (ids) AND tuition_start_date IS NULL;
  GET DIAGNOSTICS n_updated = ROW_COUNT;
  SELECT count(*) INTO n_restored FROM public.students
   WHERE id = ANY (ids) AND tuition_start_date = DATE '2026-08-20';
  IF n_restored <> 74 THEN
    RAISE EXCEPTION 'expected 74 students with 2026-08-20, found % (updated now: %) — rolled back', n_restored, n_updated;
  END IF;
  RAISE NOTICE 'updated now: %, students with restored date: %', n_updated, n_restored;
END $$;
COMMIT;
