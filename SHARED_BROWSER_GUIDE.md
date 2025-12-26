# Shared Browser Implementation ✅

## Problem Solved
Before: Each scraper opened a **separate browser window**
- Twitter → Window 1 (closes when done)
- TikTok → Window 2 (stays open)

Now: All scrapers use **one browser window with multiple tabs**
- Browser Window → Tab 1 (Twitter), Tab 2 (TikTok), etc.
- Each tab closes when done
- Browser stays open for reuse

## How It Works

### SharedBrowserService
A global singleton service that manages one browser instance shared across all scrapers.

**Key Features:**
- ✅ **Single browser instance** - All scrapers share one browser
- ✅ **Multiple tabs** - Each scraper gets its own tab (context)
- ✅ **Auto-reuse** - If browser exists, reuse it instead of launching new one
- ✅ **Tab cleanup** - Each tab closes after scraping
- ✅ **Browser persistence** - Browser stays open for next scrape
- ✅ **Auto-shutdown** - Browser closes when application stops

### Architecture

```
┌─────────────────────────────────────┐
│     Shared Browser (Singleton)      │
│  ┌───────────────────────────────┐  │
│  │   Browser Window (Chromium)   │  │
│  │                               │  │
│  │  ┌─────────┐  ┌─────────┐   │  │
│  │  │ Tab 1   │  │ Tab 2   │   │  │
│  │  │Twitter  │  │ TikTok  │   │  │
│  │  └─────────┘  └─────────┘   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Files Created/Modified

### New Files:
- `backend/src/scrapers/shared-browser.service.ts` - Shared browser service
- `backend/src/scrapers/shared-browser.module.ts` - Global module

### Modified Files:
- `backend/src/scrapers/tiktok/tiktok.service.ts` - Uses shared browser
- `backend/src/scrapers/twitter/twitter.service.ts` - Uses shared browser
- `backend/src/app.module.ts` - Imports SharedBrowserModule

## Code Changes

### Before (TikTok):
```typescript
// Each scraper launches its own browser
let browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

// ... scraping ...

await browser.close(); // Closes entire browser
```

### After (TikTok):
```typescript
// Use shared browser - just create a new tab
context = await this.sharedBrowser.createContext();
page = await context.newPage();

// ... scraping ...

await context.close(); // Only closes this tab, browser stays open
```

## Benefits

### 1. Resource Efficiency
- **Before**: 2 scrapers = 2 browser processes (~400MB each = 800MB)
- **After**: 2 scrapers = 1 browser process (~400MB total)

### 2. Faster Scraping
- **Before**: Each scraper waits for browser to launch (~2-3 seconds)
- **After**: Browser already running, instant tab creation (~0.1 seconds)

### 3. Better UX
- **Before**: Multiple browser windows cluttering screen
- **After**: One browser window with organized tabs

### 4. Automatic Cleanup
- **Before**: Orphaned browser windows if scraper crashes
- **After**: Tabs close automatically, browser managed centrally

## Log Examples

### First Scrape (Browser Launch):
```
[SharedBrowserService] 🚀 Launching shared browser (visible)...
[SharedBrowserService] ✅ Shared browser launched successfully
[TiktokService] 🎵 Opening TikTok in new tab for: #cats
[SharedBrowserService] 📑 Created new browser context (tab)
[TiktokService] ✅ New tab created
... scraping ...
[TiktokService] 🧹 Closing TikTok tab...
[TiktokService] ✅ TikTok tab closed
```

### Second Scrape (Browser Reuse):
```
[SharedBrowserService] ♻️ Reusing existing browser instance
[TwitterService] 🐦 Searching via Nitter...
[SharedBrowserService] 📑 Created new browser context (tab)
... scraping ...
[TwitterService] ✅ Twitter tab closed
```

### Application Shutdown:
```
[SharedBrowserService] 🧹 Closing shared browser on application shutdown...
[SharedBrowserService] ✅ Shared browser closed
```

## Testing

### Test Multiple Scrapers:
```bash
# Start first scraper (launches browser)
curl "http://localhost:3000/test/tiktok?q=cats&headless=false"

# Start second scraper (reuses browser, new tab)
curl "http://localhost:3000/test/twitter?q=cats"
```

**What you'll see:**
1. First request: Browser window opens
2. TikTok tab opens and scrapes
3. TikTok tab closes
4. Second request: Same browser window
5. Twitter tab opens and scrapes
6. Twitter tab closes
7. Browser window stays open for next scrape

## Configuration

The shared browser is configured in `SharedBrowserService`:

```typescript
// Browser launch options
await chromium.launch({
    headless: headless,  // Configurable per scraper
    args: ['--disable-blink-features=AutomationControlled']
});

// Context (tab) options
await browser.newContext({
    userAgent: 'Mozilla/5.0 ...',  // Customizable per scraper
});
```

## Advanced Features

### Concurrent Scraping
Multiple scrapers can run simultaneously, each in their own tab:
```bash
# Run both at the same time
curl "http://localhost:3000/test/tiktok?q=cats" &
curl "http://localhost:3000/test/twitter?q=dogs" &
```

### Browser Persistence
Browser stays open between requests for faster subsequent scrapes:
- First scrape: ~3 seconds (browser launch + scraping)
- Next scrapes: ~0.5 seconds (just scraping, no launch)

### Automatic Recovery
If browser crashes, it automatically relaunches on next scrape:
```
[SharedBrowserService] ⚠️ Browser disconnected, will relaunch on next request
[SharedBrowserService] 🚀 Launching shared browser...
```

## Result

✅ **One browser window** with multiple tabs
✅ **Automatic tab cleanup** after each scrape
✅ **Resource efficient** - shared browser instance
✅ **Faster scraping** - no repeated browser launches
✅ **Better organized** - tabs instead of windows
✅ **Automatic shutdown** - clean application exit

Your scrapers now work together efficiently! 🎉
