# Li Auto dashboard

Statyczny dashboard dla przeglądarki Li Auto, publikowany przez GitHub Pages pod adresem **https://li.walin.ski**. Nie wymaga instalowania zależności ani budowania projektu. Zachowaj plik `CNAME` przy publikacji.

## Funkcje

- Duży zegar 24-godzinny i polska data według czasu urządzenia.
- Krótka nazwa skrótu „Dashboard” i ikona panelu multimediów w formatach PNG, SVG oraz ICO, z manifestem i ikoną ekranu startowego.
- Oficjalne odtwarzacze playlist Spotify i YouTube; nie rozpoczynają odtwarzania automatycznie.
- Własne playlisty przez „Dodaj playlistę” / „Zmień playlistę”, automatyczne nazwy playlist, usuwanie wyboru i playlisty przykładowe.
- Ostatnie playlisty i wygląd zapisane w `localStorage` danej przeglądarki; bez kont dashboardu, tokenów i haseł.
- Zatrzymanie przez wyładowanie odtwarzacza, ponowne wczytanie, jasny / ciemny wygląd oraz pełny ekran, jeśli przeglądarka go obsługuje.
- Logo i nazwa Spotify / YouTube w nagłówku panelu otwierają pełny serwis w nowej karcie (`target="_blank"`, `rel="noopener"`). Dashboard pozostaje otwarty.

## Playlisty i ograniczenia

**Spotify:** użyj publicznej playlisty i linku `https://open.spotify.com/playlist/ID`. Obsługiwane są też linki z parametrami udostępniania, lokalizacją `/intl-pl/`, `/embed/playlist/` i URI `spotify:playlist:ID`. Krótkie linki przekierowujące, np. `spotify.link`, trzeba najpierw otworzyć i skopiować docelowy adres playlisty.

**YouTube:** użyj publicznej lub niepublicznej playlisty dostępnej przez link `https://www.youtube.com/playlist?list=ID`. Obsługiwane są też linki filmów zawierające `list=ID`, linki `youtu.be` z playlistą i YouTube Music. Link do samego filmu nie jest playlistą. Prywatne listy „Do obejrzenia”, „Polubione” i automatyczne miksy `RD…` nie są obsługiwane. Niektóre filmy mają blokadę osadzania, ograniczenia wieku lub dostępności.

Osadzone odtwarzacze nie są pełnymi aplikacjami. Do logowania, wyszukiwania i biblioteki służą klikalne nagłówki Spotify / YouTube. Zalogowanie w pełnym serwisie nie gwarantuje zalogowania w iframe; wpływają na to pliki cookie i ograniczenia przeglądarki. Pełne odtwarzanie Spotify zależy od konta, DRM i wsparcia przeglądarki — możliwe są tylko krótkie fragmenty. Wymagany test w samochodzie.

Nazwy playlist pobierane są z oficjalnych endpointów oEmbed Spotify i YouTube bez kluczy API i bez danych logowania. Nazwa jest zapisywana jako zwykły tekst, aktualizowana przy otwarciu dashboardu i zmianie playlisty. Po 8 sekundach lub błędzie pozostaje ostatni prawidłowy tytuł albo neutralny podpis „Playlista Spotify” / „Playlista YouTube”. Linki do filmów z `list=…` są najpierw zamieniane na adres playlisty, aby nie pobrać tytułu pojedynczego filmu. Spóźnione odpowiedzi poprzedniej playlisty są ignorowane.

Iframe'y nie łączą się z serwisami, dopóki użytkownik nie doda playlisty lub nie wybierze przykładowej. Zapisane playlisty wczytują się przy kolejnym otwarciu dashboardu. Wszystkie osoby używające tej samej przeglądarki widzą te same playlisty. Zatrzymanie nie usuwa zapisanego wyboru; wznowienie wczytuje odtwarzacz od nowa.

## Skrót na ekranie startowym Li Auto

Tytuł strony, `application-name`, `apple-mobile-web-app-title` oraz manifestowe `name` i `short_name` mają nazwę **Dashboard** (9 znaków), aby etykieta skrótu była krótka. Strona deklaruje PNG 192/512, osobną ikonę maskable 512, ikonę touch 180, SVG oraz klasyczny wielorozmiarowy ICO 16/32/48. Manifest zachowuje uruchamianie w przeglądarce (`display: browser`).

Już dodany skrót może zachować dawną ikonę i nazwę w pamięci launchera. Po wdrożeniu odśwież stronę i dodaj skrót ponownie w samochodzie. Nie trzeba usuwać danych przeglądarki ani zapisanych playlist. Obsługa aktualizacji istniejącego skrótu zależy od Li Auto.

Źródłem wektorowym jest `favicon.svg`; statyczne PNG i ICO można odtworzyć na Windows poleceniem `pwsh -File scripts/generate-icons.ps1` (System.Drawing, bez zewnętrznych zależności).

## Rozmiar interfejsu w samochodzie

W nagłówku wybierz **Rozmiar → Auto** lub ręczne powiększenie 100–250%. Auto powiększa cały dashboard na ekranach szerszych niż 1440 pikseli CSS (np. 200% przy szerokości 2880), łącznie z kontrolkami osadzonych odtwarzaczy. Ręczny wybór jest zapamiętany w tej przeglądarce i pozostaje taki sam przy wejściu lub wyjściu z pełnego ekranu. Zmiana rozmiaru nie przeładowuje odtwarzaczy.

Układ dobiera kolumny według szerokości dostępnej po powiększeniu, a wysokość formularza według dostępnej wysokości. Na małym ekranie opcje, które zostawiłyby mniej niż 360 px szerokości, są wyłączone; zapisany zbyt duży rozmiar tymczasowo przechodzi na Auto. W przeglądarce bez CSS `zoom` pozostaje rozmiar 100%. Powiększona strona zachowuje przewijanie.

## Testy Bluetooth i GPS w samochodzie

Dwa małe panele pod zegarem sprawdzają dostęp udostępniany stronie przez przeglądarkę. Zielony oznacza udany odczyt dostępności Web Bluetooth albo potwierdzony wybór urządzenia BLE / odczyt lokalizacji. Czerwony opisuje brak API, brak poprawnego HTTPS, odmowę dostępu lub nieudaną próbę odczytu. Stan „Do sprawdzenia” / „Nie potwierdzono” nie jest błędem sprzętu.

- Bluetooth: `getAvailability()` uruchamia się przy otwarciu strony, jeśli istnieje. Przycisk „Sprawdź Bluetooth” wywołuje `requestDevice({acceptAllDevices: true})` bezpośrednio po kliknięciu i otwiera wybór urządzenia. Test dotyczy BLE; nie testuje Bluetooth Classic / audio ani nie łączy się z usługami GATT.
- GPS: kliknij „Sprawdź GPS” i zezwól stronie na lokalizację. Jednorazowy `getCurrentPosition()` żąda wysokiej dokładności, z limitem odczytu 15 sekund i bez używania starej pozycji. Widać wyłącznie powodzenie i dokładność; współrzędne nie są wyświetlane, zapisywane ani wysyłane przez dashboard. Geolokalizacja może korzystać z GPS lub sieci i nie potwierdza konkretnego odbiornika GPS.
- Po 25 sekundach bez wyniku interfejs pozwala ponowić test; spóźnione wyniki poprzedniej próby są ignorowane. Czas oczekiwania na zgodę może nie być wliczany do timeoutu samego API.
- Wymagany jest bezpieczny kontekst (`window.isSecureContext`). Publiczny HTTP zablokuje oba testy niezależnie od sprzętu; localhost zwykle jest bezpiecznym kontekstem. Domena `li.walin.ski` musi mieć prawidłowy certyfikat HTTPS. Testy nie zmieniają uprawnień strony ani ustawień samochodu.

## Sprawdzenie lokalne

Można użyć dowolnego serwera statycznego. Otwieraj przez HTTP(S), nie `file://`: YouTube wymaga nagłówka Referer. Strona i iframe'y używają `strict-origin-when-cross-origin`.

```sh
node --check app.js
node --check playlist-links.js
node --check device-diagnostics.js
node --check display-scale.js
node --test tests/*.test.cjs
```

Przed publikacją: sprawdź oba przykłady, zmianę playlisty, błędny link, zachowanie po odświeżeniu, usunięcie, zatrzymanie/wznowienie, tryby wyglądu i szerokości ekranu.

## Dokumentacja usług

- [Spotify Embeds](https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed)
- [Spotify — rozwiązywanie problemów](https://developer.spotify.com/documentation/embeds/tutorials/troubleshooting)
- [Spotify — prywatność playlist](https://support.spotify.com/us/article/playlist-privacy-and-access/)
- [YouTube — osadzanie filmów i playlist](https://support.google.com/youtube/answer/171780?hl=en)
- [YouTube — prywatność playlist](https://support.google.com/youtube/answer/3127309?hl=en)
- [Chrome — Web Bluetooth i wymagania dostępu](https://developer.chrome.com/docs/capabilities/bluetooth)
- [W3C — Geolocation](https://www.w3.org/TR/geolocation/)
