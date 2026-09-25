import PocketBase from 'pocketbase';

/** Same-origin client: in production PocketBase serves the app, in dev Vite proxies /api. */
export const pb = new PocketBase(window.location.origin);
