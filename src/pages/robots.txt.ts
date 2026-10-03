import type { APIRoute } from 'astro';
import { getSettings } from '../lib/content';

// Controlled by Site Settings → "Allow search engines to index this site" (off by default).
export const GET: APIRoute = async () => {
  const { allow_indexing } = await getSettings();
  const body = allow_indexing ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
