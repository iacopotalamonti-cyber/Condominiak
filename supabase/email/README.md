# Email di accesso

I testi delle email che Supabase Auth manda per conto di Condominiak. Stanno qui
perché si possano rivedere e ripristinare: Supabase li tiene solo nelle sue
impostazioni, e lì non hanno storia.

Si incollano in Supabase → Authentication → Emails (Templates), su **tutti e due**
i progetti (produzione e staging). Oggetto e corpo sono in testa a ogni file.

| File | Modello Supabase | Quando parte |
| --- | --- | --- |
| `conferma-registrazione.html` | Confirm signup | chi si registra, anche da un invito |
| `reimposta-password.html` | Reset password | "Password dimenticata?" |
| `cambio-email.html` | Change email address | cambio dell'indirizzo |

Il mittente ("Condominiak <noreply@condominiak.me>") non dipende dai testi: lo
decide il server SMTP, in Authentication → Emails → SMTP Settings. Senza un
SMTP proprio Supabase manda solo agli indirizzi del team del progetto, cioè
nessun condomino invitato riceverebbe la conferma.

Testi brevi e senza promozione, come raccomanda Supabase: i filtri antispam
trattano come pubblicità un'email di accesso che parla del prodotto.
