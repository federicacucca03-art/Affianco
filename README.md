# Affianco

App Next.js per media buyer: wizard campagne Meta Ads (lead, prenotazioni, ecommerce, in-store, retargeting, awareness), approvazione cliente e export Meta.

## Requisiti

- Node.js 20+ consigliato
- Account [Supabase](https://supabase.com)
- Opzionale: chiave Anthropic per le API AI (senza chiave, alcune route usano dati demo)

## Installazione

```bash
npm install
cp .env.example .env.local
```

In `.env.local` inserisci Project URL e anon/publishable key da Supabase → **Project Settings → API**.  
**Non** mettere service role / secret key / password DB nel frontend o in `.env.local`.

## Setup Supabase (progetto nuovo)

1. Crea un progetto su Supabase (regione a scelta).
2. Compila `.env.local` come sopra (vedi `.env.example`).
3. Applica lo schema: esegui in ordine i file in `supabase/migrations/`  
   (inizia da `20260728_bootstrap_schema.sql`, poi gli `ALTER` successivi),  
   oppure usa la CLI Supabase se la configuri sul progetto.
4. **Solo per sviluppo / MVP locale:** esegui anche  
   `supabase/dev/setup-dev-rls.sql`  
   → apre SELECT/INSERT/UPDATE ad `anon`.  
   **DEV ONLY — NOT FOR PRODUCTION.**
5. Avvia l’app:

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

### Sicurezza

- `supabase/migrations/` = schema neutro (tabelle, FK, colonne). RLS può essere on **senza** policy aperte.
- `supabase/dev/setup-dev-rls.sql` = policy anon aperte **solo DEV**.
- Produzione futura: Auth, RLS restrittive, token sul link `/approvazione/[id]`. Non usare le policy DEV.

## Script

| Comando         | Descrizione      |
|-----------------|------------------|
| `npm run dev`   | Dev server       |
| `npm run build` | Build produzione |
| `npm run start` | Avvia build      |
| `npm run lint`  | ESLint           |

## Note

- Creatività: storage locale browser (non Supabase Storage in questa fase)
- Non versionare `.env.local` né dump/log/export di clienti
