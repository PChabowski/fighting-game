## Plan: Rozstrzygnięcie sterowania dla trybów gry z uwzględnieniem trybów sieciowych i lokalnych + Nawigacja w Menu

TL;DR - Rozróżniamy dwa główne środowiska w grze bazując na sieci.
1) **Gry lokalne jednourządzeniowe (PvP i Arcade):** Mają tu działać dwa pady (Pad 1 dla Gracza 1, Pad 2 dla Gracza 2, by móc grać ze znajomym obok w PvP). Błąd polega tu na tym, że drążek w pozycji środkowej bezlitośnie resetuje co klatkę ruch przypisany do postaci i gubi klucz dla odpowiedniej animacji (`lastKey`), przez co stoisz w miejscu wykonując jedynie skoki i ciosy. Zmiana pozwoli chodzić normalnie postaci podpiętej do drążków.
2) **Online Multiplayer (przez sieć, 2 oddzielne urządzenia / przeglądarki):** Pierwszy wpięty pad błędnie próbował ruszać "gospodarzem" gry. W nowym schemacie pad na konkretnym urządzeniu będzie przypisywany wyłącznie odpowiednio dla danej przeglądarki i Twojej postaci (`localFighter`). Dodatkowo w nowych pod-menu sieciowych dodajemy obsługę nawigowania d-padem/analogiem.

**Kroki**
1. Oczyszczenie w `src/utils/input.js` funkcji z ciągłego, co-klatkowego ucinania akcji chodu w grach na jednym ekranie (`pressed = false` przy luzie gałki). Dodanie możliwości parametryzacji: 
    - **Gra Lokalna (Arcade / PvP):** Gamepad nr 1 kontroluje Postać nr 1. Gamepad nr 2 odpowiednio Postać wroga (Enemy).
    - **Online Multiplayer (Sieć):** Pierwszy pad dla każdej z osób odpowiada wyłącznie za klawiaturę dla postacii lokalnej (`localFighter`).
2. Dostosowanie wywołań the game loopa w `src/game.js`, żeby wskazać funkcjom wyłuskane obiekty.
3. Podpięcie klas z podświetleniami i strzałek d-pada przy oknach dla Menu Trybu Sieciowego:
   - `src/ui/MultiplayerMenu.js`
   - `src/ui/JoinMenu.js`
   - `src/ui/MultiplayerLobby.js`

**Weryfikacja**
1. Swobodne poruszanie się postacią (bez blokowania) we wszystkich panelach i trybach gier na jednym ekranie (np. PvP dwóch graczy).
2. Sprawdzenie, czy Gamepad "Gościa" w trybie sieciowym ożywia w końcu jedynie jego sylwetkę na ekranach obydwu graczy.
3. Nawigacja padem i przyciskami A/B w całym nowym UI online.