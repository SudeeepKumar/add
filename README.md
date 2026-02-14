# Billji - SaaS Accounting & Inventory Management

A complete, production-ready SaaS application for e-commerce businesses to manage accounting and inventory operations. Built with React, Firebase, and modern web technologies.

**A Product Of Sudeepta Kumar Panda**

## ✨ Features

### Accounting Management
- ✅ Add and track expenses with predefined categories
- ✅ Add and track income/sales revenue
- ✅ Automatic profit & loss calculations
- ✅ Transaction history with filtering and search
- ✅ Real-time dashboard with financial metrics

### Inventory Management
- ✅ Product management with SKU generation
- ✅ Stock level tracking
- ✅ Low stock alerts
- ✅ Profit margin calculations
- ✅ Search and filter products

### Reports & Analytics
- ✅ Profit & Loss statements
- ✅ Expense breakdown charts (Pie charts)
- ✅ Income trends visualization (Bar charts)
- ✅ Inventory valuation reports
- ✅ Export to PDF and CSV

### Advanced Features
- ✅ GST/Tax calculations (18% default, customizable)
- ✅ Invoice generation with line items
- ✅ Payment tracking (Paid/Unpaid/Overdue)
- ✅ Multi-tenant architecture (user-specific data)
- ✅ Real-time data synchronization

### Authentication
- ✅ Email/Password authentication
- ✅ Google Sign-In
- ✅ Secure Firebase authentication

## 🚀 Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Authentication
- **Database**: Cloud Firestore
- **Charts**: Recharts
- **PDF Generation**: jsPDF
- **CSV Export**: PapaParse
- **Icons**: Lucide React
- **Routing**: React Router v6
- **Notifications**: React Hot Toast

## 📋 Prerequisites

- Node.js 18+ and npm
- Firebase account
- Netlify account (for deployment)

## 🛠️ Installation & Setup

### 1. Clone or Navigate to Project

```bash
cd billji
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing one)
3. Enable **Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Email/Password"
   - Enable "Google"
4. Create **Firestore Database**:
   - Go to Firestore Database
   - Create database in production mode
   - Deploy the security rules from `firestore.rules`
   - Import indexes from `firestore.indexes.json`

### 4. Configure Environment Variables

1. In Firebase Console, go to Project Settings → General
2. Scroll down to "Your apps" and click the web icon (</>) to register a web app
3. Copy your Firebase configuration
4. Create a `.env` file in the project root:

```bash
cp .env.example .env
```

5. Edit `.env` and add your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 5. Deploy Firestore Rules

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (select Firestore)
firebase init firestore

# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

### 6. Run Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173`

## 📦 Build for Production

```bash
npm run build
```

The build output will be in the `dist` folder.

## 🌐 Deployment to Netlify

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

Quick steps:
1. Build the project: `npm run build`
2. Deploy to Netlify via drag-and-drop or CLI
3. Configure environment variables in Netlify
4. Your app is live!

## 📖 User Guide

See [USER_GUIDE.md](./USER_GUIDE.md) for detailed usage instructions.

## 🗂️ Project Structure

```
billji/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable components
│   │   ├── auth/       # Authentication components
│   │   ├── common/     # Common UI components
│   │   └── layout/     # Layout components
│   ├── config/         # Configuration files
│   ├── contexts/       # React contexts
│   ├── pages/          # Page components
│   ├── services/       # Firebase services
│   ├── utils/          # Utility functions
│   ├── App.jsx         # Main app component
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles
├── firestore.rules     # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── netlify.toml        # Netlify configuration
└── package.json        # Dependencies
```

## 🔒 Security

- Multi-tenant architecture ensures data isolation
- Firestore security rules prevent unauthorized access
- All reads/writes require authentication
- Users can only access their own data

## 🎨 UI/UX Features

- Responsive design (mobile, tablet, desktop)
- Modern glassmorphism effects
- Color-coded profit (green) and loss (red)
- Smooth animations and transitions
- Loading states and empty states
- Toast notifications for user feedback

## 📄 License

This project was created by **Sudeepta Kumar Panda**.

## 🤝 Support

For issues or questions, please create an issue in the repository or contact the developer.

## 🎯 Future Enhancements

- Multi-currency support
- Advanced reporting with more chart types
- Recurring invoices
- Payment gateway integration
- Mobile app (React Native)
- Email notifications
- Backup and export all data

---

**Made with ❤️ by Sudeepta Kumar Panda**
