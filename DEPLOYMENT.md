# Deployment Guide for Billji

This guide will walk you through deploying Billji to Netlify step-by-step.

## Prerequisites

- Billji project set up locally
- Firebase project configured
- Netlify account (free tier works fine)
- Git repository (optional but recommended)

## Step 1: Prepare Your Project

### 1.1 Configure Environment Variables Locally

Make sure your `.env` file is set up with your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 1.2 Test Build Locally

```bash
npm run build
```

This should create a `dist` folder without errors.

## Step 2: Deploy Firebase Rules and Indexes

Before deploying to Netlify, make sure your Firestore rules and indexes are deployed:

```bash
# Install Firebase CLI globally (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project directory
firebase init firestore
# Select your Firebase project
# Use firestore.rules when prompted for rules file
# Use firestore.indexes.json when prompted for indexes file

# Deploy rules and indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Step 3: Deploy to Netlify

### Option A: Deploy via Netlify CLI (Recommended)

**3A.1 Install Netlify CLI:**

```bash
npm install -g netlify-cli
```

**3A.2 Login to Netlify:**

```bash
netlify login
```

**3A.3 Initialize and Deploy:**

```bash
# Initialize Netlify site
netlify init

# Follow the prompts:
# - Create & configure a new site
# - Choose your team
# - Enter a site name (e.g., billji-accounting)
# - Build command: npm run build
# - Publish directory: dist

# Deploy
netlify deploy --prod
```

**3A.4 Set Environment Variables:**

```bash
netlify env:set VITE_FIREBASE_API_KEY "your_api_key"
netlify env:set VITE_FIREBASE_AUTH_DOMAIN "your_project.firebaseapp.com"
netlify env:set VITE_FIREBASE_PROJECT_ID "your_project_id"
netlify env:set VITE_FIREBASE_STORAGE_BUCKET "your_project.appspot.com"
netlify env:set VITE_FIREBASE_MESSAGING_SENDER_ID "123456789"
netlify env:set VITE_FIREBASE_APP_ID "1:123456789:web:abcdef"
```

### Option B: Deploy via Netlify Dashboard

**3B.1 Build Your Project:**

```bash
npm run build
```

**3B.2 Go to Netlify:**

- Visit [https://app.netlify.com/](https://app.netlify.com/)
- Log in or create an account

**3B.3 Deploy via Drag & Drop:**

- Click "Add new site" → "Deploy manually"
- Drag and drop your `dist` folder

**3B.4 Configure Environment Variables:**

- Go to Site settings → Environment variables
- Click "Add a variable" for each:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`

**3B.5 Redeploy:**

After setting env variables, click "Trigger deploy" to rebuild with the new variables.

### Option C: Deploy from GitHub (Continuous Deployment)

**3C.1 Push to GitHub:**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-github-repo-url
git push -u origin main
```

**3C.2 Connect to Netlify:**

- In Netlify Dashboard, click "Add new site" → "Import an existing project"
- Choose GitHub and authorize
- Select your repository
- Configure build settings:
  - **Build command**: `npm run build`
  - **Publish directory**: `dist`

**3C.3 Add Environment Variables:**

- Before deploying, click "Show advanced" → "New variable"
- Add all Firebase environment variables

**3C.4 Deploy:**

- Click "Deploy site"
- Netlify will automatically rebuild on every push to main branch

## Step 4: Configure Custom Domain (Optional)

### 4.1 Add Custom Domain:

- Go to Site settings → Domain management
- Click "Add custom domain"
- Enter your domain name
- Follow DNS configuration instructions

### 4.2 Enable HTTPS:

- Netlify automatically provisions SSL certificates
- Wait a few minutes for certificate to be issued
- Your site will be available via HTTPS

## Step 5: Post-Deployment Configuration

### 5.1 Update Firebase Authorized Domains:

1. Go to Firebase Console
2. Navigate to Authentication → Settings → Authorized domains
3. Add your Netlify domain (e.g., `yourapp.netlify.app`)
4. If using custom domain, add that too

### 5.2 Test Your Deployment:

Visit your Netlify URL and test:
- [ ] Sign up with email/password
- [ ] Sign in with Google
- [ ] Add a transaction
- [ ] Add a product
- [ ] Generate an invoice
- [ ] View reports
- [ ] Export PDF/CSV

## Troubleshooting

### Build Fails

**Issue**: Build command fails
**Solution**: 
- Check that all dependencies are in `package.json`
- Run `npm install` locally to ensure package-lock.json is up to date
- Check build logs for specific errors

### Environment Variables Not Working

**Issue**: App can't connect to Firebase
**Solution**:
- Verify all environment variables are set in Netlify
- Make sure variable names start with `VITE_`
- Trigger a new deploy after adding variables

### 404 Errors on Page Refresh

**Issue**: Getting 404 when refreshing on a route like `/dashboard`
**Solution**:
- This should be handled by `netlify.toml`
- Verify `netlify.toml` is in your project root
- Check that it contains the redirect rule

### Google Sign-In Not Working

**Issue**: Google authentication fails
**Solution**:
- Add your Netlify domain to Firebase authorized domains
- Check that Google sign-in is enabled in Firebase console
- Clear browser cache and try again

## Monitoring and Analytics

### 5.3 Enable Netlify Analytics (Optional):

- Go to Site settings → Analytics
- Enable Netlify Analytics for visitor insights

### 5.4 Monitor Firebase Usage:

- Check Firebase Console → Usage tab
- Monitor authentication usage
- Monitor Firestore read/write operations
- Set up budget alerts

## Updating Your App

### Via Git (if using continuous deployment):

```bash
# Make your changes
git add .
git commit -m "Update description"
git push
# Netlify automatically rebuilds
```

### Via CLI:

```bash
npm run build
netlify deploy --prod
```

### Via Dashboard:

- Drag and drop new `dist` folder in Deploys tab

## Cost Considerations

### Netlify (Free Tier):
- 100 GB bandwidth/month
- 300 build minutes/month
- Usually sufficient for small to medium usage

### Firebase:
- **Authentication**: 50,000 monthly active users (free)
- **Firestore**: 
  - 50,000 reads/day (free)
  - 20,000 writes/day (free)
  - 1 GB storage (free)
- Monitor usage in Firebase Console

## Security Checklist

- [x] Environment variables configured (not in source code)
- [x] Firestore security rules deployed
- [x] Authorized domains configured in Firebase
- [x] HTTPS enabled (automatic with Netlify)
- [x] `.gitignore` includes `.env` file

## Success! 🎉

Your Billji app should now be live and accessible to users!

**Next Steps:**
- Share the URL with your team
- Set up monitoring and alerts
- Plan marketing and user onboarding

---

**Made with ❤️ by Sudeepta Kumar Panda**
