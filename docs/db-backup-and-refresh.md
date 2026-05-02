# Database Backup and Prod-to-Dev Refresh (Windows)

This guide is for frequent safe refreshes from denimpolo_prod to denimpolo_dev.

## 1) Prerequisites

- Install MongoDB Database Tools (mongodump, mongorestore).
- Keep production and development connection URIs in environment variables (do not hardcode secrets in scripts).

PowerShell example for current session:

```powershell
$env:PROD_URI = "mongodb+srv://<user>:<password>@<host>/denimpolo_prod?appName=Cluster0"
$env:DEV_URI  = "mongodb+srv://<user>:<password>@<host>/denimpolo_dev?appName=Cluster0"
```

## 2) Always Back Up First

Create a timestamped backup folder and archive for production:

```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = "D:\mongo-backups"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

# Folder dump (easy to inspect)
mongodump --uri="$env:PROD_URI" --out="$backupRoot\prod-$ts"

# Optional compressed archive (easy to store/ship)
mongodump --uri="$env:PROD_URI" --archive="$backupRoot\prod-$ts.archive.gz" --gzip
```

Optional: Back up dev before overwrite:

```powershell
mongodump --uri="$env:DEV_URI" --archive="$backupRoot\dev-pre-refresh-$ts.archive.gz" --gzip
```

## 3) Copy Prod to Dev (Overwrite Dev)

Use the folder dump created above:

```powershell
mongorestore --uri="$env:DEV_URI" --drop --nsFrom="denimpolo_prod.*" --nsTo="denimpolo_dev.*" "$backupRoot\prod-$ts\denimpolo_prod"
```

What this does:
- --drop removes matching dev collections before restore.
- --nsFrom/--nsTo remaps collection namespaces from prod database name to dev database name.

## 4) Fast One-Liner (No Saved Folder)

Use this when you want speed and do not need a retained dump folder:

```powershell
mongodump --uri="$env:PROD_URI" --archive --gzip | mongorestore --uri="$env:DEV_URI" --archive --gzip --drop --nsFrom="denimpolo_prod.*" --nsTo="denimpolo_dev.*"
```

## 5) Restore From Backup if Mistake Happens

From compressed archive:

```powershell
mongorestore --uri="$env:PROD_URI" --drop --archive="D:\mongo-backups\prod-YYYYMMDD-HHMMSS.archive.gz" --gzip
```

From folder dump:

```powershell
mongorestore --uri="$env:PROD_URI" --drop "D:\mongo-backups\prod-YYYYMMDD-HHMMSS\denimpolo_prod"
```

## 6) Recommended Frequent Workflow

1. Backup production.
2. Optional backup development.
3. Refresh development from production.
4. Verify app in development.

## 7) Optional Automation Scripts

Create two PowerShell scripts in scripts/ if you want one-command operations:
- scripts/backup-prod.ps1
- scripts/refresh-dev-from-prod.ps1

Suggested inputs to script parameters:
- -ProdUri
- -DevUri
- -BackupRoot (default: D:\mongo-backups)
