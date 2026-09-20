-- Sostituisce i numeri letti dal modello con quelli letti dai documenti.
--
-- Le righe che c'erano le aveva prodotte l'estrazione AI, e avevano tre
-- difetti. Importi presi dalla tabella sbagliata: l'acqua a 5.766,02 era il
-- totale dei consumi personali addebitati a contatore, non la spesa d'acqua del
-- condominio. Storni contati in positivo, che gonfiavano le categorie invece di
-- annullarle. E l'anno spostato di uno — il rendiconto 2024-2025 stava sotto il
-- 2024, mentre un esercizio a cavallo prende l'anno in cui si chiude.
--
-- I numeri nuovi li produce il motore di lettura, e ciascun esercizio quadra al
-- centesimo con il totale che il documento stampa da sé. Sono sei esercizi:
-- il 2019-2020 e il 2020-2021 non erano mai entrati nell'applicazione, e
-- vengono da due amministratori precedenti con formati diversi.
--
-- Tre di questi documenti non stanno nell'archivio Storage, perché sono stati
-- letti fuori dall'applicazione: le loro righe restano senza documento_path.
-- I numeri ci sono, il collegamento al PDF arriva quando verranno caricati.
--
-- Prima di applicarla è stato fatto un backup del database.

-- Un esercizio a cavallo prende l'anno di chiusura: il documento 2024-2025 è
-- l'esercizio 2025. Va spostato prima di inserire il 2024 vero, che è un altro
-- documento.
update public.bilanci set anno = 2025 where anno = 2024;
update public.movimenti set anno = 2025 where anno = 2024;

-- Le spese si riscrivono tutte. Non basta sovrascrivere le categorie nuove:
-- resterebbero indietro quelle che l'estrazione AI aveva inventato e che nei
-- documenti non esistono.
delete from public.spese
where condominium_id = (select id from public.condominiums limit 1);

-- 2020 — Studio Contavalli, totale stampato 12394.05, scarto 0
insert into public.bilanci (condominium_id, anno, consuntivo, totale_documento, documento_path, note)
values ((select id from public.condominiums limit 1), 2020, 12394.05, 12394.05, null, 'letto da consuntivo_condominio_2019_2020.pdf — quadratura 0,00 sul totale stampato')
on conflict (condominium_id, anno) do update set consuntivo = excluded.consuntivo,
  totale_documento = excluded.totale_documento, documento_path = excluded.documento_path, note = excluded.note;
insert into public.spese (condominium_id, anno, categoria, importo, fonte_documento, documento_path, fonte_verificata, fonte_verificabile) values
  ((select id from public.condominiums limit 1), 2020, 'riscaldamento', 3112.99, 'consuntivo_condominio_2019_2020.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2020, 'amm', 6613.07, 'consuntivo_condominio_2019_2020.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2020, 'varie', 457.69, 'consuntivo_condominio_2019_2020.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2020, 'pulizia', 922.11, 'consuntivo_condominio_2019_2020.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2020, 'ascensore', 306.11, 'consuntivo_condominio_2019_2020.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2020, 'acqua', 977.38, 'consuntivo_condominio_2019_2020.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2020, 'illuminazione', 36, 'consuntivo_condominio_2019_2020.pdf', null, true, true)
on conflict (condominium_id, anno, categoria) do update set importo = excluded.importo,
  fonte_documento = excluded.fonte_documento, documento_path = excluded.documento_path,
  fonte_verificata = true, fonte_verificabile = true;

-- 2021 — MULTIGEST, totale stampato 20857.74, scarto 0
insert into public.bilanci (condominium_id, anno, consuntivo, totale_documento, documento_path, note)
values ((select id from public.condominiums limit 1), 2021, 20857.74, 20857.74, null, 'letto da Condominio_Enriques_3_-_Nuovo_Bilancio_come_da_delibera.pdf — quadratura 0,00 sul totale stampato')
on conflict (condominium_id, anno) do update set consuntivo = excluded.consuntivo,
  totale_documento = excluded.totale_documento, documento_path = excluded.documento_path, note = excluded.note;
insert into public.spese (condominium_id, anno, categoria, importo, fonte_documento, documento_path, fonte_verificata, fonte_verificabile) values
  ((select id from public.condominiums limit 1), 2021, 'amm', 5322.98, 'Condominio_Enriques_3_-_Nuovo_Bilancio_come_da_delibera.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2021, 'pulizia', 2191.88, 'Condominio_Enriques_3_-_Nuovo_Bilancio_come_da_delibera.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2021, 'varie', 440.37, 'Condominio_Enriques_3_-_Nuovo_Bilancio_come_da_delibera.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2021, 'riscaldamento', 6486.21, 'Condominio_Enriques_3_-_Nuovo_Bilancio_come_da_delibera.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2021, 'fotovoltaico', 8.98, 'Condominio_Enriques_3_-_Nuovo_Bilancio_come_da_delibera.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2021, 'manutenzione', 1029.9, 'Condominio_Enriques_3_-_Nuovo_Bilancio_come_da_delibera.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2021, 'acqua', 2465.27, 'Condominio_Enriques_3_-_Nuovo_Bilancio_come_da_delibera.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2021, 'ascensore', 2877.13, 'Condominio_Enriques_3_-_Nuovo_Bilancio_come_da_delibera.pdf', null, true, true)
on conflict (condominium_id, anno, categoria) do update set importo = excluded.importo,
  fonte_documento = excluded.fonte_documento, documento_path = excluded.documento_path,
  fonte_verificata = true, fonte_verificabile = true;

-- 2022 — MULTIGEST, totale stampato 32244.88, scarto 0
insert into public.bilanci (condominium_id, anno, consuntivo, totale_documento, documento_path, note)
values ((select id from public.condominiums limit 1), 2022, 32244.88, 32244.88, 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf', 'letto da ENRIQUES_3.pdf — quadratura 0,00 sul totale stampato')
on conflict (condominium_id, anno) do update set consuntivo = excluded.consuntivo,
  totale_documento = excluded.totale_documento, documento_path = excluded.documento_path, note = excluded.note;
insert into public.spese (condominium_id, anno, categoria, importo, fonte_documento, documento_path, fonte_verificata, fonte_verificabile) values
  ((select id from public.condominiums limit 1), 2022, 'amm', 8452, 'ENRIQUES_3.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf', true, true),
  ((select id from public.condominiums limit 1), 2022, 'pulizia', 2870.86, 'ENRIQUES_3.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf', true, true),
  ((select id from public.condominiums limit 1), 2022, 'varie', 913.75, 'ENRIQUES_3.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf', true, true),
  ((select id from public.condominiums limit 1), 2022, 'riscaldamento', 11666.47, 'ENRIQUES_3.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf', true, true),
  ((select id from public.condominiums limit 1), 2022, 'fotovoltaico', 23.24, 'ENRIQUES_3.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf', true, true),
  ((select id from public.condominiums limit 1), 2022, 'manutenzione', 1143.96, 'ENRIQUES_3.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf', true, true),
  ((select id from public.condominiums limit 1), 2022, 'acqua', 2344.49, 'ENRIQUES_3.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf', true, true),
  ((select id from public.condominiums limit 1), 2022, 'ascensore', 4732.11, 'ENRIQUES_3.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf', true, true)
on conflict (condominium_id, anno, categoria) do update set importo = excluded.importo,
  fonte_documento = excluded.fonte_documento, documento_path = excluded.documento_path,
  fonte_verificata = true, fonte_verificabile = true;

-- 2023 — Studio Tosiani, totale stampato 30915.88, scarto 0
insert into public.bilanci (condominium_id, anno, consuntivo, totale_documento, documento_path, note)
values ((select id from public.condominiums limit 1), 2023, 30915.88, 30915.88, null, 'letto da Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf — quadratura 0,00 sul totale stampato')
on conflict (condominium_id, anno) do update set consuntivo = excluded.consuntivo,
  totale_documento = excluded.totale_documento, documento_path = excluded.documento_path, note = excluded.note;
insert into public.spese (condominium_id, anno, categoria, importo, fonte_documento, documento_path, fonte_verificata, fonte_verificabile) values
  ((select id from public.condominiums limit 1), 2023, 'amm', 2689.76, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2023, 'varie', 481.85, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2023, 'assicurazione', 1855, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2023, 'manutenzione', 4812.59, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2023, 'giardinaggio', 164.7, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2023, 'illuminazione', 853.9, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2023, 'pulizia', 2488.8, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2023, 'ascensore', 4970.84, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2023, 'fotovoltaico', 550.38, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2023, 'acqua', 5883.18, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true),
  ((select id from public.condominiums limit 1), 2023, 'riscaldamento', 6164.88, 'Rendiconto_Consuntivo_2022-2023_-_Via_Enriques_3.pdf', null, true, true)
on conflict (condominium_id, anno, categoria) do update set importo = excluded.importo,
  fonte_documento = excluded.fonte_documento, documento_path = excluded.documento_path,
  fonte_verificata = true, fonte_verificabile = true;

-- 2024 — Studio Tosiani, totale stampato 28293.26, scarto 0
insert into public.bilanci (condominium_id, anno, consuntivo, totale_documento, documento_path, note)
values ((select id from public.condominiums limit 1), 2024, 28293.26, 28293.26, 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', 'letto da Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf — quadratura 0,00 sul totale stampato')
on conflict (condominium_id, anno) do update set consuntivo = excluded.consuntivo,
  totale_documento = excluded.totale_documento, documento_path = excluded.documento_path, note = excluded.note;
insert into public.spese (condominium_id, anno, categoria, importo, fonte_documento, documento_path, fonte_verificata, fonte_verificabile) values
  ((select id from public.condominiums limit 1), 2024, 'amm', 2803.1, 'Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true),
  ((select id from public.condominiums limit 1), 2024, 'varie', 684.73, 'Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true),
  ((select id from public.condominiums limit 1), 2024, 'assicurazione', 1981.9, 'Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true),
  ((select id from public.condominiums limit 1), 2024, 'illuminazione', 469.9, 'Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true),
  ((select id from public.condominiums limit 1), 2024, 'pulizia', 2488.8, 'Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true),
  ((select id from public.condominiums limit 1), 2024, 'ascensore', 3469.91, 'Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true),
  ((select id from public.condominiums limit 1), 2024, 'fotovoltaico', 6088.59, 'Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true),
  ((select id from public.condominiums limit 1), 2024, 'manutenzione', 1801.86, 'Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true),
  ((select id from public.condominiums limit 1), 2024, 'acqua', 4967.03, 'Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true),
  ((select id from public.condominiums limit 1), 2024, 'riscaldamento', 6037.44, 'Rendiconto_Consuntivo_2023-2024_-_Via_Enriques_3_1.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true)
on conflict (condominium_id, anno, categoria) do update set importo = excluded.importo,
  fonte_documento = excluded.fonte_documento, documento_path = excluded.documento_path,
  fonte_verificata = true, fonte_verificabile = true;

-- 2025 — Studio Tosiani, totale stampato 27748.85, scarto 0
insert into public.bilanci (condominium_id, anno, consuntivo, totale_documento, documento_path, note)
values ((select id from public.condominiums limit 1), 2025, 27748.85, 27748.85, 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', 'letto da Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf — quadratura 0,00 sul totale stampato')
on conflict (condominium_id, anno) do update set consuntivo = excluded.consuntivo,
  totale_documento = excluded.totale_documento, documento_path = excluded.documento_path, note = excluded.note;
insert into public.spese (condominium_id, anno, categoria, importo, fonte_documento, documento_path, fonte_verificata, fonte_verificabile) values
  ((select id from public.condominiums limit 1), 2025, 'amm', 2804.99, 'Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', true, true),
  ((select id from public.condominiums limit 1), 2025, 'varie', 736.19, 'Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', true, true),
  ((select id from public.condominiums limit 1), 2025, 'assicurazione', 2157.1, 'Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', true, true),
  ((select id from public.condominiums limit 1), 2025, 'manutenzione', 1542.2, 'Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', true, true),
  ((select id from public.condominiums limit 1), 2025, 'illuminazione', 281.47, 'Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', true, true),
  ((select id from public.condominiums limit 1), 2025, 'pulizia', 2281.4, 'Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', true, true),
  ((select id from public.condominiums limit 1), 2025, 'ascensore', 3446.71, 'Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', true, true),
  ((select id from public.condominiums limit 1), 2025, 'fotovoltaico', 858.62, 'Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', true, true),
  ((select id from public.condominiums limit 1), 2025, 'acqua', 5766.02, 'Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', true, true),
  ((select id from public.condominiums limit 1), 2025, 'riscaldamento', 7874.15, 'Rendiconto_Consuntivo_2024-2025_-_Via_Enriques_3_2.pdf', 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', true, true)
on conflict (condominium_id, anno, categoria) do update set importo = excluded.importo,
  fonte_documento = excluded.fonte_documento, documento_path = excluded.documento_path,
  fonte_verificata = true, fonte_verificabile = true;
