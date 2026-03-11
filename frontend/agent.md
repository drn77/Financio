# AGENTS.md

Ten dokument opisuje standard pracy dla agentów i deweloperów w tym projekcie React + TypeScript.

## 1. Session Protocol

1. Nie pytaj o aprobatę dla rutynowych komend i edycji plików.
2. Nie modyfikuj `README.md`.
3. Uruchom `eslint --fix` po każdej modyfikacji pliku (zmodyfikowane/utworzone pliki).
4. Uruchom `tsc --noEmit` po zmianach struktury folderów/importów i przed oddaniem zmiany.
5. Usuń martwy kod w tej samej zmianie; nie odkładaj cleanup na później.
6. Formatowanie spójne z regułami linta projektu — `eslint --fix` na dotkniętych plikach jest obowiązkowy.
7. Jeśli podczas pracy odkryjesz nową, wartościową zasadę, zaproponuj dopisanie do `AGENTS.md` i zastosuj dopiero po akceptacji użytkownika.

## 2. Struktura modułów i komponentów

### Folder komponentu

- Podkomponenty trzymamy wewnątrz komponentu nadrzędnego, jeśli są używane lokalnie.
- Folder `Hooks` zawiera custom hooki dla danego komponentu.

### Zakaz plików `.tsx` o nazwie komponentu

- Nie tworzymy plików `.tsx` nazwanych od komponentu (np. `FormBuilder.tsx`).
- Każdy komponent musi mieć własny podfolder o nazwie komponentu ze standardowym plikiem `index.tsx` jako plikiem wejściowym (np. `FormBuilder/index.tsx`).
- Interfejsy, zasoby i utilsy wyłączne dla danego komponentu przenosimy do jego folderu: `model.ts`, `resources.ts`, `utils.ts`.
- Współdzielone typy/zasoby/utilsy pozostają w pliku nadrzędnym (parent `model.ts`/`resources.ts`/`utils.ts`).

### Zakaz pass-through wrapperów

- Nie tworzymy komponentów-wrapperów, które jedynie przekazują propsy do innego komponentu bez dodania logiki, stanu, transformacji ani dodatkowego UI.
- Jeśli `withForm` wrapper tylko deleguje `form` i pozostałe propsy do jednego dziecka, jest zbędny — caller powinien bezpośrednio używać docelowego komponentu.
- Każdy komponent musi wnosić własną wartość: hook, transformację danych, warunek renderowania, kompozycję wielu dzieci lub własny UI.

### Standardowe pliki

- `index.tsx`: główny komponent (jeden plik wejściowy na folder komponentu).
- Jeśli komponent ma własny folder, plik wejściowy nazywamy `index.tsx` (nie `ComponentName.tsx`).
- `model.ts`: typy i interfejsy.
- `resources.ts`: lokalne stałe i lokalne tłumaczenia komponentu.
- `utils.ts`: atomowe funkcje z pełnym typowaniem wejścia i wyjścia.
- `styles.ts`: tylko gdy inline/className przestają być czytelne.
- `index.translation.ts`: tylko w głównym folderze modułu, wyłącznie agregacja tłumaczeń.
- Wszystko co zwraca HTML musi być komponentem.

### Zasady `styles.ts`

- Tworzymy `styles.ts` tylko gdy realnie jest potrzebny.
- Zakazane: puste klasy, puste exporty, puste klucze styli.
- Każda zdefiniowana klasa musi być używana.
- Po refaktorze usuwamy nieużywane klasy i cały plik, jeśli stał się zbędny.

## 3. Zasady plików

### `index.tsx`

- Poza importami nie umieszczamy helperów i stałych globalnych dla pliku.
- Preferowana kolejność sekcji w komponencie:
  1. Stałe z hooków (`t`, `history`, `params`, `queryClient` itd.)
  2. React Query (`useQuery`, `useMutation`) oparte na `api.*`
  3. `useReducer` (jeśli potrzebny)
  4. `useState`
  5. `useMemo`, `useEffect`
  6. Funkcje lokalne
  7. `return` (JSX)
- Wyjątek: jeśli konfiguracja query (`variables`, `enabled`) zależy od lokalnego stanu, taki blok query może być umieszczony po `useState`.
- Między sekcjami dokładnie 1 pusta linia.
- W pliku `index.tsx` jeden główny komponent i jeden główny `return`.

### `resources.ts`

- Plik atomowy, zawiera tylko dane własnego komponentu.
- Nie importuje `Resources/Translation` z innego `resources.ts`.
- `Translation` zawiera tylko klucze bieżącego komponentu (bez dzieci).
- Tłumaczenia dzieci zostają w `resources.ts` dziecka.
- Jeśli coś istnieje w global resources, nie duplikujemy lokalnie.
- Nie budujemy dynamicznie kluczy i18n z runtime ids/order.

### `index.translation.ts`

- Wyłącznie agregacja tłumaczeń modułów.
- Bez transformacji typu wycinanie lub merge fragmentów obiektu bazowego.
- Styl spójny z projektem: tablice `EN/PL/JA`.

### `model.ts`

- Props komponentu zawsze jako `interface Props`.
- Pozostałe interfejsy/typy zaczynają się od `I`.
- Enumy zaczynają się od `E`.
- Nie tworzymy pustych typów/interfejsów.
- Współdzielone typy FE/BE importujemy z `types`.

## 4. Ogólne zasady TypeScript i React

- Sekcje kodu oddzielamy jedną pustą linią.
- Jedną pustą linię między deklaracjami funkcji.
- Stosujemy nazewnictwo angielskie i semantyczne.
- Komponenty preferencyjnie tworzymy jako `export function ComponentName`.
- Jeśli scope wymaga hoistingu/czytelności, dozwolona jest deklaracja `function`.
- `props` zawsze rozpakowane (`const { a, b } = props`).
- Zakaz `any`; `unknown` tylko na granicach integracji i z natychmiastowym zawężeniem typu.
- Każdy stan, selector, formularz i funkcja musi być typowany.
- Preferujemy guard clauses (`if (...) return`) zamiast `else`.
- Preferujemy optional chaining dla zagnieżdżonych obiektów.
- Preferujemy single-line conditions gdy czytelne.
- Każda dynamicznie renderowana lista musi mieć stabilny `key`.
- Preferujemy fat arrow functions.
- Handlery wewnątrz komponentu preferencyjnie jako arrow function, o ile scope na to pozwala.
- Zakaz `.bind(...)` w JSX i propsach eventów.
- Funkcje przekazywane do propsów powinny być proste (preferowane jednolinijkowe, jeśli czytelne).
- Poza `return` nie umieszczamy JSX/HTML (wyjątki tylko gdy realnie redukują złożoność, np. context/modal).
- Logikę `map/filter/reduce` wynosimy do `utils.ts`, gdy poprawia to czytelność.
- Prywatne helper functions zaczynają się od `_` (np. `_buildPayload`, `_mapItems`).
- Maksymalny poziom zagnieżdżenia poza `return`: 5.
- Maksymalny poziom zagnieżdżenia tabów: 10.
- Nie używamy `px` w stylach/klasach; stosujemy `rem` (lub design tokens).
- Usuwamy nieużywane importy, zmienne, funkcje, typy, pliki i style natychmiast.
- Jeśli formatowanie pliku koliduje z lokalną preferencją, reguły eslint projektu wygrywają.

## 5. API i React Query

- Query i mutation budujemy na `api.*`.
- Nazwy query/mutation powinny odzwierciedlać `api.*`.
- Nie przekazujemy `variables: undefined` do query/mutation, jeśli endpoint nie wymaga `variables`.
- W nowych/migrowanych ekranach używamy wyłącznie React Query (nie dispatch-based data flow).
- Dla migrowanych obszarów używamy ModulesV2 API.
- Po udanym mutation obowiązkowo `invalidateQueries` dla danych powiązanych.
- API path policy: jeden właściwy endpoint, bez fallbacków i alternatywnych `basePath`.
- Niezależne promisy uruchamiamy równolegle (`Promise.all`).
- `useHistory` zapisujemy jako `history`.

## 6. Komponenty współdzielone

- Jeśli komponent istnieje w `/components`, używamy go zamiast tworzenia własnego HTML o tej samej funkcji.
- Nie wyłączamy i nie dublujemy bazowej funkcjonalności komponentów z `/components` (np. `Tabs`); używamy natywnego API.
- Jeśli komponent ma natywne API (np. `items.children`), używamy go.
- Workaround dopuszczalny tylko przy realnym ograniczeniu technicznym; musi być krótko opisany w kodzie.
- Unikamy placeholderów w tabkach oznaczonych jako migrowane.
- Stałe danych przechowujące wartości lookup (szczególnie numeryczne mapy `Record<number, string>`) muszą być reprezentowane w stanie komponentu jako `string[]` i synchronizowane ze zmianami kontekstu (np. język).
- Pola settings oparte na słowniku muszą używać kontrolek typu `Select`, nie free-text inputs.
- Dla settings opartych na słowniku, persystujemy wartości identyfikatorów (number/id), nie display labels/text.
- Do wyświetlania tekstu używamy komponentu. Nie stosujemy surowych tagów HTML (`<p>`, `<span>`, `<h1>` itd.) do renderowania treści tekstowej.

## 7. Table Rules (DataTable / TanStack)

1. Table `getPage` queries muszą używać `IPageResponse<T[]>` na frontendzie (`items`, `empty`, `pagination.total`, `pagination.page`).
2. Nie używamy `IPage` (`Data`/`Count`) w nowo migrowanych modułach tabel.
3. Domyślna kompozycja tabeli: `DataTableProvider` + `Card variant="table"` + `ScrollArea` + `DataTable`.
4. `recordCount` bazuje na `pagination.total`, nie na długości bieżącej strony.
5. Dla server pagination/sorting/filtering włączamy manual mode w `useReactTable` i podpinamy stan przez hook `useTableConfig`.
6. Przyciski akcji tabeli (`edit/delete/details`) muszą zatrzymać propagację (`stopPropagation`) przed otwarciem dialogów lub uruchomieniem mutacji.
7. Jeśli dialog zamraża się gdy table/provider jest zamontowany, trzymamy stan dialogu w pełni kontrolowany i przenosimy dialog poza `DataTableProvider`.
8. Definicje kolumn tabeli typujemy (`ColumnDef<T>`) i stabilizujemy (`useMemo` / dedykowany config hook).
9. Stan tabeli pochodzi z `useTableConfig` (lub odpowiednika) i jest przekazywany 1:1 do `useReactTable` (`pagination`, `sorting`, `columnFilters`, `columnOrder` + settery).
10. `useTableConfig` inicjalizujemy przed `useReactTable`; `useReactTable` nie może posiadać zduplikowanego stanu tabeli.
11. `useReactTable` konsumuje dane query z tego samego źródła `getPage` co `recordCount` (`items` + `pagination.total`).

## 8. UX i i18n

- Klikalne elementy muszą mieć `cursor: pointer` (jeśli nie wynika to już z komponentu bazowego).
- Modal ma mieć własny scroll, tło nie powinno scrollować.
- Footer akcji modala nie może nachodzić na ostatnie pole formularza.
- Układ mobilny musi być stabilny (bez horizontal overflow).
- Tłumaczenia `JA/PL/EN` muszą być semantycznie spójne.
- Pliki tłumaczeń zapisujemy w UTF-8 bez uszkodzeń znaków.
- Klucze tłumaczeń powinny odzwierciedlać strukturę plików.
- `useTrans` przyjmuje zwykły string (nie enum).

## 9. Wyjątki

- Wyjątki od powyższych zasad są dopuszczalne tylko wtedy, gdy:
  - istnieje ograniczenie techniczne.
  - brak wyjątku istotnie pogarsza czytelność lub utrzymanie.
  - wyjątek jest krótko uzasadniony w kodzie lub PR.
- Dotyczy to rootu danego widoku importowanego w routerze (np. `lazy(() => import('@/views/...'))`).
- Taki root widoku musi mieć `default export`.
- W takich przypadkach preferowany zapis to `export default function ComponentName()`.

---

## 10. Backend Contract (ModulesV2)

### 10.0 Scope

1. Nową logikę backendową implementujemy w `src/modules_v2`.
2. `src/modules` traktujemy jako referencję historyczną; modyfikujemy tylko na jawne życzenie użytkownika.

### 10.1 Layering (obowiązkowy)

1. Controller wywołuje tylko Context/Business actions.
2. Context/Business actions wywołują tylko ActionService.
3. Brak logiki DB/technicznej w Controller lub Business action.
4. ActionService zawiera logikę techniczną (Prisma, integracje, low-level mapping).
5. Jedna metoda techniczna = dokładnie jedno zapytanie Prisma.
6. Każda metoda techniczna musi mieć dekorator `@SetAction(...)`.
7. Każda metoda business/context musi mieć dekorator `@SetActionContext()`.
8. Controllers wstrzykują tylko context services.
9. Context services wstrzykują tylko actions services.
10. Actions services nie wstrzykują context services ani peer actions/context.
11. Współdzielona orkiestracja między kontrolerami: dedykowany `*-shared.service.ts`.
12. Controllers nie wstrzykują actions services bezpośrednio.
13. Controllers nie wstrzykują innych controllers.
14. Context services nie wstrzykują innych context services.

### 10.2 Endpoints / DTO

1. Nowe endpointy w `/api/v2/modules/...`.
2. Jawne request/response DTO.
3. Nie zostawiamy tymczasowych endpointów bez użycia (wyjątek: jawny admin-only scope).
4. Aktualizacja frontend API client w tej samej zmianie gdy zmienia się kontrakt endpointu.
5. Moduły settings-like muszą eksponować batch endpoints (`/many`) gdy UI edytuje wiele wierszy naraz.
6. CUD contract dla modułów settings-like:
   - `create` zwraca tylko utworzoną encję
   - `update` zwraca tylko zaktualizowaną encję
   - `delete` zwraca `void`

### 10.3 Validation / Security

1. Walidacja `body`, `params`, `query` na poziomie endpointu (ValidationPipe/schema).
2. Respektujemy auth/authz i org/user context na każdym endpoincie.
3. Nie logujemy wrażliwych danych.
4. W ActionService walidujemy kontekst organizacji jawnie i fail fast gdy brakuje.
5. Walidujemy referencyjne encje (istnienie i aktywny status) przed create/update.
6. `create`, `update`, `delete` — każdy ma dedykowany validation pipe.
7. Validation pipes mogą używać Prisma bezpośrednio do sprawdzania zależności przez prywatne helpery.
8. W delete validation pobieramy encję z includes na lokalizacje użycia i failujemy gdy lista użycia jest niepusta.
9. Preferujemy body payload nad query parameters.
10. `IdsValidationPipe` dla id/int route params domyślnie.
11. Dedykowane pipes endpointów używają walidacji zod.
12. Nazwy plików pipe powinny odzwierciedlać nazwy endpointów/operacji.

### 10.4 Data / Migrations

1. Zmiany schematu: migracja + seeds + aktualizacja typów w tej samej zmianie.
2. Seeds kompletne dla wymaganych parametrów/kluczy.
3. Unikamy destrukcyjnych operacji na danych bez jawnego powodu biznesowego.

### 10.5 Quality / Verification

1. Preferujemy guard clauses nad `else`.
2. Usuwamy martwy kod w tej samej zmianie.
3. `Promise.all` dla niezależnych operacji async.
4. Uruchamiamy backend lint + typecheck po modyfikacjach backendu.
5. Frontend `invalidateQueries` musi działać z danymi zwracanymi przez mutation.
6. Pliki modułów strukturalnie spójne z istniejącym stylem ModulesV2 (`#region Private/Create/Read/Update/Delete/Misc`).
7. Preferujemy jawne metody `create`, `update`, `createOrUpdate`, `createOrUpdateMany` w settings-like ActionService.
8. Kolejność regionów: `Private` → `Create` → `Read` → `Update` → `Delete` → `Misc`.
9. W async methods zwracających `Promise<void>` używamy jawnego `return;` na końcu (controllers mogą pominąć).
10. Bloki regionów obecne nawet gdy aktualnie puste, dla spójności strukturalnej.
11. W `Private` region dodajemy helpery tylko gdy reużywane przez co najmniej dwie metody.

### 10.6 Table Pagination Contract (Backend)

1. Endpoint serwujący strony tabeli (`getPage`) musi zwracać `IPageResponse<T[]>`.
2. Legacy `IPage` (`Data`, `Count`) zabroniony dla nowo migrowanych ModulesV2.
3. Jawne mapowanie response:
   - `items`: lista wierszy
   - `empty`: `items.length === 0`
   - `pagination.total`: całkowita liczba pasujących wierszy
   - `pagination.page`: bieżący indeks strony (zero-based)
4. Jeśli endpoint nadal używa `from/count`, konwertujemy na `pagination.page` (`Math.floor(from / count)` gdy `count > 0`).
5. Flowy CUD zwracające odświeżone dane tabeli zachowują ten sam kontrakt `IPageResponse<T[]>`.
6. Frontend API client i backend response contract aktualizujemy w tej samej zmianie.

---

## 11. Definicja ukończenia zmiany (DoD)

Przed oddaniem zmiany wykonujemy:

1. Eslint przeszedł dla dotkniętych plików.
2. `tsc --noEmit` przeszedł (obowiązkowy dla zmian struktury/importów).
3. Brak `any`/`unknown` (poza jawnym zawężeniem na granicach integracji).
4. Brak nieużywanych importów/zmiennych/plików/styli.
5. Brak placeholderów w migrowanych tabkach.
6. Brak duplikacji funkcjonalności komponentów współdzielonych.
7. Tłumaczenia kompletne i poprawne w EN/PL/JA.
8. ModulesV2 layering respektowany na backendzie.
9. Poprawne `invalidateQueries` po mutacjach.
10. Brak zmian w README.
11. Moduły tabel używają `IPageResponse` end-to-end (frontend API + backend getPage).
12. Audyt pustych i nieużywanych elementów (`index.tsx`, `model.ts`, `resources.ts`, `utils.ts`, `styles.ts`).
13. Usunięcie martwego kodu i placeholderów „na później".
14. Weryfikacja użycia klas z `styles.ts`.
15. Kontrola wyszukiwaniem (np. `rg`) pod kątem nieużywanych elementów.

## 12. Financio Project Specifics

### Stack
- Next.js 16 (App Router, `src/` directory)
- shadcn/ui (raw component primitives in `src/components/ui/`)
- Tailwind CSS v4
- TypeScript strict mode

### Path Aliases
- `@/*` → `./src/*`
- `@shared/*` → `../types/*` (shared FE/BE contracts)

### Component Library (shadcn/ui)
1. shadcn/ui primitives live in `src/components/ui/` — do not modify unless necessary.
2. Custom reusable components (e.g., `TextInput`, `PasswordInput`) each get their own folder in `src/components/<Name>/` following standard file conventions.
3. Use `cn()` utility from `@/lib/utils` for className merging.
4. Use `lucide-react` for icons.

### Auth
1. Auth context via `@/lib/auth-context.tsx` (`AuthProvider` + `useAuth` hook).
2. API client in `@/lib/api.ts` — all backend calls go through this.
3. JWT token stored in `localStorage` under key `accessToken`.
4. Backend API base: `NEXT_PUBLIC_API_URL` env var (default `http://localhost:6001`).
5. Auth endpoints: `POST /api/v2/auth/login`, `POST /api/v2/auth/register`, `GET /api/v2/auth/profile`.

### Environment
1. `.env.local` for local frontend env vars.
2. Backend runs on port `6001`, frontend on port `6000`.

