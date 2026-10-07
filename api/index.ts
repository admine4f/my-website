import app from '../server';

export default function handler(req: any, res: any) {
  return new Promise((resolve, reject) => {
    res.on('finish', () => resolve(null));
    res.on('close', () => resolve(null));
    res.on('error', (err: any) => reject(err));

    try {
      // 1. Extract path parameter from Vercel rewrite or query parameters
      let vercelPath = '';
      try {
        const parsedUrl = new URL(req.url || '/', 'http://localhost');
        vercelPath = parsedUrl.searchParams.get('vercel_path') ||
                     parsedUrl.searchParams.get('path') ||
                     parsedUrl.searchParams.get('__route_path') || '';
      } catch {}

      // 2. Check Vercel proxy headers
      const forwardedUri = req.headers['x-forwarded-uri'] ||
                           req.headers['x-matched-path'] ||
                           req.headers['x-vercel-matched-path'];

      if (vercelPath) {
        req.url = vercelPath.startsWith('/') ? `/api${vercelPath}` : `/api/${vercelPath}`;
      } else if (typeof forwardedUri === 'string' && forwardedUri.startsWith('/api')) {
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

      app(req, res, (err: any) => {
        if (err) {
          console.error('[Vercel Express Handler Error]:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'Internal Server Error' });
          }
          resolve(null);
        }
      });
    } catch (err: any) {
      console.error('[Vercel Handler Exception]:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Server Exception' });
      }
      resolve(null);
    }
  });
}

export { app };
