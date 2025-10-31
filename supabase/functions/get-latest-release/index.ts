import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const GITHUB_REPO_OWNER = "Intevia-AI";
const GITHUB_REPO_NAME = "Knovy-Release";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
const FALLBACK_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;

// Cache the latest release URL for 10 minutes to reduce GitHub API calls
let cachedReleaseUrl: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  content_type: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

async function getLatestRelease(req: Request) {
  const origin = req.headers.get("origin") ?? undefined;
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Check if we have a valid cached URL
    const now = Date.now();
    if (cachedReleaseUrl && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      console.log("Serving cached release URL:", cachedReleaseUrl);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": cachedReleaseUrl,
          "Cache-Control": "public, max-age=300", // Cache for 5 minutes in CDN/browser
        },
      });
    }

    // Fetch latest release from GitHub API
    console.log("Fetching latest release from GitHub API...");
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "Knovy-Beta-Invitation",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
    }

    const release: GitHubRelease = await response.json();
    console.log(`Found release: ${release.tag_name} with ${release.assets.length} assets`);

    // Find the .dmg asset
    const dmgAsset = release.assets.find((asset: GitHubAsset) =>
      asset.name.endsWith(".dmg") && asset.name.includes("Knovy")
    );

    if (!dmgAsset) {
      console.error("No .dmg asset found in latest release");
      throw new Error("No macOS installer found in latest release");
    }

    console.log(`Found .dmg asset: ${dmgAsset.name}`);
    const downloadUrl = dmgAsset.browser_download_url;

    // Cache the URL
    cachedReleaseUrl = downloadUrl;
    cacheTimestamp = now;

    // Redirect to the download URL
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": downloadUrl,
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes in CDN/browser
      },
    });

  } catch (error) {
    console.error("Error fetching latest release:", error);

    // Fallback: redirect to the releases page where users can manually download
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": FALLBACK_URL,
      },
    });
  }
}

serve(getLatestRelease);
