
# tunedIn.space — Minimal Music Threads Webapp

## Overview

**tunedIn.space** is a minimal, modern web application for sharing and discussing music links. It supports user registration/login, posting music threads with tags, likes, comments, and playlist/queue features. The app is styled for a "monospace vibes" aesthetic and can operate in two modes:
- **Local mode:** All data is stored in the browser's LocalStorage.
- **Supabase mode:** Data is synced with a Supabase backend (cloud database).

---

## Recent Updates

- **Help Menu Revamp:**  
	The help overlay is now a full-featured new user guide, including step-by-step instructions, posting tips, queue/player info, keyboard shortcuts, and accessibility tips.
- **UI Improvement:**  
	The help button is now located next to the logout/login button in the topbar for easier access and a cleaner feed area.
- **Accessibility:**  
	Improved keyboard navigation, focus management, and live region for announcements.
- **Autofill Composer:**  
	When pasting a YouTube or SoundCloud link, the composer auto-fills title/artist using oEmbed and smart parsing.
- **Settings & Customization:**  
	Users can pick an accent color and toggle between cozy/compact layouts.
- **Data Management:**  
	Export/import all data as JSON, with clear warnings and feedback.
- **Supabase Integration:**  
	Seamless switching between local and Supabase modes, with all CRUD mirrored to the backend if enabled.

- **Modularization:**  
	The main application logic (`app.js`) has been split into multiple focused modules for better maintainability and clarity. See the updated File Structure and Component Analysis below.
- **Provider Detection:**  
	Robust detection and embedding for YouTube, Spotify, Bandcamp, SoundCloud, and direct audio files.
- **Queue & Player:**  
	Play, shuffle, repeat, and auto-scroll queue, with keyboard shortcuts for all major actions.
- **Security:**  
	Local mode is for demo/testing only; Supabase mode uses RLS for security.

---

## Main Features

- **User Authentication:** Register and log in with email/password (Supabase or local).
- **Music Posts:** Share music links (YouTube, Spotify, Bandcamp, SoundCloud, direct audio).
- **Tags & Search:** Tag posts and filter/search by tags, title, artist, or body.
- **Likes & Comments:** Like posts and add comments.
- **Queue & Player:** Add posts to a queue, play embedded music, and auto-advance.
- **Import/Export:** Export all data as JSON or import/replace data.
- **Settings:** Accent color, density (cozy/compact), and storage info.
- **Keyboard Shortcuts:** For navigation, liking, playing, and more.
- **Accessibility:** Skip links, ARIA roles, live region, and full keyboard support.

---

## File Structure

- `index.html` — Main HTML entry point, loads styles and JS. Contains the help overlay and main app shell.
- `styles.css` — Modern, dark, responsive CSS with monospace font and custom accent.
- `js/app.js` — Main entry point; initializes app, manages global state, and delegates to modules.
- `js/main_view.js` — Renders the main UI (feed, profile, compose, tags, etc.).
- `js/actions.js` — Handles all global and delegated UI actions/events.
- `js/feed.js` — Feed rendering, post filtering, and comment rendering.
- `js/posts.js` — Post creation, editing, and inline editing logic.
- `js/queue.js` — Queue management and now playing logic.
- `js/login_view.js` — Login/register UI rendering.
- `js/overlays.js` — Help overlay and modal overlays.
- `js/keyboard.js` — Keyboard shortcuts and navigation.
- `js/seed.js` — Demo data seeding.
- `js/config.js` — Configuration for Supabase (URL, anon key, toggle).
- `js/db.js` — Data layer: handles local and Supabase storage, CRUD for users/posts.
- `js/providers.js` — Detects music provider from URL and builds embed players.
- `js/utils.js` — Utility functions (DOM helpers, debounce, formatting, etc.).
- `js/oembed.js` — Fetches oEmbed metadata for supported providers.
- `js/yt_title_parse.js` — Smart parsing of YouTube titles for artist/title extraction.

---

## Detailed Component Analysis

### 1. `index.html`
- Loads the app shell, header, and main content area.
- Includes a help overlay with a comprehensive new user guide and keyboard shortcuts.
- Loads `styles.css` and `js/app.js` as a module.

### 2. `styles.css`
- Uses CSS variables for palette, spacing, and radius.
- Responsive grid layout, styled forms, buttons, tags, posts, and overlays.
- Accessibility: visually hidden elements for screen readers, focus outlines.
- Custom accent color and density (cozy/compact) toggles.

### 3. `js/app.js` (App Entrypoint)
- **Entrypoint:** Initializes the app, manages global state, and delegates rendering and events to other modules.
- **State Management:** Handles user, queue, preferences, and page state.
- **Session:** User session is stored locally.
- **Delegation:** Calls `main_view.js` for main UI, `login_view.js` for login/register, and binds global event handlers from `actions.js`, `keyboard.js`, etc.

### 4. `js/main_view.js` (Main UI)
- **Main UI Rendering:** Renders the main feed, profile, compose form, tags, and settings.
- **Integrates:** Uses `feed.js`, `queue.js`, `posts.js`, and others for subcomponents.

### 5. `js/actions.js` (Event Handling)
- **Global & Delegated Events:** Handles all click, submit, and keyboard events for the app.
- **Integrates:** Calls functions from `feed.js`, `posts.js`, `profile.js`, `queue.js`, etc.

### 6. `js/feed.js` (Feed & Comments)
- **Feed Rendering:** Renders the post feed, filters posts, and renders comments.

### 7. `js/posts.js` (Post Logic)
- **Post Creation & Editing:** Handles creating, editing, and inline editing of posts.

### 8. `js/queue.js` (Queue Management)
- **Queue Logic:** Manages the play queue, now playing, shuffle, and repeat.

### 9. `js/login_view.js`, `js/overlays.js`, `js/keyboard.js`, `js/seed.js`
- **Other UI & Utility Modules:** Login/register UI, overlays/help, keyboard shortcuts, and demo data seeding.

*Other component numbers incremented accordingly.*

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

### 8. `js/oembed.js` and `js/yt_title_parse.js`
- Fetch oEmbed metadata for YouTube/SoundCloud.
- Parse YouTube titles for best-guess artist/title autofill.

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
7. **Use the help menu** for a full new user guide and keyboard shortcuts.

---

## Extending the App

- Add more music providers in `providers.js`.
- Enhance moderation, notifications, or analytics.
- Improve security for production use.
- Add mobile PWA support.

---
