# Flashcard Extension - Chrome/Firefox Extension

## Features

🔐 **Gmail OAuth Login** - Secure authentication  
📚 **Flashcard Management** - Create and organize cards  
🧠 **Spaced Repetition** - Smart review scheduling  
📊 **Progress Tracking** - Statistics and analytics  
☁️ **Cloud Sync** - Data synchronized via server  

## Getting Started

### Prerequisites

- Node.js v18+
- Chrome/Brave/Edge browser
- Backend server running on `http://localhost:3000`

### Installation

```bash
npm install
```

### Configuration

**Update manifest.json:**

Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Google OAuth Client ID:

```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ]
}
```

### Development

```bash
# Watch mode with auto-rebuild
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

### Loading in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist` folder from this directory
5. Extension appears in your toolbar

## 📁 Project Structure

```
extension/
├── src/
│   ├── components/
│   │   ├── AuthScreen.tsx      # Login UI
│   │   └── DashboardScreen.tsx # Main dashboard
│   ├── styles/
│   │   └── popup.css
│   ├── background.ts           # Service worker
│   ├── popup.tsx              # React app
│   └── popup.html
├── manifest.json
├── webpack.config.js
├── package.json
└── tsconfig.json
```

## 🔐 Authentication Flow

```
User clicks "Sign in with Gmail"
        ↓
background.ts: chrome.identity.getAuthToken()
        ↓
Fetch user info from Google APIs
        ↓
POST /auth/google to backend
        ↓
Backend returns JWT token
        ↓
Store token in chrome.storage.local
        ↓
Show Dashboard
```

## 💾 Storage

Extension uses `chrome.storage.local`:

```javascript
{
  "authToken": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "user@gmail.com",
    "name": "User Name",
    "picture": "https://..."
  }
}
```

## 🎨 UI Components

### AuthScreen
- Google login button
- Feature highlights
- Beautiful gradient background

### DashboardScreen
- User profile header
- 4-card statistics grid (Due today, Learned, To learn, Total)
- Tab navigation (Review/New Card)
- Flashcard list with stats
- Create card form

## 🔌 API Integration

All API calls include JWT token:

```javascript
const token = await new Promise(resolve => {
  chrome.storage.local.get('authToken', data => {
    resolve(data.authToken);
  });
});

fetch('http://localhost:3000/flashcards', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## 📡 API Endpoints Used

**Authentication:**
- `POST /auth/google` - Login with Google ID
- `GET /auth/me` - Get current user

**Flashcards:**
- `GET /flashcards` - Get all cards
- `POST /flashcards` - Create new card
- `GET /flashcards/due` - Get cards due for review
- `GET /flashcards/stats` - Get statistics

**Reviews:**
- `POST /reviews` - Submit review

## 🛠️ Build Process

The extension uses Webpack to bundle TypeScript/React:

```bash
npm run build
```

Outputs to `dist/`:
- `manifest.json`
- `popup.html`
- `popup.js` (React app)
- `background.js` (Service worker)
- `styles/popup.css`

## 🐛 Troubleshooting

### "Failed to authenticate"
- Check Google Client ID in manifest.json
- Verify server is running on localhost:3000
- Clear extension storage and try again

### Cards not loading
- Open DevTools (right-click → Inspect)
- Check Network tab for API calls
- Verify JWT token is valid

### Popup won't open
- Check manifest.json syntax
- Try `chrome://extensions/` reload button
- Clear all data and reload

## 🔧 Development Tips

### Debug Extension

1. Right-click extension → "Inspect popup"
2. Opens DevTools for popup
3. Console logs appear here

### View Service Worker Logs

1. Go to `chrome://extensions/`
2. Find extension, click "Service workers" link
3. DevTools opens for background.ts

### Clear Storage

```javascript
// In console:
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
  location.reload();
});
```

### Test API Calls

```bash
# From extension console:
fetch('http://localhost:3000/flashcards', {
  headers: {
    'Authorization': `Bearer YOUR_TOKEN_HERE`,
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(console.log);
```

## 📦 Dependencies

- `react` - UI framework
- `react-dom` - React DOM rendering
- `typescript` - Type safety
- `webpack` - Module bundler
- `ts-loader` - TypeScript loader
- `style-loader` - CSS in JS

## 🚀 Deployment

### Chrome Web Store

1. Create developer account
2. Build extension: `npm run build`
3. Zip the `dist` folder
4. Upload to Developer Dashboard
5. Wait for review (~1-24 hours)

### Firefox (Add-ons)

1. Similar process via Mozilla AMO
2. Requires manifest v3 adjustments
3. Uses same codebase

## 📝 Manifest v3 Notes

Uses Chrome **Manifest v3** (latest):
- Service Worker instead of background page
- Promise-based message passing
- New permission model

## 🔒 Security Best Practices

✅ Never store passwords  
✅ Store JWT tokens securely (chrome.storage.local)  
✅ Use HTTPS in production  
✅ Validate all API responses  
✅ Sanitize DOM updates  

## 📋 Checklist Before Production

- [ ] Update Google Client ID
- [ ] Update extension name/description
- [ ] Create proper icons (16x16, 48x48, 128x128)
- [ ] Test on multiple browsers
- [ ] Update privacy policy
- [ ] Security audit

---

**Built with ❤️ using React & TypeScript**
