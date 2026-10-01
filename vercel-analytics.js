/* Vercel Web Analytics - Tracks visitor behavior and page views */
import { inject } from '@vercel/analytics';

inject({
  mode: 'production',
  debug: false
});
