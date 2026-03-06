@echo off
setlocal

echo [DEPLOY] Checking requirements...

:: Check for gcloud
where gcloud >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] gcloud CLI is not installed or not in PATH.
    echo Please install it from https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)

:: Check for docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [DEPLOY] All requirements met.
echo.

:: Configuration
set PROJECT_ID=gen-lang-client-0806453267

if "%PROJECT_ID%"=="" (
    echo [ERROR] No active Google Cloud project found.
    echo Please run "gcloud init" or "gcloud config set project [YOUR_PROJECT_ID]"
    pause
    exit /b 1
)

set IMAGE_NAME=gcr.io/%PROJECT_ID%/nations-lp
set SERVICE_NAME=nations-lp
set REGION=asia-northeast1

echo [DEPLOY] Target Project: %PROJECT_ID%
echo [DEPLOY] Image Name:    %IMAGE_NAME%
echo [DEPLOY] Service Name:  %SERVICE_NAME%
echo [DEPLOY] Region:        %REGION%
echo.
echo Press any key to start build and deploy...
pause >nul

:: Build and Submit
echo [DEPLOY] Building and submitting image...
call gcloud builds submit --tag %IMAGE_NAME% .
if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

:: Deploy
echo [DEPLOY] Deploying to Cloud Run...
call gcloud run deploy %SERVICE_NAME% ^
  --image %IMAGE_NAME% ^
  --platform managed ^
  --region %REGION% ^
  --port 80 ^
  --allow-unauthenticated

if %errorlevel% neq 0 (
    echo [ERROR] Deployment failed.
    pause
    exit /b 1
)

echo.
echo [DEPLOY] SUCCESS! The service has been deployed.
pause
