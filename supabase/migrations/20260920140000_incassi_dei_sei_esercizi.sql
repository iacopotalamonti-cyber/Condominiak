-- Le partite di singoli condomini dei sei esercizi già caricati.
--
-- Sono la differenza, finora inspiegata, fra le voci di spesa e il totale
-- stampato sul rendiconto. Vale per tutte: spese = totale stampato - incassi.
--
--   2020   12.425,35 = 12.394,05 -   (31,30)   spese personali riaddebitate
--   2021   20.822,72 = 20.857,74 -     35,02   spese personali riaddebitate
--   2022   32.146,88 = 32.244,88 -     98,00   spese personali riaddebitate
--   2023   30.915,88 = 30.915,88            —
--   2024   30.793,26 = 28.293,26 - (2.500,00) rimborso assicurativo incassato
--   2025   27.748,85 = 27.748,85            —
--
-- Il totale stampato resta dov'è, in bilanci.totale_documento: è la cifra che
-- il condomino ritrova sulla carta, e non va riscritta. Da qui in poi
-- l'applicazione sa leggerla insieme a queste righe, invece di segnalare che
-- 2.500 € sono contati due volte.

insert into public.incassi
  (condominium_id, anno, descrizione, importo, codice,
   fonte_documento, fonte_verificata, fonte_verificabile, note)
values
  ((select id from public.condominiums limit 1), 2020,
   'Spese personali riaddebitate ai singoli condomini', -31.30, 'Spese personali',
   'consuntivo_condominio_2019_2020.pdf', true, true,
   'Il documento sottrae questa partita dal totale: le spese comuni sono 12.425,35 contro i 12.394,05 stampati.'),

  ((select id from public.condominiums limit 1), 2021,
   'Spese personali riaddebitate ai singoli condomini', 35.02, '12',
   'Condominio_Enriques_3_-_Nuovo_Bilancio_come_da_delibera.pdf', true, true,
   'Il documento somma questa partita al totale: le spese comuni sono 20.822,72 contro i 20.857,74 stampati.'),

  ((select id from public.condominiums limit 1), 2022,
   'Spese personali riaddebitate ai singoli condomini', 98.00, '12',
   'ENRIQUES_3.pdf', true, true,
   'Il documento somma questa partita al totale: le spese comuni sono 32.146,88 contro i 32.244,88 stampati.'),

  ((select id from public.condominiums limit 1), 2024,
   'Rimborsi assicurativi generali proprietà', -2500.00, '008.002',
   'Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', true, true,
   'Rimborso di un sinistro incassato dal condominio. Il documento lo sottrae dalle spese: spese comuni 30.793,26 contro i 28.293,26 stampati.')

on conflict (condominium_id, anno, descrizione) do update set
  importo = excluded.importo,
  codice = excluded.codice,
  fonte_documento = excluded.fonte_documento,
  fonte_verificata = excluded.fonte_verificata,
  fonte_verificabile = excluded.fonte_verificabile,
  note = excluded.note;
