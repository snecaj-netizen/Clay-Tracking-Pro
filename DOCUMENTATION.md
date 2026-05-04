# Documentazione Struttura Clay Tracker Pro

Questa documentazione descrive l'architettura e la struttura dei file dell'applicazione **Clay Tracker Pro**.

## Architettura Tecnica
- **Frontend**: React 18+ con Vite
- **Linguaggio**: TypeScript
- **Styling**: Tailwind CSS
- **Database & Auth**: **Supabase** (PostgreSQL)
- **Animazioni**: Framer Motion
- **Icone**: Lucide React & FontAwesome

## Diagramma della Struttura File

```text
/
├── components/                 # Componenti UI Reutilizzabili
│   ├── admin/                  # Gestione Pannello Amministrativo
│   │   ├── ResultsManagement.tsx
│   │   ├── SocietyManagement.tsx
│   │   ├── TeamManagement.tsx
│   │   └── UserManagement.tsx
│   ├── CompetitionForm.tsx     # Form inserimento gare
│   ├── Dashboard.tsx           # Dashboard principale utente
│   ├── HistoryList.tsx         # Storico delle prestazioni
│   ├── SocietySearch.tsx       # Componente ricerca TAV
│   └── ...                     # Altri componenti di pagina
├── contexts/                   # Gestione dello Stato Globale
│   ├── AdminContext.tsx        # Stato e logica per amministratori
│   ├── AuthContext.tsx         # Gestione autenticazione (Supabase Auth)
│   └── LanguageContext.tsx     # Sistema multi-lingua (IT/EN)
├── hooks/                      # Custom React Hooks
├── lib/                        # Utility e configurazioni (Supabase Client)
├── public/                     # Asset statici (immagini, icone)
├── src/                        # Entry point dell'app
│   ├── App.tsx                 # Router e layout principale
│   └── main.tsx                # Bootstrap React
├── types.ts                    # Interfacce e tipi TypeScript globali
├── ratingUtils.ts              # Logica calcolo rating e statistiche
├── server.ts                   # Backend Express (se presente proxy)
└── DOCUMENTATION.md            # Questo file
```

## Descrizione Moduli Principali

### 1. Gestione Società (TAV)
Localizzata in `components/admin/SocietyManagement.tsx` e `components/SocietySearch.tsx`. Gestisce l'anagrafica dei campi di tiro, le discipline disponibili e i contatti.

### 2. Risultati e Statistiche
La logica di calcolo del rating è centralizzata in `ratingUtils.ts`. La visualizzazione avviene tramite la `Dashboard.tsx` e i vari grafici in `StatsCharts.tsx`.

### 3. Integrazione Supabase
L'app utilizza Supabase per:
- **Autenticazione**: Gestita tramite `contexts/AuthContext.tsx`.
- **Database**: PostgreSQL per memorizzare profili utenti, società, gare e risultati.

## Note per lo Sviluppo
- **Ricerca**: La ricerca società è stata ottimizzata per supportare filtri separati per nome/codice e regione/città.
- **UI/UX**: Particolare attenzione all'uso su mobile (evitati click involontari sulle righe delle tabelle, preferendo pulsanti di azione espliciti).
