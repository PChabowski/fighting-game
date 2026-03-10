Versioning & Release Workflow
============================

Cel
----
Krótka, powtarzalna procedura wersjonowania gry oparta na standardzie Node.js (package.json) w nowym środowisku React/Vite.

Zasady ogólne
-------------
- Stosuj Semantic Versioning (MAJOR.MINOR.PATCH). Przykład: `2.0.0`.
- Główne źródło prawdy: `package.json`.
- Prowadź zmiany w `CHANGELOG.md` zgodnie z konwencją "Keep a Changelog".
- Każde wydanie powinno mieć:
  - Aktualizację w `package.json` z użyciem komendy `npm version`, co automatycznie stworzy commit i tag w Gicie, o ile projekt jest z nim połączony.
  - Wpis w `CHANGELOG.md`.

Krok po kroku — jak zrobić nowe wydanie
--------------------------------------
1. Upewnij się, że wszystkie zmiany są zmergowane w gałęzi, z której chcesz wydać (np. `main`).
2. Dodaj nowy wpis do `CHANGELOG.md` zgodnie z `Keep a Changelog`.
3. Zaktualizuj wersję za pomocą komendy systemowej (npm zaktualizuje `package.json` i zrobi commit dla wersji, np.):
   ```bash
   npm version minor -m "chore(release): v%s"
   ```
   *Uwaga: możesz użyć `patch`, `minor` lub `major` zależnie od rozmiaru zmian.*

4. (Opcjonalnie) Wypchnij zmiany do repozytorium zdalnego wraz z tagami:
   ```bash
   git push origin main --tags
   ```

Weryfikacja
-------------------
- Otwórz aplikację dewelopersko lub na serwerze i sprawdź czy w lewym dolnym rogu głównego menu wyświetla się poprawna wersja (system zaczytuje do interfejsu kluczyk konfiguracyjny zdefiniowany via Vite).

Informacje techniczne
--------------------------------
Zmienna z `package.json` oznaczona jako `process.env.npm_package_version` jest przenoszona na front i dostępna pod stałą globalną `__APP_VERSION__` zdefiniowaną w pliku `vite.config.js`. Plik `GameMenu.jsx` zaczytuje ją podczas renderowania ekranu.

