# Li Auto dashboard

Statyczny dashboard dla przeglądarki Li Auto, publikowany przez GitHub Pages pod adresem **https://li.walin.ski**. Nie wymaga instalowania zależności ani budowania projektu. Zachowaj plik `CNAME` przy publikacji.

## Funkcje

- Duży zegar 24-godzinny i polska data według czasu urządzenia.
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

## Sprawdzenie lokalne

Można użyć dowolnego serwera statycznego. Otwieraj przez HTTP(S), nie `file://`: YouTube wymaga nagłówka Referer. Strona i iframe'y używają `strict-origin-when-cross-origin`.

```sh
node --check app.js
node --check playlist-links.js
node --test tests/playlist-links.test.cjs
```

Przed publikacją: sprawdź oba przykłady, zmianę playlisty, błędny link, zachowanie po odświeżeniu, usunięcie, zatrzymanie/wznowienie, tryby wyglądu i szerokości ekranu.

## Dokumentacja usług

- [Spotify Embeds](https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed)
- [Spotify — rozwiązywanie problemów](https://developer.spotify.com/documentation/embeds/tutorials/troubleshooting)
- [Spotify — prywatność playlist](https://support.spotify.com/us/article/playlist-privacy-and-access/)
- [YouTube — osadzanie filmów i playlist](https://support.google.com/youtube/answer/171780?hl=en)
- [YouTube — prywatność playlist](https://support.google.com/youtube/answer/3127309?hl=en)
