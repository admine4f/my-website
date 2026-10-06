import app from '../server';

export default function handler(req: any, res: any) {
  // On Vercel, serverless rewrites may route requests as /api/index or strip /api prefix.
  // Restore the real client request URL from Vercel's authoritative forwarding headers.
  const forwardedUri = req.headers['x-forwarded-uri'] || req.headers['x-matched-path'];
  if (forwardedUri && typeof forwardedUri === 'string' && forwardedUri.startsWith('/api')) {
    req.url = forwardedUri;
  } else if (req.url) {
    if (req.url === '/api/index' || req.url === '/api' || req.url === '/') {
      const match = req.headers['x-now-route-matches'];
      if (match) {
        try {
          const params = new URLSearchParams(match);
          const p = params.get('1');
          if (p) req.url = `/api/${decodeURIComponent(p)}`;
        } catch {}
      }
    } else if (!req.url.startsWith('/api') && (
      req.url.startsWith('/admin') ||
      req.url.startsWith('/wallet') ||
      req.url.startsWith('/user') ||
      req.url.startsWith('/system') ||
      req.url.startsWith('/mining') ||
      req.url.startsWith('/market') ||
      req.url.startsWith('/trade') ||
      req.url.startsWith('/support') ||
      req.url.startsWith('/announcements') ||
      req.url.startsWith('/withdraw')
    )) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
  }

  return app(req, res);
}

export { app };
