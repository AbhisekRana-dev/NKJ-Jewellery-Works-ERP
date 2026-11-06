$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$envFile = Join-Path $PSScriptRoot '.env'
$exampleFile = Join-Path $PSScriptRoot '.env.example'

if (-not (Test-Path $envFile)) {
    if (Test-Path $exampleFile) {
        Copy-Item $exampleFile $envFile
        Write-Host 'Created backend/.env from .env.example.' -ForegroundColor Yellow
        Write-Host 'Edit backend/.env and replace DB_PASSWORD and ADMIN_PASSWORD, then run this script again.' -ForegroundColor Yellow
        exit 1
    }
    throw 'backend/.env is missing. Create it using backend/.env.example.'
}

# Load key/value pairs into this PowerShell process. Spring Boot also imports
# the same file via spring.config.import in application.properties.
$values = @{}
foreach ($line in Get-Content $envFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $separator = $trimmed.IndexOf('=')
    if ($separator -lt 1) { continue }

    $key = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$key] = $value
    [Environment]::SetEnvironmentVariable($key, $value, 'Process')
}

$required = @('DB_USERNAME', 'DB_PASSWORD', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'TOTP_SECRET')
$missing = @($required | Where-Object {
    -not $values.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($values[$_]) -or $values[$_] -match 'CHANGE_ME|REPLACE_ME|GENERATE_'
})
if ($missing.Count -gt 0) {
    Write-Host ('Please complete these values in backend/.env: ' + ($missing -join ', ')) -ForegroundColor Red
    exit 1
}

if ($values['TOTP_SECRET'] -notmatch '^[A-Z2-7]{16,64}$') {
    throw 'TOTP_SECRET must be an unpadded Base32 value with 16 to 64 characters (A-Z and 2-7).'
}

try {
    $javaOutput = (& java -version 2>&1 | Out-String)
} catch {
    throw 'Java was not found. Install JDK 21 or JDK 25 and add its bin folder to PATH.'
}
$versionMatch = [regex]::Match($javaOutput, 'version "(\d+)')
if (-not $versionMatch.Success) {
    throw 'Could not identify the Java version. Run java -version manually.'
}
$javaMajor = [int]$versionMatch.Groups[1].Value
if ($javaMajor -lt 21 -or $javaMajor -gt 25) {
    throw "This project compiles for Java 21 and supports JDK 21-25. Detected Java $javaMajor. Install/select JDK 21 or 25."
}

try {
    $mavenOutput = (& mvn -version 2>&1 | Out-String)
} catch {
    throw 'Maven was not found. Install Apache Maven 3.6.3 or later and add mvn to PATH.'
}
Write-Host ($mavenOutput.Trim()) -ForegroundColor DarkGray
Write-Host 'Starting NKJ Jewellery Works backend...' -ForegroundColor Cyan

& mvn '-Dspring-boot.run.jvmArguments=-Xms128m -Xmx512m -XX:+UseSerialGC' spring-boot:run
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Host 'Backend stopped with an error. Review the first Caused by: message above.' -ForegroundColor Red
}
exit $exitCode
