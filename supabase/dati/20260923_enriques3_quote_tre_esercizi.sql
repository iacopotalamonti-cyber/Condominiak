-- Dati del condominio di via Enriques 3, Bologna (f0b9dfd6-8b20-460a-8b2c-86176f06caa9).
--
-- Era una migrazione: è stata applicata in produzione il giorno nel nome del
-- file, ed è qui come registro di cosa è stato scritto e perché. Non è
-- schema, e non deve girare su un database nuovo: i numeri di un condominio
-- non appartengono a nessun altro. Ogni riga nomina il condominio per id, e
-- se quel condominio non c'è il file si ferma prima di scrivere.
--
-- Prima, al posto dell'id c'era "(select id from public.condominiums limit 1)",
-- e alcune istruzioni non nominavano il condominio affatto: su un database con
-- due condomini avrebbe scritto su uno a caso e spostato gli esercizi di tutti.

do $$
begin
  if not exists (select 1 from public.condominiums where id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9') then
    raise exception 'Questo file è per il condominio di via Enriques 3 (f0b9dfd6-8b20-460a-8b2c-86176f06caa9): qui non esiste.';
  end if;
end $$;

-- Le quote dei tre esercizi Tosiani, e le 30 unità che l'anagrafica non
-- conosceva.
--
-- Tutto viene dal riparto stampato nei rendiconti, letto da src/lib/riparto.ts:
-- nessun numero è scritto a mano. Ogni esercizio quadra con la riga "Totali
-- Condominio" del proprio documento, colonna per colonna, e la somma delle
-- quote torna con il totale generale a meno delle righe di arrotondamento che
-- il documento stesso dichiara (-0,06 nel 2025, -0,02 nel 2024, -0,11 nel 2023).
--
-- Dopo questa migrazione i millesimi generali dell'anagrafica sommano 1000,000:
-- è la prova che non manca più nessuna unità.
--
-- Il backup completo di quel giorno non è riuscito: il registro di GitHub ha
-- rifiutato due volte il download dell'immagine di Postgres. La migrazione è
-- quasi tutta additiva, e per la parte che sovrascrive — i millesimi delle 14
-- unità che c'erano — il modo esatto di tornare indietro, con i valori di prima,
-- è in supabase/rollback/20260923110000_quote_tre_esercizi.sql. L'ultimo backup
-- completo riuscito è quello notturno del 23/09 alle 08:19.


-- Applicata in quattro blocchi, uno per le unità e uno per esercizio, perché
-- ciascuno fosse verificato prima del successivo: conteggio, collegamento alle
-- unità, coerenza di ogni riga con le sue colonne, somma per colonna contro la
-- riga "Totali Condominio" del documento.

-- Le 14 unità che c'erano ricevono codice, subalterno e millesimi a tre
-- decimali: il collegamento si fa su interno E nome, e se uno dei due non
-- corrisponde la riga non si aggiorna — la verifica dopo se ne accorge.
with c as (select id from public.condominiums where id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9'),
nuovi(interno, codice, sub, millesimi, nome) as (values
  (1,'001','32',79.065,'Arezzo - Petruccelli'),
  (2,'002','35',44.614,'Daloiso Cesare'),
  (3,'003','36',62.548,'Esposito - Salvato'),
  (4,'004','37',54.808,'Rota Claudia'),
  (5,'005','38',65.341,'La Ganga Federica'),
  (6,'006','39',57.86,'Ragazzini Luca'),
  (7,'007','40',81.188,'Arda - Battistella'),
  (8,'008','41',47.029,'Martignani - Biavati'),
  (9,'009','42',68.601,'Talamonti - Cappella'),
  (10,'010','43',61.625,'Marmocchi Matteo'),
  (11,'011','44',67.004,'Benni Stefano'),
  (12,'012','45',61.225,'D''Antonio Mauro'),
  (13,'013','46',123.4,'Turco Annunziata'),
  (14,'014','47',34.213,'Tinuper Anna Laura')
)
update public.unita u set codice = nuovi.codice, sub = nuovi.sub, millesimi = nuovi.millesimi
from nuovi, c
where u.condominium_id = c.id and u.interno = nuovi.interno and u.nome_proprietario = nuovi.nome;

-- Le 30 unità che l'anagrafica non conosceva: box, cantine, posti auto.
insert into public.unita (condominium_id, interno, codice, sub, tipologia, millesimi, nome_proprietario)
select c.id, null, v.codice, v.sub, v.tipologia, v.millesimi, v.nome
from (select id from public.condominiums where id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9') c,
(values
  ('015','31','box',5.322,'Arezzo - Petruccelli'),
  ('016','20','box',5.273,'Esposito - Salvato'),
  ('017','28','box',5.247,'Rota Claudia'),
  ('018','25','box',5.853,'Ragazzini Luca'),
  ('019','29','box',5.427,'Arda - Battistella'),
  ('020','24','box',5.034,'Talamonti - Cappella'),
  ('021','22','box',5.083,'Marmocchi Matteo'),
  ('022','26','box',5.158,'Benni Stefano'),
  ('023','30','box',5.263,'D''Antonio Mauro'),
  ('024','21','box',5.024,'Turco Annunziata'),
  ('025','23','box',5.067,'Tinuper Anna Laura'),
  ('026','27','box',5.175,'La Ganga Federica'),
  ('027','9','cantina',0.5,'Arezzo - Petruccelli'),
  ('028','10','cantina',0.452,'Rota Claudia'),
  ('029','15','cantina',0.566,'La Ganga Federica'),
  ('030','17','cantina',0.94,'Ragazzini Luca'),
  ('031','16','cantina',0.566,'Arda - Battistella'),
  ('032','19','cantina',0.332,'Martignani - Biavati'),
  ('033','11','cantina',0.395,'Talamonti - Cappella'),
  ('034','18','cantina',0.493,'Marmocchi Matteo'),
  ('035','8','cantina',0.484,'Benni Stefano'),
  ('036','14','cantina',0.566,'D''Antonio Mauro'),
  ('037','13','cantina',0.554,'Turco Annunziata'),
  ('038','12','cantina',0.554,'Tinuper Anna Laura'),
  ('039','7','cantina',0.484,'Esposito - Salvato'),
  ('040','52','posto_auto',4.253,'Arezzo - Petruccelli'),
  ('041','51','posto_auto',4.253,'Daloiso Cesare'),
  ('042','48','posto_auto',4.655,'Martignani - Biavati'),
  ('043','50','posto_auto',4.253,'Marmocchi Matteo'),
  ('044','49','posto_auto',4.253,'Tinuper Anna Laura')
) as v(codice, sub, tipologia, millesimi, nome)
on conflict (condominium_id, codice) where codice is not null do nothing;

-- 2025: 44 unità, 9 colonne, somma 27748.79
with c as (select id from public.condominiums where id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9'),
colonne as (select array['Millesimi Generali','Millesimi Scale e Ascensore','Millesimi Corsello Garage','Millesimi Generali Fotovoltaico','Millesimi Gen. NO Posti Auto','Millesimi Gen. Conduz. Appartamenti','Personali e Rimborsi','Spese Riscaldamento','Spese Raffr. - ACS - AFS']::text[] as nomi),
dati(codice, tipologia, nome, importi, millesimi, totale, pagina) as (values
  ('001','Appartamento','Arezzo - Petruccelli',array[509.25,230.77,null,69.39,31.29,16.99,44.43,594.8,292.11]::numeric[],array[79.065,40.408,null,79.065,79.065,79.065,null,null,null]::numeric[],1789.03,17),
  ('002','Appartamento','Daloiso Cesare',array[287.35,130.22,null,39.15,17.66,9.59,44.41,216.85,700.55]::numeric[],array[44.614,22.801,null,44.614,44.614,44.614,null,null,null]::numeric[],1445.78,17),
  ('003','Appartamento','Esposito - Salvato',array[402.86,242.9,null,54.89,24.75,13.44,0.02,957.26,593.4]::numeric[],array[62.548,42.532,null,62.548,62.548,62.548,null,null,null]::numeric[],2289.52,17),
  ('004','Appartamento','Rota Claudia',array[353.01,212.85,null,48.1,21.69,11.78,9.03,419.93,94.12]::numeric[],array[54.808,37.269,null,54.808,54.808,54.808,null,null,null]::numeric[],1170.51,17),
  ('005','Appartamento','La Ganga Federica',array[420.86,316.78,null,57.35,25.86,14.04,null,305.67,270.77]::numeric[],array[65.341,55.468,null,65.341,65.341,65.341,null,null,null]::numeric[],1411.33,17),
  ('006','Appartamento','Ragazzini Luca',array[372.67,280.5,null,50.78,22.9,12.43,0.07,609.91,723.41]::numeric[],array[57.86,49.116,null,57.86,57.86,57.86,null,null,null]::numeric[],2072.67,17),
  ('007','Appartamento','Arda - Battistella',array[522.92,471.92,null,71.25,32.13,17.44,0.02,468.08,62.84]::numeric[],array[81.188,82.633,null,81.188,81.188,81.188,null,null,null]::numeric[],1646.6,17),
  ('008','Appartamento','Martignani - Biavati',array[302.92,273.37,null,41.27,18.61,10.1,null,683.57,521.7]::numeric[],array[47.029,47.866,null,47.029,47.029,47.029,null,null,null]::numeric[],1851.54,17),
  ('009','Appartamento','Talamonti - Cappella',array[441.86,464.93,null,60.21,27.15,14.74,7.09,873.65,487.91]::numeric[],array[68.601,81.409,null,68.601,68.601,68.601,null,null,null]::numeric[],2377.54,17),
  ('010','Appartamento','Marmocchi Matteo',array[396.92,417.66,null,54.08,24.39,13.24,1.6,444.38,553.25]::numeric[],array[61.625,73.132,null,61.625,61.625,61.625,null,null,null]::numeric[],1905.52,17),
  ('011','Appartamento','Benni Stefano',array[431.57,518.74,null,58.81,26.52,14.4,0.34,269.96,41.3]::numeric[],array[67.004,90.831,null,67.004,67.004,67.004,null,null,null]::numeric[],1361.64,17),
  ('012','Appartamento','D''Antonio Mauro',array[394.35,474,null,53.73,24.23,13.15,0.1,487.97,440.72]::numeric[],array[61.225,82.997,null,61.225,61.225,61.225,null,null,null]::numeric[],1888.25,17),
  ('013','Appartamento','Turco Annunziata',array[794.81,1074.4,null,108.3,48.84,26.51,0.02,1029.38,435.27]::numeric[],array[123.4,188.126,null,123.4,123.4,123.4,null,null,null]::numeric[],3517.53,18),
  ('014','Appartamento','Tinuper Anna Laura',array[220.36,330.88,null,30.03,13.54,7.35,0.02,512.74,548.67]::numeric[],array[34.213,57.937,null,34.213,34.213,34.213,null,null,null]::numeric[],1663.59,18),
  ('015','Box','Arezzo - Petruccelli',array[34.28,20.67,34.55,4.67,2.11,null,null,null,null]::numeric[],array[5.322,3.619,84.576,5.322,5.322,null,null,null,null]::numeric[],96.28,18),
  ('016','Box','Esposito - Salvato',array[33.96,20.48,34.23,4.63,2.09,null,null,null,null]::numeric[],array[5.273,3.586,83.797,5.273,5.273,null,null,null,null]::numeric[],95.39,18),
  ('017','Box','Rota Claudia',array[33.79,20.38,34.06,4.6,2.08,null,null,null,null]::numeric[],array[5.247,3.568,83.384,5.247,5.247,null,null,null,null]::numeric[],94.91,18),
  ('018','Box','Ragazzini Luca',array[37.7,22.73,38,5.14,2.32,null,null,null,null]::numeric[],array[5.853,3.98,93.014,5.853,5.853,null,null,null,null]::numeric[],105.89,18),
  ('019','Box','Arda - Battistella',array[34.95,21.08,35.23,4.76,2.15,null,null,null,null]::numeric[],array[5.427,3.691,86.244,5.427,5.427,null,null,null,null]::numeric[],98.17,18),
  ('020','Box','Talamonti - Cappella',array[32.42,19.55,32.68,4.42,1.99,null,null,null,null]::numeric[],array[5.034,3.423,79.999,5.034,5.034,null,null,null,null]::numeric[],91.06,18),
  ('021','Box','Marmocchi Matteo',array[32.74,19.74,33,4.46,2.01,null,null,null,null]::numeric[],array[5.083,3.457,80.777,5.083,5.083,null,null,null,null]::numeric[],91.95,18),
  ('022','Box','Benni Stefano',array[33.22,20.03,33.49,4.53,2.04,null,null,null,null]::numeric[],array[5.158,3.507,81.969,5.158,5.158,null,null,null,null]::numeric[],93.31,18),
  ('023','Box','D''Antonio Mauro',array[33.9,20.44,34.17,4.62,2.08,null,null,null,null]::numeric[],array[5.263,3.579,83.638,5.263,5.263,null,null,null,null]::numeric[],95.21,18),
  ('024','Box','Turco Annunziata',array[32.36,19.51,32.62,4.41,1.99,null,null,null,null]::numeric[],array[5.024,3.417,79.84,5.024,5.024,null,null,null,null]::numeric[],90.89,19),
  ('025','Box','Tinuper Anna Laura',array[32.64,19.68,32.89,4.45,2.01,null,null,null,null]::numeric[],array[5.067,3.446,80.523,5.067,5.067,null,null,null,null]::numeric[],91.67,19),
  ('026','Box','La Ganga Federica',array[33.33,20.1,33.6,4.54,2.05,null,null,null,null]::numeric[],array[5.175,3.519,82.239,5.175,5.175,null,null,null,null]::numeric[],93.62,19),
  ('027','Cantina','Arezzo - Petruccelli',array[3.22,1.94,null,0.44,0.2,null,null,null,null]::numeric[],array[0.5,0.34,null,0.5,0.5,null,null,null,null]::numeric[],5.8,19),
  ('028','Cantina','Rota Claudia',array[2.91,1.75,null,0.4,0.18,null,null,null,null]::numeric[],array[0.452,0.307,null,0.452,0.452,null,null,null,null]::numeric[],5.24,19),
  ('029','Cantina','La Ganga Federica',array[3.64,2.2,null,0.5,0.22,null,null,null,null]::numeric[],array[0.566,0.385,null,0.566,0.566,null,null,null,null]::numeric[],6.56,19),
  ('030','Cantina','Ragazzini Luca',array[6.05,3.65,null,0.82,0.37,null,null,null,null]::numeric[],array[0.94,0.639,null,0.94,0.94,null,null,null,null]::numeric[],10.89,19),
  ('031','Cantina','Arda - Battistella',array[3.64,2.2,null,0.5,0.22,null,null,null,null]::numeric[],array[0.566,0.385,null,0.566,0.566,null,null,null,null]::numeric[],6.56,19),
  ('032','Cantina','Martignani - Biavati',array[2.14,1.29,null,0.29,0.13,null,null,null,null]::numeric[],array[0.332,0.226,null,0.332,0.332,null,null,null,null]::numeric[],3.85,19),
  ('033','Cantina','Talamonti - Cappella',array[2.54,1.54,null,0.35,0.16,null,null,null,null]::numeric[],array[0.395,0.269,null,0.395,0.395,null,null,null,null]::numeric[],4.59,19),
  ('034','Cantina','Marmocchi Matteo',array[3.18,1.91,null,0.43,0.2,null,null,null,null]::numeric[],array[0.493,0.335,null,0.493,0.493,null,null,null,null]::numeric[],5.72,19),
  ('035','Cantina','Benni Stefano',array[3.12,1.88,null,0.42,0.19,null,null,null,null]::numeric[],array[0.484,0.329,null,0.484,0.484,null,null,null,null]::numeric[],5.61,20),
  ('036','Cantina','D''Antonio Mauro',array[3.64,2.2,null,0.5,0.22,null,null,null,null]::numeric[],array[0.566,0.385,null,0.566,0.566,null,null,null,null]::numeric[],6.56,20),
  ('037','Cantina','Turco Annunziata',array[3.57,2.15,null,0.49,0.22,null,null,null,null]::numeric[],array[0.554,0.377,null,0.554,0.554,null,null,null,null]::numeric[],6.43,20),
  ('038','Cantina','Tinuper Anna Laura',array[3.57,2.15,null,0.49,0.22,null,null,null,null]::numeric[],array[0.554,0.377,null,0.554,0.554,null,null,null,null]::numeric[],6.43,20),
  ('039','Cantina','Esposito - Salvato',array[3.12,1.88,null,0.42,0.19,null,null,null,null]::numeric[],array[0.484,0.329,null,0.484,0.484,null,null,null,null]::numeric[],5.61,20),
  ('040','Posto auto','Arezzo - Petruccelli',array[27.39,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,null,null,null,null,null,null]::numeric[],27.39,20),
  ('041','Posto auto','Daloiso Cesare',array[27.39,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,null,null,null,null,null,null]::numeric[],27.39,20),
  ('042','Posto auto','Martignani - Biavati',array[29.98,null,null,null,null,null,null,null,null]::numeric[],array[4.655,null,null,null,null,null,null,null,null]::numeric[],29.98,20),
  ('043','Posto auto','Marmocchi Matteo',array[27.39,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,null,null,null,null,null,null]::numeric[],27.39,20),
  ('044','Posto auto','Tinuper Anna Laura',array[27.39,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,null,null,null,null,null,null]::numeric[],27.39,21)
)
insert into public.quote_unita (condominium_id, anno, unita_id, codice_unita, tipologia, nome_nel_documento, importi, millesimi, totale, fonte_documento, fonte_pagina, documento_path)
select c.id, 2025, u.id, d.codice, d.tipologia, d.nome,
  (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from unnest(colonne.nomi, d.importi) as t(k, v) where v is not null),
  (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from unnest(colonne.nomi, d.millesimi) as t(k, v) where v is not null),
  d.totale, 'Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf', d.pagina, 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-Rendiconto Consuntivo 2024-2025 - Via Enriques 3 (2).pdf'
from dati d cross join c cross join colonne
left join public.unita u on u.condominium_id = c.id and u.codice = d.codice
on conflict (condominium_id, anno, codice_unita) do update set unita_id = excluded.unita_id, importi = excluded.importi, millesimi = excluded.millesimi, totale = excluded.totale, fonte_documento = excluded.fonte_documento, fonte_pagina = excluded.fonte_pagina, documento_path = excluded.documento_path;

-- 2024: 44 unità, 10 colonne, somma 28293.24
with c as (select id from public.condominiums where id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9'),
colonne as (select array['Millesimi Generali','Millesimi Scale e Ascensore','Millesimi Corsello Garage','Millesimi Generali Parziali','Millesimi Generali Fotovoltaico','Millesimi Gen. NO Posti Auto','Personali e Rimborsi','Spese Riscaldamento','Spese Raffr. - ACS - AFS','Consumi Enel Box/Cantine']::text[] as nomi),
dati(codice, tipologia, nome, importi, millesimi, totale, pagina) as (values
  ('001','Appartamento','Arezzo - Petruccelli',array[428.95,243.14,null,-217.57,492.06,145.62,44.41,415.1,359.55,null]::numeric[],array[79.065,40.408,null,79.065,79.065,79.065,null,null,null,null]::numeric[],1911.26,18),
  ('002','Appartamento','Daloiso Cesare',array[242.05,137.2,null,-122.77,277.65,82.17,null,153.41,615.4,null]::numeric[],array[44.614,22.801,null,44.614,44.614,44.614,null,null,null,null]::numeric[],1385.11,18),
  ('003','Appartamento','Esposito - Salvato',array[339.34,255.92,null,-172.11,389.26,115.2,null,731.02,546.15,null]::numeric[],array[62.548,42.532,null,62.548,62.548,62.548,null,null,null,null]::numeric[],2204.78,18),
  ('004','Appartamento','Rota Claudia',array[297.35,224.25,null,-150.82,341.09,100.94,null,231.36,95.55,null]::numeric[],array[54.808,37.269,null,54.808,54.808,54.808,null,null,null,null]::numeric[],1139.72,18),
  ('005','Appartamento','La Ganga Federica',array[354.5,333.76,null,-179.8,406.65,120.34,null,359.29,258.47,null]::numeric[],array[65.341,55.468,null,65.341,65.341,65.341,null,null,null,null]::numeric[],1653.21,18),
  ('006','Appartamento','Ragazzini Luca',array[313.91,295.54,null,-159.21,360.09,106.56,null,465.11,593.81,null]::numeric[],array[57.86,49.116,null,57.86,57.86,57.86,null,null,null,null]::numeric[],1975.81,18),
  ('007','Appartamento','Arda - Battistella',array[440.47,497.22,null,-223.41,505.27,149.53,null,439.87,84.89,null]::numeric[],array[81.188,82.633,null,81.188,81.188,81.188,null,null,null,null]::numeric[],1893.84,18),
  ('008','Appartamento','Martignani - Biavati',array[255.15,288.02,null,-129.41,292.68,86.62,null,402.68,330.14,null]::numeric[],array[47.029,47.866,null,47.029,47.029,47.029,null,null,null,null]::numeric[],1525.88,18),
  ('009','Appartamento','Talamonti - Cappella',array[372.18,489.85,null,-188.77,426.93,126.35,null,654.49,443.13,null]::numeric[],array[68.601,81.409,null,68.601,68.601,68.601,null,null,null,null]::numeric[],2324.16,18),
  ('010','Appartamento','Marmocchi Matteo',array[334.34,440.05,null,-169.58,383.52,113.5,null,398.43,444.75,null]::numeric[],array[61.625,73.132,null,61.625,61.625,61.625,null,null,null,null]::numeric[],1945.01,18),
  ('011','Appartamento','Benni Stefano',array[363.52,546.54,null,-184.38,416.99,123.41,null,248.99,37.8,null]::numeric[],array[67.004,90.831,null,67.004,67.004,67.004,null,null,null,null]::numeric[],1552.87,18),
  ('012','Appartamento','D''Antonio Mauro',array[332.17,499.41,null,-168.47,381.03,112.76,null,306.9,352.09,null]::numeric[],array[61.225,82.997,null,61.225,61.225,61.225,null,null,null,null]::numeric[],1815.89,18),
  ('013','Appartamento','Turco Annunziata',array[669.48,1131.98,null,-339.56,767.97,227.27,null,975.47,439.06,null]::numeric[],array[123.4,188.126,null,123.4,123.4,123.4,null,null,null,null]::numeric[],3871.67,18),
  ('014','Appartamento','Tinuper Anna Laura',array[185.62,348.62,null,-94.14,212.92,63.01,null,255.32,366.24,null]::numeric[],array[34.213,57.937,null,34.213,34.213,34.213,null,null,null,null]::numeric[],1337.59,19),
  ('015','Box','Arezzo - Petruccelli',array[28.87,21.78,29.71,null,33.12,9.8,null,null,null,null]::numeric[],array[5.322,3.619,84.576,5.322,5.322,5.322,null,null,null,null]::numeric[],123.28,19),
  ('016','Box','Esposito - Salvato',array[28.61,21.58,29.44,null,32.82,9.71,null,null,null,null]::numeric[],array[5.273,3.586,83.797,5.273,5.273,5.273,null,null,null,null]::numeric[],122.16,19),
  ('017','Box','Rota Claudia',array[28.47,21.47,29.3,null,32.65,9.66,null,null,null,null]::numeric[],array[5.247,3.568,83.384,5.247,5.247,5.247,null,null,null,null]::numeric[],121.55,19),
  ('018','Box','Ragazzini Luca',array[31.75,23.95,32.68,null,36.43,10.78,null,null,null,null]::numeric[],array[5.853,3.98,93.014,5.853,5.853,5.853,null,null,null,null]::numeric[],135.59,19),
  ('019','Box','Arda - Battistella',array[29.44,22.21,30.3,null,33.77,10,null,null,null,null]::numeric[],array[5.427,3.691,86.244,5.427,5.427,5.427,null,null,null,null]::numeric[],125.72,19),
  ('020','Box','Talamonti - Cappella',array[27.31,20.6,28.11,null,31.33,9.27,null,null,null,null]::numeric[],array[5.034,3.423,79.999,5.034,5.034,5.034,null,null,null,null]::numeric[],116.62,19),
  ('021','Box','Marmocchi Matteo',array[27.58,20.8,28.38,null,31.63,9.36,null,null,null,null]::numeric[],array[5.083,3.457,80.777,5.083,5.083,5.083,null,null,null,null]::numeric[],117.75,19),
  ('022','Box','Benni Stefano',array[27.98,21.1,28.8,null,32.1,9.5,null,null,null,null]::numeric[],array[5.158,3.507,81.969,5.158,5.158,5.158,null,null,null,null]::numeric[],119.48,19),
  ('023','Box','D''Antonio Mauro',array[28.55,21.54,29.39,null,32.75,9.69,null,null,null,null]::numeric[],array[5.263,3.579,83.638,5.263,5.263,5.263,null,null,null,null]::numeric[],121.92,19),
  ('024','Box','Turco Annunziata',array[27.26,20.56,28.05,null,31.27,9.25,null,null,null,null]::numeric[],array[5.024,3.417,79.84,5.024,5.024,5.024,null,null,null,null]::numeric[],116.39,19),
  ('025','Box','Tinuper Anna Laura',array[27.49,20.74,28.29,null,31.53,9.33,null,null,null,null]::numeric[],array[5.067,3.446,80.523,5.067,5.067,5.067,null,null,null,null]::numeric[],117.38,19),
  ('026','Box','La Ganga Federica',array[28.08,21.17,28.89,null,32.21,9.53,null,null,null,null]::numeric[],array[5.175,3.519,82.239,5.175,5.175,5.175,null,null,null,null]::numeric[],119.88,20),
  ('027','Cantina','Arezzo - Petruccelli',array[2.71,2.05,null,null,3.11,0.92,null,null,null,5.26]::numeric[],array[0.5,0.34,null,0.5,0.5,0.5,null,null,null,null]::numeric[],14.05,20),
  ('028','Cantina','Rota Claudia',array[2.45,1.85,null,null,2.81,0.83,null,null,null,0.87]::numeric[],array[0.452,0.307,null,0.452,0.452,0.452,null,null,null,null]::numeric[],8.81,20),
  ('029','Cantina','La Ganga Federica',array[3.07,2.32,null,null,3.52,1.04,null,null,null,0.92]::numeric[],array[0.566,0.385,null,0.566,0.566,0.566,null,null,null,null]::numeric[],10.87,20),
  ('030','Cantina','Ragazzini Luca',array[5.1,3.84,null,null,5.85,1.73,null,null,null,10.84]::numeric[],array[0.94,0.639,null,0.94,0.94,0.94,null,null,null,null]::numeric[],27.36,20),
  ('031','Cantina','Arda - Battistella',array[3.07,2.32,null,null,3.52,1.04,null,null,null,0.33]::numeric[],array[0.566,0.385,null,0.566,0.566,0.566,null,null,null,null]::numeric[],10.28,20),
  ('032','Cantina','Martignani - Biavati',array[1.8,1.36,null,null,2.07,0.61,null,null,null,0.02]::numeric[],array[0.332,0.226,null,0.332,0.332,0.332,null,null,null,null]::numeric[],5.86,20),
  ('033','Cantina','Talamonti - Cappella',array[2.14,1.62,null,null,2.46,0.73,null,null,null,34.06]::numeric[],array[0.395,0.269,null,0.395,0.395,0.395,null,null,null,null]::numeric[],41.01,20),
  ('034','Cantina','Marmocchi Matteo',array[2.67,2.02,null,null,3.07,0.91,null,null,null,1.08]::numeric[],array[0.493,0.335,null,0.493,0.493,0.493,null,null,null,null]::numeric[],9.75,20),
  ('035','Cantina','Benni Stefano',array[2.63,1.98,null,null,3.01,0.89,null,null,null,0.85]::numeric[],array[0.484,0.329,null,0.484,0.484,0.484,null,null,null,null]::numeric[],9.36,20),
  ('036','Cantina','D''Antonio Mauro',array[3.07,2.32,null,null,3.52,1.04,null,null,null,1.11]::numeric[],array[0.566,0.385,null,0.566,0.566,0.566,null,null,null,null]::numeric[],11.06,20),
  ('037','Cantina','Turco Annunziata',array[3.01,2.27,null,null,3.45,1.02,null,null,null,2.16]::numeric[],array[0.554,0.377,null,0.554,0.554,0.554,null,null,null,null]::numeric[],11.91,20),
  ('038','Cantina','Tinuper Anna Laura',array[3.01,2.27,null,null,3.45,1.02,null,null,null,1.32]::numeric[],array[0.554,0.377,null,0.554,0.554,0.554,null,null,null,null]::numeric[],11.07,21),
  ('039','Cantina','Esposito - Salvato',array[2.63,1.98,null,null,3.01,0.89,null,null,null,1.29]::numeric[],array[0.484,0.329,null,0.484,0.484,0.484,null,null,null,null]::numeric[],9.8,21),
  ('040','Posto auto','Arezzo - Petruccelli',array[23.07,null,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,4.253,null,null,null,null,null,null]::numeric[],23.07,21),
  ('041','Posto auto','Daloiso Cesare',array[23.07,null,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,4.253,null,null,null,null,null,null]::numeric[],23.07,21),
  ('042','Posto auto','Martignani - Biavati',array[25.25,null,null,null,null,null,null,null,null,null]::numeric[],array[4.655,null,null,4.655,null,null,null,null,null,null]::numeric[],25.25,21),
  ('043','Posto auto','Marmocchi Matteo',array[23.07,null,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,4.253,null,null,null,null,null,null]::numeric[],23.07,21),
  ('044','Posto auto','Tinuper Anna Laura',array[23.07,null,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,4.253,null,null,null,null,null,null]::numeric[],23.07,21)
)
insert into public.quote_unita (condominium_id, anno, unita_id, codice_unita, tipologia, nome_nel_documento, importi, millesimi, totale, fonte_documento, fonte_pagina, documento_path)
select c.id, 2024, u.id, d.codice, d.tipologia, d.nome,
  (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from unnest(colonne.nomi, d.importi) as t(k, v) where v is not null),
  (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from unnest(colonne.nomi, d.millesimi) as t(k, v) where v is not null),
  d.totale, 'Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf', d.pagina, 'documenti/8e617a4c-7556-4750-8673-b08677de4f36/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto Consuntivo 2023-2024 - Via Enriques 3 (1).pdf'
from dati d cross join c cross join colonne
left join public.unita u on u.condominium_id = c.id and u.codice = d.codice
on conflict (condominium_id, anno, codice_unita) do update set unita_id = excluded.unita_id, importi = excluded.importi, millesimi = excluded.millesimi, totale = excluded.totale, fonte_documento = excluded.fonte_documento, fonte_pagina = excluded.fonte_pagina, documento_path = excluded.documento_path;

-- 2023: 44 unità, 10 colonne, somma 30915.77
with c as (select id from public.condominiums where id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9'),
colonne as (select array['Millesimi Generali','Millesimi Scale e Ascensore','Millesimi Corsello Garage','Millesimi Generali Parziali','Millesimi Generali Fotovoltaico','Millesimi Gen. NO Posti Auto','Millesimi Gen. Conduz. Appartamenti','Personali e Rimborsi','Spese Riscaldamento','Spese Raffresc. - ACS - AFS']::text[] as nomi),
dati(codice, tipologia, nome, importi, millesimi, totale, pagina) as (values
  ('001','Appartamento','Arezzo - Petruccelli',array[407.04,317.25,null,381.17,44.48,32.61,-11.68,null,485.97,567.37]::numeric[],array[79.065,40.408,null,79.065,79.065,79.065,79.065,null,null,null]::numeric[],2224.21,19),
  ('002','Appartamento','Daloiso Cesare',array[229.67,179.01,null,215.09,25.1,18.4,-6.59,null,182.9,425.42]::numeric[],array[44.614,22.801,null,44.614,44.614,44.614,44.614,null,null,null]::numeric[],1269,19),
  ('003','Appartamento','Esposito - Salvato',array[322.01,333.93,null,301.55,35.19,25.8,-9.24,null,631.56,676.99]::numeric[],array[62.548,42.532,null,62.548,62.548,62.548,62.548,null,null,null]::numeric[],2317.79,19),
  ('004','Appartamento','Rota Claudia',array[282.16,292.61,null,264.23,30.83,22.61,-8.1,null,343.46,196.44]::numeric[],array[54.808,37.269,null,54.808,54.808,54.808,54.808,null,null,null]::numeric[],1424.24,19),
  ('005','Appartamento','Ferraro - Iacobucci',array[336.38,435.49,null,315.01,36.76,26.95,-9.65,206.44,267.46,433.47]::numeric[],array[65.341,55.468,null,65.341,65.341,65.341,65.341,null,null,null]::numeric[],2048.31,19),
  ('006','Appartamento','Ragazzini Luca',array[297.87,385.62,null,278.94,32.55,23.87,-8.55,null,412.88,708.76]::numeric[],array[57.86,49.116,null,57.86,57.86,57.86,57.86,null,null,null]::numeric[],2131.94,19),
  ('007','Appartamento','Arda - Battistella',array[417.97,648.77,null,391.41,45.67,33.49,-11.99,null,415.62,60.49]::numeric[],array[81.188,82.633,null,81.188,81.188,81.188,81.188,null,null,null]::numeric[],2001.43,19),
  ('008','Appartamento','Martignani - Biavati',array[242.11,375.81,null,226.73,26.46,19.4,-6.95,null,363.18,283.3]::numeric[],array[47.029,47.866,null,47.029,47.029,47.029,47.029,null,null,null]::numeric[],1530.04,19),
  ('009','Appartamento','Talamonti - Cappella',array[353.16,639.16,null,330.73,38.59,28.3,-10.13,null,655.36,476.43]::numeric[],array[68.601,81.409,null,68.601,68.601,68.601,68.601,null,null,null]::numeric[],2511.6,19),
  ('010','Appartamento','Marmocchi Matteo',array[317.25,574.17,null,297.1,34.67,25.42,-9.1,null,341.94,410.87]::numeric[],array[61.625,73.132,null,61.625,61.625,61.625,61.625,null,null,null]::numeric[],1992.32,19),
  ('011','Appartamento','Benni Stefano',array[344.94,713.13,null,323.03,37.69,27.64,-9.9,null,207.8,44.8]::numeric[],array[67.004,90.831,null,67.004,67.004,67.004,67.004,null,null,null]::numeric[],1689.13,19),
  ('012','Appartamento','D''Antonio Mauro',array[315.19,651.63,null,295.17,34.44,25.25,-9.04,null,310.7,489.27]::numeric[],array[61.225,82.997,null,61.225,61.225,61.225,61.225,null,null,null]::numeric[],2112.61,19),
  ('013','Appartamento','Turco Annunziata',array[635.28,1477.01,null,594.91,69.42,50.9,-18.23,null,1040.69,663.49]::numeric[],array[123.4,188.126,null,123.4,123.4,123.4,123.4,null,null,null]::numeric[],4513.47,20),
  ('014','Appartamento','Tinuper Anna Laura',array[176.13,454.87,null,164.94,19.25,14.11,-5.05,null,505.36,446.08]::numeric[],array[34.213,57.937,null,34.213,34.213,34.213,34.213,null,null,null]::numeric[],1775.69,20),
  ('015','Box','Arezzo - Petruccelli',array[27.4,28.41,39.1,null,2.99,2.2,null,null,null,null]::numeric[],array[5.322,3.619,84.576,5.322,5.322,5.322,null,null,null,null]::numeric[],100.1,20),
  ('016','Box','Esposito - Salvato',array[27.14,28.15,38.74,null,2.97,2.17,null,null,null,null]::numeric[],array[5.273,3.586,83.797,5.273,5.273,5.273,null,null,null,null]::numeric[],99.17,20),
  ('017','Box','Rota Claudia',array[27.02,28.01,38.55,null,2.95,2.16,null,null,null,null]::numeric[],array[5.247,3.568,83.384,5.247,5.247,5.247,null,null,null,null]::numeric[],98.69,20),
  ('018','Box','Ragazzini Luca',array[30.13,31.25,43.01,null,3.29,2.41,null,null,null,null]::numeric[],array[5.853,3.98,93.014,5.853,5.853,5.853,null,null,null,null]::numeric[],110.09,20),
  ('019','Box','Arda - Battistella',array[27.94,28.98,39.87,null,3.05,2.24,null,null,null,null]::numeric[],array[5.427,3.691,86.244,5.427,5.427,5.427,null,null,null,null]::numeric[],102.08,20),
  ('020','Box','Talamonti - Cappella',array[25.92,26.87,36.99,null,2.83,2.08,null,null,null,null]::numeric[],array[5.034,3.423,79.999,5.034,5.034,5.034,null,null,null,null]::numeric[],94.69,20),
  ('021','Box','Marmocchi Matteo',array[26.16,27.14,37.35,null,2.86,2.1,null,null,null,null]::numeric[],array[5.083,3.457,80.777,5.083,5.083,5.083,null,null,null,null]::numeric[],95.61,20),
  ('022','Box','Benni Stefano',array[26.55,27.53,37.9,null,2.9,2.13,null,null,null,null]::numeric[],array[5.158,3.507,81.969,5.158,5.158,5.158,null,null,null,null]::numeric[],97.01,20),
  ('023','Box','D''Antonio Mauro',array[27.09,28.1,38.67,null,2.96,2.17,null,null,null,null]::numeric[],array[5.263,3.579,83.638,5.263,5.263,5.263,null,null,null,null]::numeric[],98.99,20),
  ('024','Box','Turco Annunziata',array[25.86,26.83,36.91,null,2.83,2.07,null,null,null,null]::numeric[],array[5.024,3.417,79.84,5.024,5.024,5.024,null,null,null,null]::numeric[],94.5,20),
  ('025','Box','Tinuper Anna Laura',array[26.08,27.06,37.23,null,2.85,2.09,null,null,null,null]::numeric[],array[5.067,3.446,80.523,5.067,5.067,5.067,null,null,null,null]::numeric[],95.31,21),
  ('026','Box','Ferraro - Iacobucci',array[26.64,27.63,38.02,null,2.91,2.13,null,null,null,null]::numeric[],array[5.175,3.519,82.239,5.175,5.175,5.175,null,null,null,null]::numeric[],97.33,21),
  ('027','Cantina','Arezzo - Petruccelli',array[2.58,2.67,null,null,0.28,0.21,null,null,null,null]::numeric[],array[0.5,0.34,null,0.5,0.5,0.5,null,null,null,null]::numeric[],5.74,21),
  ('028','Cantina','Rota Claudia',array[2.33,2.41,null,null,0.25,0.19,null,null,null,null]::numeric[],array[0.452,0.307,null,0.452,0.452,0.452,null,null,null,null]::numeric[],5.18,21),
  ('029','Cantina','Ferraro - Iacobucci',array[2.91,3.02,null,null,0.32,0.23,null,null,null,null]::numeric[],array[0.566,0.385,null,0.566,0.566,0.566,null,null,null,null]::numeric[],6.48,21),
  ('030','Cantina','Ragazzini Luca',array[4.84,5.02,null,null,0.53,0.39,null,null,null,null]::numeric[],array[0.94,0.639,null,0.94,0.94,0.94,null,null,null,null]::numeric[],10.78,21),
  ('031','Cantina','Arda - Battistella',array[2.91,3.02,null,null,0.32,0.23,null,null,null,null]::numeric[],array[0.566,0.385,null,0.566,0.566,0.566,null,null,null,null]::numeric[],6.48,21),
  ('032','Cantina','Martignani - Biavati',array[1.7,1.77,null,null,0.19,0.14,null,null,null,null]::numeric[],array[0.332,0.226,null,0.332,0.332,0.332,null,null,null,null]::numeric[],3.8,21),
  ('033','Cantina','Talamonti - Cappella',array[2.04,2.11,null,null,0.22,0.16,null,null,null,null]::numeric[],array[0.395,0.269,null,0.395,0.395,0.395,null,null,null,null]::numeric[],4.53,21),
  ('034','Cantina','Marmocchi Matteo',array[2.54,2.63,null,null,0.28,0.2,null,null,null,null]::numeric[],array[0.493,0.335,null,0.493,0.493,0.493,null,null,null,null]::numeric[],5.65,21),
  ('035','Cantina','Benni Stefano',array[2.49,2.58,null,null,0.27,0.2,null,null,null,null]::numeric[],array[0.484,0.329,null,0.484,0.484,0.484,null,null,null,null]::numeric[],5.54,21),
  ('036','Cantina','D''Antonio Mauro',array[2.91,3.02,null,null,0.32,0.23,null,null,null,null]::numeric[],array[0.566,0.385,null,0.566,0.566,0.566,null,null,null,null]::numeric[],6.48,22),
  ('037','Cantina','Turco Annunziata',array[2.85,2.96,null,null,0.31,0.23,null,null,null,null]::numeric[],array[0.554,0.377,null,0.554,0.554,0.554,null,null,null,null]::numeric[],6.35,22),
  ('038','Cantina','Tinuper Anna Laura',array[2.85,2.96,null,null,0.31,0.23,null,null,null,null]::numeric[],array[0.554,0.377,null,0.554,0.554,0.554,null,null,null,null]::numeric[],6.35,22),
  ('039','Cantina','Esposito - Salvato',array[2.49,2.58,null,null,0.27,0.2,null,null,null,null]::numeric[],array[0.484,0.329,null,0.484,0.484,0.484,null,null,null,null]::numeric[],5.54,22),
  ('040','Posto auto','Arezzo - Petruccelli',array[21.89,null,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,4.253,null,null,null,null,null,null]::numeric[],21.89,22),
  ('041','Posto auto','Daloiso Cesare',array[21.89,null,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,4.253,null,null,null,null,null,null]::numeric[],21.89,22),
  ('042','Posto auto','Martignani - Biavati',array[23.96,null,null,null,null,null,null,null,null,null]::numeric[],array[4.655,null,null,4.655,null,null,null,null,null,null]::numeric[],23.96,22),
  ('043','Posto auto','Marmocchi Matteo',array[21.89,null,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,4.253,null,null,null,null,null,null]::numeric[],21.89,22),
  ('044','Posto auto','Tinuper Anna Laura',array[21.89,null,null,null,null,null,null,null,null,null]::numeric[],array[4.253,null,null,4.253,null,null,null,null,null,null]::numeric[],21.89,22)
)
insert into public.quote_unita (condominium_id, anno, unita_id, codice_unita, tipologia, nome_nel_documento, importi, millesimi, totale, fonte_documento, fonte_pagina, documento_path)
select c.id, 2023, u.id, d.codice, d.tipologia, d.nome,
  (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from unnest(colonne.nomi, d.importi) as t(k, v) where v is not null),
  (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from unnest(colonne.nomi, d.millesimi) as t(k, v) where v is not null),
  d.totale, 'Rendiconto Consuntivo 2022-2023 - Via Enriques 3.pdf', d.pagina, null
from dati d cross join c cross join colonne
left join public.unita u on u.condominium_id = c.id and u.codice = d.codice
on conflict (condominium_id, anno, codice_unita) do update set unita_id = excluded.unita_id, importi = excluded.importi, millesimi = excluded.millesimi, totale = excluded.totale, fonte_documento = excluded.fonte_documento, fonte_pagina = excluded.fonte_pagina, documento_path = excluded.documento_path;
