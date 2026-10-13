# Записанный голос Лумо

Сюда кладутся озвученные реплики. Если файла нет — Лумо говорит голосом синтезатора
браузера, так что эта папка может пополняться постепенно.

```
audio/<lang>/<namespace>/<key>.mp3      например: audio/ru/triangle-in-box/look.mp3
audio/<lang>/<namespace>/<key>.<i>.mp3  вариант реплики: audio/ru/last-pebble/yourturn.2.mp3
audio/<lang>/manifest.json               список записанных реплик
```

```bash
node tools/lines.mjs export ru > lines-ru.json   # что записывать
node tools/lines.mjs manifest ru                 # после записи — обновить манифест
```
