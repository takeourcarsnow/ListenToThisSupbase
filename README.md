# ascii.fm — Minimal Music Threads Webapp

## Overview

**ascii.fm** is a minimal, modern web application for sharing and discussing music links. It supports user registration/login, posting music threads with tags, likes, comments, and playlist/queue features. The app is styled for a "monospace vibes" aesthetic and can operate in two modes:
- **Local mode:** All data is stored in the browser's LocalStorage.
- **Supabase mode:** Data is synced with a Supabase backend (cloud database).

## Main Features

- **User Authentication:** Register and log in with email/password (Supabase or local).
- **Music Posts:** Share music links (YouTube, Spotify, Bandcamp, SoundCloud, direct audio).
- **Tags & Search:** Tag posts and filter/search by tags, title, artist, or body.
- **Likes & Comments:** Like posts and add comments.
- **Queue & Player:** Add posts to a queue, play embedded music, and auto-advance.
- **Import/Export:** Export all data as JSON or import/replace data.
- **Settings:** Accent color, density (cozy/compact), and storage info.
- **Keyboard Shortcuts:** For navigation, liking, playing, and more.

## File Structure

- `index.html` — Main HTML entry point, loads styles and JS.
- `styles.css` — Modern, dark, responsive CSS with monospace font and custom accent.
- `js/app.js` — Main application logic, UI rendering, event handling.
- `js/config.js` — Configuration for Supabase (URL, anon key, toggle).
- `js/db.js` — Data layer: handles local and Supabase storage, CRUD for users/posts.
- `js/providers.js` — Detects music provider from URL and builds embed players.
- `js/utils.js` — Utility functions (DOM helpers, debounce, formatting, etc.).

---

## Detailed Component Analysis

### 1. `index.html`

- Loads the app shell, header, and main content area.
- Includes a help overlay for keyboard shortcuts.
- Loads `styles.css` and `js/app.js` as a module.

### 2. `styles.css`

- Uses CSS variables for palette, spacing, and radius.
- Responsive grid layout, styled forms, buttons, tags, posts, and overlays.
- Accessibility: visually hidden elements for screen readers, focus outlines.
- Custom accent color and density (cozy/compact) toggles.

### 3. `js/app.js` (Main Logic)

- **State Management:** Handles user, queue, preferences, and page state.
- **Preferences:** Saved in LocalStorage, includes sort, search, accent, density, etc.
- **Session:** User session is stored locally.
- **Rendering:** Renders login/register forms, main UI, feed, tags, compose form, and settings.
- **Feed:** Supports filtering, searching, sorting, and pagination.
- **Posts:** Create, edit, delete, like, comment, and share posts.
- **Queue:** Add posts to a play queue, supports shuffle and repeat.
- **Player:** Embeds music players for supported providers.
- **Import/Export:** JSON import/export for all data.
- **Keyboard Shortcuts:** For navigation, liking, playing, and help overlay.
- **Accessibility:** Live region for announcements, focus management.

### 4. `js/config.js`

- Toggle between Supabase and local mode.
- Stores Supabase project URL and anon key.

### 5. `js/db.js` (Data Layer)

- **LocalAdapter:** Stores users and posts in LocalStorage.
- **SupabaseAdapter:** Syncs users and posts with Supabase tables.
- **CRUD:** Create, update, delete posts/users, toggle likes, add comments.
- **Import/Export:** Replace all data or export as JSON.
- **Auto-detects** which adapter to use based on config.

### 6. `js/providers.js`

- **parseProvider:** Detects provider (YouTube, Spotify, Bandcamp, SoundCloud, direct audio) from a URL.
- **buildEmbed:** Builds the correct embed player for each provider.
- **Fallback:** If provider is unknown, shows a link.

### 7. `js/utils.js`

- DOM helpers (`$`, `$$`), debounce, safeClone, unique ID, HTML escaping.
- Formatting for time, bytes, and storage size.
- Clipboard copy, toast notifications, accent/density application.

---

## Data Model

- **User:** `{ id, name, email, password (local only), createdAt }`
- **Post:** `{ id, userId, title, artist, url, provider, tags, body, likes, comments, createdAt }`
- **Comment:** `{ id, userId, text, createdAt }`

---

## Supabase Integration

- If enabled, all users and posts are synced to Supabase tables.
- Uses Supabase Auth for user management.
- All CRUD operations are mirrored to the backend.

---

## Security & Privacy

- **Local mode:** All data is stored in the browser, not secure for production.
- **Supabase mode:** Uses public anon key, relies on Supabase RLS for security.
- **Passwords:** Only stored locally in demo mode, not secure.

---

## Accessibility

- Skip to content link, ARIA roles, live region for updates.
- Keyboard navigation and shortcuts.
- Focus management for forms and overlays.

---

## Customization

- **Accent Color:** User can pick from a palette.
- **Density:** Toggle between cozy and compact layouts.
- **Storage Info:** Shows local storage usage or Supabase sync status.

---

## How to Use

1. **Register or log in** (Supabase or local).
2. **Post music links** with title, artist, tags, and description.
3. **Browse, search, and filter** posts.
4. **Like, comment, and queue** posts for playback.
5. **Export or import** your data as JSON.
6. **Customize** accent color and layout density.

---

## Extending the App

- Add more music providers in `providers.js`.
- Enhance moderation, notifications, or analytics.
- Improve security for production use.
- Add mobile PWA support.

---
