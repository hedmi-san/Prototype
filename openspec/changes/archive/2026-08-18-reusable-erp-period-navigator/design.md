## Context

The system previously used a single flat row of period pills on the dashboard (*Aujourd'hui, Hier, 7j, 30j, Ce Mois, Mois Précédent, Année, Année Précédente, Personnalisée*). This design lacks scale hierarchy, makes incremental browsing (e.g. ◀ 3 months back) impossible without custom date inputs, and cannot scale cleanly to quarters (Q1, Q2, Q3, Q4) or multi-year comparisons. Modern ERPs like Odoo and QuickBooks solve this by decoupling **Time Granularity** (`Jour` | `Semaine` | `Mois` | `Trimestre` | `Année`) from **Time Position Stepping** (◀ [Label] ▶ + Jump Popover).

## Goals / Non-Goals

**Goals:**
- Provide a standardized, reusable Vue 3 component `AppPeriodNavigator.vue` encapsulating period granularity selection, stepper navigation, jump picker, and "Revenir à aujourd'hui" reset.
- Provide a robust date-math calculation engine `src/utils/periodNavigator.ts` handling all calendar edge cases (quarter year wraps, week boundaries across months/years, leap years, 28/29/30/31-day months).
- Support future date guard: automatically disable ▶ button when the next period starts after the current date/time.
- Support interactive Quick Jump Popover (year selector + month grid / quarter grid / date picker) on clicking the central period label.
- Emit a normalized `PeriodState` object `{ startDate, endDate, granularity, label, priorStartDate, priorEndDate, priorPeriodLabel }` via `v-model` or `@change`.

**Non-Goals:**
- Forcing external heavyweight date libraries (date-fns / moment / dayjs). Pure TypeScript using standard `Date` and `Intl.DateTimeFormat` guarantees 0 bundle overhead and maximum performance.

## Decisions & Answers to Core Architecture Questions

### 1. State Representation for Reusability
The component state is defined by an immutable, minimal model:
```ts
export type PeriodGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface PeriodNavigatorModel {
  granularity: PeriodGranularity;
  referenceDate: string; // ISO string 'YYYY-MM-DD' representing the focal anchor date
  customStartDate?: string;
  customEndDate?: string;
}

export interface ComputedPeriodRange {
  startDate: string;         // 'YYYY-MM-DD'
  endDate: string;           // 'YYYY-MM-DD'
  label: string;             // e.g. "Mars 2025", "T2 2025", "Semaine 11 (10 - 16 Mars 2025)", "18 Août 2026"
  shortLabel: string;        // e.g. "Mar 2025"
  priorStartDate: string;    // 'YYYY-MM-DD' for equal prior duration
  priorEndDate: string;      // 'YYYY-MM-DD'
  priorPeriodLabel: string;  // e.g. "vs Fév 2025", "vs T1 2025"
  isCurrentPeriod: boolean;  // true if anchor falls into today's equivalent period
  canStepForward: boolean;   // false if stepping forward would enter future dates
}
```
**Why this state structure?**
Any view in the app (Dashboard, Financial Statements, Sales Reports, Audit Logs) can simply use:
`<AppPeriodNavigator v-model="periodState" @change="onPeriodChange" />`
The parent view only receives pure `startDate` / `endDate` strings and passes them directly to its API service.

---

### 2. Edge Case Handling in Date Math

- **Trimestres à cheval sur fin d'année (Q4 → Q1 / Q1 → Q4)**:
  - Trimestres sont fixes :
    - T1 : 01 Janvier au 31 Mars
    - T2 : 01 Avril au 30 Juin
    - T3 : 01 Juillet au 30 Septembre
    - T4 : 01 Octobre au 31 Décembre
  - Stepper ◀ sur T1 2025 recule de 3 mois $\rightarrow$ T4 2024 (01/10/2024 - 31/12/2024). Stepper ▶ sur T4 2024 avance $\rightarrow$ T1 2025.
- **Semaines à cheval sur deux mois (ex. 29 Mars au 04 Avril)**:
  - La semaine est toujours calculée du **Lundi au Dimanche** selon la norme ISO (ou `Intl`).
  - Label clair : *"Semaine du 29 Mar au 04 Avr 2026"*.
  - Stepping ajoute/soustrait strictement 7 jours à la date de référence.
- **Années bissextiles & Fins de mois variables (28/29/30/31)**:
  - En mode `Mois`, la fin de mois est toujours calculée via `new Date(year, monthIndex + 1, 0).getDate()` (qui donne exactement 29 en février 2024/2028, 28 en 2025/2026/2027, 30 en avril/juin/septembre/novembre, 31 pour les autres).
  - En avançant d'un mois depuis le 31 Mars vers Avril, la date d'ancrage ne déborde jamais sur Mai grâce à un clamping `Math.min(anchorDay, daysInNewMonth)`.

---

### 3. Future Navigation Guard (Désactivation de ▶)
- Le composant compare la date de début de la prochaine période $T_{next}$ avec la date courante `now` :
  - En mode `Jour` : $T_{next} > \text{Aujourd'hui} \implies \text{Désactivé}$.
  - En mode `Semaine` : Premier jour de la semaine suivante $> \text{Aujourd'hui} \implies \text{Désactivé}$.
  - En mode `Mois` : Premier jour du mois suivant $> \text{Aujourd'hui} \implies \text{Désactivé}$.
  - En mode `Trimestre` : Premier jour du trimestre suivant $> \text{Aujourd'hui} \implies \text{Désactivé}$.
  - En mode `Année` : Année suivante $> \text{Année courante} \implies \text{Désactivé}$.
- Lorsque l'utilisateur est sur la période courante, le bouton ▶ est grisé (`disabled` avec `cursor: not-allowed` et opacité réduite), et le lien *"Revenir à aujourd'hui"* est masqué ou grisé car déjà actif.

---

### 4. Wireframe & Maquette Textuelle du Composant

```text
+-----------------------------------------------------------------------------------------------------------------------------------------+
|  [ JOUR ] [ SEMAINE ] [ MOIS* ] [ TRIMESTRE ] [ ANNÉE ]                                                                                 |
|                                                                                                                                         |
|  [ ◀ ]   [ 📅 Mars 2025 ▾ ]   [ ▶ ]       [ ↻ Revenir au mois en cours ]                               [ Période : 01/03/2025 - 31/03/2025 ] |
+-----------------------------------------------------------------------------------------------------------------------------------------+
```

**Au clic sur `[ 📅 Mars 2025 ▾ ]` (Quick Jump Popover)** :
```text
+------------------------------------------+
|  Année :  [ ◀ ]    2025    [ ▶ ]         |
|------------------------------------------|
|  [ Jan ]  [ Fév ]  [ Mar*]  [ Avr ]      |
|  [ Mai ]  [ Juin ] [ Juil ] [ Août ]     |
|  [ Sept ] [ Oct ]  [ Nov ]  [ Déc ]      |
|------------------------------------------|
|  Ou Trimestre :                          |
|  [ T1 (Jan-Mar) ]      [ T2 (Avr-Juin) ] |
|  [ T3 (Juil-Sept) ]    [ T4 (Oct-Déc) ]  |
+------------------------------------------+
```

## Risks / Trade-offs

- **[Risk]** Complexité des calculs de décalage de dates en JavaScript natif.
  - → *Mitigation* : Toutes les opérations arithmétiques sont isolées dans `src/utils/periodNavigator.ts` avec des fonctions pures et testées.
- **[Risk]** Fermeture et gestion du clic extérieur pour le Popover.
  - → *Mitigation* : Utilisation d'une directive de détection de clic extérieur ou listener standard sur `window`.
