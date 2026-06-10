# CloudBase Image Backups

This directory stores the Git-tracked source copies of image assets that are loaded remotely by the mini program.

Runtime code must not import files from this directory. Upload these files to CloudBase Storage with:

```sh
TARO_CLOUD_ENV_ID=<env-id> npm run assets:upload
```

Pet assets are uploaded to the versioned path configured in `config/remote-assets.json`, for example
`assets/v1/pets/`. Increment the version before replacing a published image; do not overwrite an existing
version because clients and CDN nodes may retain its permanent URL.
