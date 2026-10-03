$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$env:JAVA_HOME=(Get-ChildItem -Directory "$taskRoot/apk-build-tools/java" | Select-Object -First 1).FullName
$env:PATH="$env:JAVA_HOME/bin;$env:PATH"
$bt="$taskRoot/apk-build-tools/sdk/build-tools/35.0.0"
$platform="$taskRoot/apk-build-tools/sdk/platforms/android-35/android.jar"
$project="$PSScriptRoot/android"
$out="$PSScriptRoot/output"
New-Item -ItemType Directory -Force "$out/classes","$out/dex" | Out-Null
$source="$project/src/in/animekingdom/admin/MainActivity.java"
$utf8=New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($source,[IO.File]::ReadAllText($source),$utf8)
& "$env:JAVA_HOME/bin/javac.exe" -encoding UTF-8 -source 8 -target 8 -classpath $platform -d "$out/classes" $source
if($LASTEXITCODE -ne 0){throw 'Java compilation failed'}
& "$env:JAVA_HOME/bin/jar.exe" cf "$out/classes.jar" -C "$out/classes" .
& "$bt/d8.bat" --lib $platform --min-api 26 --output "$out/dex" "$out/classes.jar"
if($LASTEXITCODE -ne 0){throw 'DEX compilation failed'}
& "$bt/aapt2.exe" compile --dir "$project/res" -o "$out/resources.zip"
& "$bt/aapt2.exe" link -I $platform --manifest "$project/AndroidManifest.xml" -A "$project/assets" -o "$out/unsigned.apk" "$out/resources.zip"
if($LASTEXITCODE -ne 0){throw 'APK packaging failed'}
& "$env:JAVA_HOME/bin/jar.exe" uf "$out/unsigned.apk" -C "$out/dex" classes.dex
& "$bt/zipalign.exe" -f 4 "$out/unsigned.apk" "$out/aligned.apk"
if(!(Test-Path "$PSScriptRoot/local-signing.p12")){
 $keyPass=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
 [IO.File]::WriteAllText("$PSScriptRoot/signing-password.txt",$keyPass)
 & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -keystore "$PSScriptRoot/local-signing.p12" -storetype PKCS12 -storepass:file "$PSScriptRoot/signing-password.txt" -alias animekingdom -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Anime Kingdom Admin'
}
& "$bt/apksigner.bat" sign --ks "$PSScriptRoot/local-signing.p12" --ks-pass "file:$PSScriptRoot/signing-password.txt" --out "$out/Anime-Kingdom-Admin.apk" "$out/aligned.apk"
if($LASTEXITCODE -ne 0){throw 'Signing failed'}
& "$bt/apksigner.bat" verify --verbose "$out/Anime-Kingdom-Admin.apk"
& "$bt/aapt2.exe" dump badging "$out/Anime-Kingdom-Admin.apk"
Get-FileHash "$out/Anime-Kingdom-Admin.apk" -Algorithm SHA256


