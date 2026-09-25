/// <reference path="../pb_data/types.d.ts" />

// Static PWA delivery (pb_public). PocketBase serves files as-is, so compress them and let
// browsers keep the content-hashed bundles forever. sw.js, index.html and the manifest are
// revalidated so a new deploy reaches clients (vite-plugin-pwa autoUpdate). The API is left
// alone: gzip buffers the realtime SSE stream.
routerUse((e) => {
  const path = e.request.url.path;
  if (path.startsWith('/api/') || path.startsWith('/_/')) return e.next();
  e.response
    .header()
    .set(
      'Cache-Control',
      path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
  return $apis.gzip().func(e);
});
