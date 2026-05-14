@echo off
SET "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
SET "PATH=%JAVA_HOME%\bin;%PATH%"
echo Using JAVA: %JAVA_HOME%
echo Building release APK...
call gradlew.bat assembleDebug
echo.
echo Build finished. Check android\app\build\outputs\apk\release\
