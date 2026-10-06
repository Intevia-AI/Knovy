import { useEffect, useState } from 'react';

export const RELEASES_PAGE = 'https://github.com/Intevia-AI/Knovy/releases/latest';
export const REPO_URL = 'https://github.com/Intevia-AI/Knovy';

// Defaults to the releases page (always valid); upgrades to a direct .dmg link
// once we know the latest release. GitHub API is unauthenticated (60 req/hr per IP);
// ponytail: if that limit ever bites, swap to a cached/proxied endpoint.
export function useDownloadUrl() {
  const [downloadUrl, setDownloadUrl] = useState(RELEASES_PAGE);

  useEffect(() => {
    fetch('https://api.github.com/repos/Intevia-AI/Knovy/releases/latest')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const dmg = data?.assets?.find((a: { name: string; browser_download_url: string }) =>
          a.name.endsWith('.dmg'));
        if (dmg) setDownloadUrl(dmg.browser_download_url);
      })
      .catch(() => {/* keep releases-page fallback */});
  }, []);

  return downloadUrl;
}
