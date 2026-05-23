# CloudBase Image Backups

This directory stores the Git-tracked source copies of image assets that are loaded remotely by the mini program.

Runtime code must not import files from this directory. Upload these files to CloudBase Storage with:

```sh
TARO_CLOUD_ENV_ID=<env-id> npm run assets:upload
```

The app builds remote image URLs from `TARO_REMOTE_ASSET_BASE_URL` and the storage paths under `assets/`.
