// Fetch oEmbed metadata for supported providers
// Returns { title, author, thumbnail, ... } or null
export async function fetchOEmbed(url) {
  // YouTube
  if (/youtube\.com|youtu\.be/.test(url)) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (!res.ok) return null;
      return await res.json();
    } catch {}
  }
  // SoundCloud
  if (/soundcloud\.com/.test(url)) {
    try {
      const res = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (!res.ok) return null;
      return await res.json();
    } catch {}
  }
  // Bandcamp (no official oEmbed, try OpenGraph)
  if (/bandcamp\.com/.test(url)) {
    // Bandcamp does not support oEmbed, fallback to OpenGraph scraping (not possible client-side due to CORS)
    return null;
  }
  // Spotify (no oEmbed, fallback to OpenGraph)
  if (/spotify\.com/.test(url)) {
    return null;
  }
  // Fallback: try generic oEmbed providers if needed
  return null;
}
