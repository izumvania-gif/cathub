/// <reference path="../pb_data/types.d.ts" />

// Automatic backups (docs/DEPLOY_AMVERA.md §6), configured from env on every start so the
// setup lives in the repo, not in the admin UI:
//   BACKUP_CRON       cron in UTC, default "0 0 * * *" (03:00 Moscow); "off" disables
//   BACKUP_MAX_KEEP   how many automatic backups to keep, default 7
//   BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_REGION, BACKUP_S3_ACCESS_KEY,
//   BACKUP_S3_SECRET  optional S3-compatible storage (Timeweb S3, Yandex Object Storage…);
//                     without it backups stay in pb_data/backups on the /data volume.
onBootstrap((e) => {
  e.next();

  const env = (k) => String($os.getenv(k) || '').trim();
  const cron = env('BACKUP_CRON') || '0 0 * * *';
  const keep = parseInt(env('BACKUP_MAX_KEEP') || '7', 10);

  const settings = e.app.settings();
  settings.meta.appName = 'CatHub'; // also names the backup files
  settings.backups.cron = cron === 'off' ? '' : cron;
  settings.backups.cronMaxKeep = keep > 0 ? keep : 7;

  const endpoint = env('BACKUP_S3_ENDPOINT');
  const bucket = env('BACKUP_S3_BUCKET');
  if (endpoint && bucket) {
    settings.backups.s3.enabled = true;
    settings.backups.s3.endpoint = endpoint;
    settings.backups.s3.bucket = bucket;
    settings.backups.s3.region = env('BACKUP_S3_REGION') || 'ru-1';
    settings.backups.s3.accessKey = env('BACKUP_S3_ACCESS_KEY');
    settings.backups.s3.secret = env('BACKUP_S3_SECRET');
    settings.backups.s3.forcePathStyle = true;
  } else {
    settings.backups.s3.enabled = false;
  }

  try {
    e.app.save(settings);
    console.log(
      `backups: cron="${settings.backups.cron || 'off'}", keep=${settings.backups.cronMaxKeep}, ` +
        `storage=${settings.backups.s3.enabled ? 's3://' + bucket : 'local /data/pb_data/backups'}`,
    );
  } catch (err) {
    console.error('backups: could not apply settings', err);
  }
});
