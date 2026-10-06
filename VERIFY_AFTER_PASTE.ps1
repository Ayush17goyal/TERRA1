$ErrorActionPreference = "Stop"

Write-Host "LEGATRIXON Memorial Fix verification" -ForegroundColor Cyan
Write-Host "1/3 TypeScript typecheck..." -ForegroundColor Yellow
npm run typecheck

Write-Host "2/3 Memorial frontend unit tests..." -ForegroundColor Yellow
npx vitest run src/tests/unit/memorialCommandCenter.test.ts src/tests/unit/memorialExport.test.ts

Write-Host "3/3 Production build..." -ForegroundColor Yellow
npm run build

Write-Host "Verification completed successfully." -ForegroundColor Green
