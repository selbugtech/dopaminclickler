@echo off
rem Oyunu yerel sunucuyla açar (YouTube videoları dosyadan açınca çalışmıyor)
cd /d "%~dp0"
start "" http://localhost:8080
python -m http.server 8080
