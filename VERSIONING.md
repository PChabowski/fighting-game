Versioning & Release Workflow
============================

Cel
----
Krótka, powtarzalna procedura wersjonowania gry oraz lista kroków jakie wykonałem przy wydaniu `v1.1.0`.

Zasady ogólne
-------------
- Stosuj Semantic Versioning (MAJOR.MINOR.PATCH). Przykład: `1.1.0`.
- Prowadź zmiany w `CHANGELOG.md` zgodnie z "Keep a Changelog".
- Każde wydanie powinno mieć:
  - aktualizację obiektu `APP_VERSION` w `src/utils/constants.js`,
  - wpis w `CHANGELOG.md`,
  - commit z konwencją: `chore(release): vX.Y.Z`,
  - opcjonalny tag git: `vX.Y.Z`.

Gałęzie i nazewnictwo
---------------------
- Feature / naprawy: `feature/*`, `fix/*` lub `fix-control` (jak było teraz).
- Przygotowanie wydania: `release/vX.Y.Z` (opcjonalnie).

Krok po kroku — jak zrobić nowe wydanie
--------------------------------------
1. Upewnij się, że wszystkie zmiany są zmergowane do gałęzi, z której chcesz wydać (np. `main` lub `release/*`).
2. Zwiększ wersję w `src/utils/constants.js`:

```javascript
export const APP_VERSION = {
  version: 'X.Y.Z',
  branch: 'nazwa-gałęzi',
  lastUpdate: 'YYYY-MM-DD'
};
```

3. Dodaj wpis do `CHANGELOG.md` zgodnie z `Keep a Changelog` (sekcje `Added`, `Changed`, `Fixed`).
4. Upewnij się, że na canvasie wyświetlana jest wersja (implementacja korzysta z `APP_VERSION`).
5. Commituj zmiany:

```bash
git add src/utils/constants.js CHANGELOG.md
git commit -m "chore(release): vX.Y.Z"
```

6. (Opcjonalnie) Otaguj wydanie i wypchnij:

```bash
git tag vX.Y.Z
git push origin <branch>
git push origin vX.Y.Z
```

7. Zaktualizuj numer wersji w dokumentach projektowych jeśli potrzeba (np. `README.md`, `PROJECT_STATE.md`).

Testy i weryfikacja
-------------------
- Otwórz `index.html` lokalnie i sprawdź, że w menu głównym w lewym dolnym rogu jest widoczna wersja.
- Sprawdź format daty `lastUpdate` (YYYY-MM-DD).

Co zrobiłem teraz (podsumowanie)
--------------------------------
- Dodałem `APP_VERSION` do `src/utils/constants.js`:
  - `{ version: '1.1.0', branch: 'fix-control', lastUpdate: '2026-03-05' }`.
- Stworzyłem `CHANGELOG.md` z wpisem dla `v1.1.0` (Keep a Changelog).
- Zmodyfikowałem `src/game.js` tak, aby renderować wersję na canvasie (lewy dolny róg).

Dodatkowe uwagi
----------------
- Renderowanie wersji używa logicznego rozmiaru canvasa (interna rozdzielczość ustawiana przez `initResponsiveCanvas`) — pozycjonowanie powinno być stabilne niezależnie od skalowania CSS.
- Jeśli chcesz automatyzować tworzenie release'ów, mogę dodać prosty skrypt `release.sh` który wykona powyższe kroki.

Kontakt
-------
Jeśli chcesz, że zacommituję i wypchnę te zmiany na gałąź `fix-control`, daj znać — wykonam commit i push.
