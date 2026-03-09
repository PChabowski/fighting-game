## Plan: Naprawa zatrzymanego połączenia (Multiplayer)

Problem zawieszenia klienta połączonego przez zewnętrzną sieć jest wynikiem gubienia przez Hosta "pakietów startowych". Występuje tu tzw. "wyścig" w którym pakiet gry wysłany przez usera A jest odrzucany, ponieważ połączenie sieciowe miedzy A i B nie zdążyło przejść ze statusu `connecting` do `open`.

**Steps**
1. Usunięcie wadliwego, przedwczesnego wywoływania połączonego zdarzenia po stronie Hosta (`onConnectionCallback`).
2. Poprawa funkcji uruchamiającej grę, by opierała się tylko na zweryfikowanym stanie otwarcia połączenia z Klientem (`connection.on('open')`).
3. (Opcjonalnie dla stabilności) Dodanie standardowych darmowych publicznych serwerów STUN Google do obiektów `new Peer({ config: { iceServers: [...] } })`.

**Relevant files**
- `src/utils/peer.js` — modyfikacja metody `initHost()` i sposobu rejestracji zdarzenia `on('connection')`.

**Verification**
1. Otworzenie gry na PC (sieć domowa/WiFi) -> utwórz jako Host.
2. Otworzenie gry na smartfonie (włączone dane LTE, wyłączone WiFi) -> dołącz jako Klient.
3. Weryfikacja wizualna: czy zniknie napis "Connecting..." u klienta, a obu graczom pojawi się ekran wyboru postaci.

**Decisions**
- Użyjemy domyślnych, darmowych serwerów STUN od Google (np. `stun.l.google.com:19302`). Darmowe rozwiązanie jest w pełni wystarczające do testowania Twojej gry i dla dużej części graczy. Nie dodajemy na ten moment płatnych serwerów TURN (wymaganych jedynie przez BARDZO restrykcyjne sieci np. firmowe firewalle).