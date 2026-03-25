import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  signInAnonymously, type User, db, storage
} from './firebase';
import { 
  collection, doc, getDoc, setDoc, onSnapshot, query, where, orderBy, 
  addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, limit,
  getDocFromServer
} from 'firebase/firestore';
import { 
  ref, uploadBytes, getDownloadURL 
} from 'firebase/storage';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';
import { Toaster, toast } from 'react-hot-toast';
import { 
  AlertCircle, Heart, Share2, Upload
} from 'lucide-react';
import { cn } from './lib/utils';
import * as XLSX from 'xlsx';
import * as d3 from 'd3';
import html2canvas from 'html2canvas';
import { format, differenceInYears } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface Member {
  id: string;
  name: string;
  fatherName?: string;
  motherName?: string;
  gender?: 'Male' | 'Female' | 'Other';
  maritalStatus?: 'Single' | 'Married' | 'Widowed' | 'Divorced';
  dob?: string;
  marriageDate?: string;
  anniversary?: string;
  phone: string;
  profession?: string;
  occupation?: string;
  achievement?: string;
  badge?: 'Gold' | 'Silver' | 'None';
  status: 'pending' | 'approved';
  role: 'admin' | 'member';
  photoUrl?: string;
  email?: string;
  uid: string;
  bloodGroup?: string;
  siNo?: string;
  remarks?: string;
  createdAt?: any;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  photoUrl?: string;
  authorUid: string;
  status: 'pending' | 'approved';
}

interface Fund {
  id: string;
  title: string;
  target: number;
  current: number;
  instructions: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  photoUrl?: string;
  sellerPhone: string;
  sellerUid: string;
}

interface SOSAlert {
  id: string;
  uid: string;
  latitude: number;
  longitude: number;
  message: string;
  timestamp: any;
  userName?: string;
}

interface BloodDonor {
  id: string;
  name: string;
  bloodGroup: string;
  location: string;
  lastDonation?: string;
  phone: string;
  status: 'ACTIVE' | 'BUSY';
  photoUrl?: string;
}

interface Medicine {
  id: string;
  name: string;
  type: string;
  quantity: string;
  donorName: string;
  donorUid: string;
  phone: string;
  status: 'Available' | 'Taken';
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends (Component as any) {
  state = { hasError: false, error: null };
  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "কিছু একটা ভুল হয়েছে।";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {}

      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-center bg-bepari-green">
          <div className="glass-card max-w-md">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">ত্রুটি!</h2>
            <p className="text-white/70 mb-6">{errorMessage}</p>
            <button onClick={() => window.location.reload()} className="btn-gradient w-full">আবার চেষ্টা করুন</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Main App Component ---
export default function App() {
  useEffect(() => {
    // Set persistence to local
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();
  }, []);

  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [user, setUser] = useState<any | null>(null);
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [isMock, setIsMock] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection successful");
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
          toast.error("Firestore is offline. Check your connection or configuration.");
        }
        // Skip logging for other errors, as this is simply a connection test.
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Fetch real member data from Firestore
        const docRef = doc(db, 'members', u.uid);
        getDoc(docRef).then((docSnap) => {
          if (docSnap.exists()) {
            setMemberData(docSnap.data() as Member);
          } else {
            setMemberData(null);
          }
          setLoading(false);
        }).catch((err) => {
          handleFirestoreError(err, OperationType.GET, `members/${u.uid}`);
          setLoading(false);
        });
      } else {
        setMemberData(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('লগইন সফল হয়েছে!');
    } catch (error: any) {
      console.error('Login Error:', error);
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('অননুমোদিত ডোমেইন! অনুগ্রহ করে ফায়ারবেস কনসোলে এই ডোমেইনটি যোগ করুন।');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('পপআপ ব্লক করা হয়েছে! অনুগ্রহ করে পপআপ অনুমোদিত করুন।');
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no need for a scary error
      } else if (error.message?.includes('INTERNAL ASSERTION FAILED')) {
        toast.error('একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে পেজটি রিফ্রেশ করুন।');
      } else {
        toast.error(`লগইন ব্যর্থ হয়েছে: ${error.message || 'অজানা ত্রুটি'}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBypassLogin = async (code: string) => {
    if (code === '9944') {
      try {
        const cred = await signInAnonymously(auth);
        setIsMock(true);
        setUser({
          uid: cred.user.uid,
          email: 'saifullahsojib998@gmail.com',
          displayName: 'Admin Bypass'
        });
        toast.success('অ্যাডমিন বাইপাস সফল!');
      } catch (error) {
        toast.error('বাইপাস লগইন ব্যর্থ হয়েছে।');
      }
    } else {
      toast.error('ভুল কোড!');
    }
  };

  const handleLogout = async () => {
    if (isMock) {
      setIsMock(false);
      setUser(null);
      setMemberData(null);
      return;
    }
    try {
      await signOut(auth);
      toast.success('লগআউট সফল হয়েছে!');
    } catch (error) {
      toast.error('লগআউট ব্যর্থ হয়েছে।');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bepari-green">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} onBypass={handleBypassLogin} />;
  }

  if (memberData && memberData.status === 'pending') {
    return <PendingPage onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen pb-32 bg-background text-on-surface font-body overflow-x-hidden relative">
      <Toaster position="top-center" />
      
      {/* Atmospheric Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-secondary/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]"></div>
      </div>

      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl flex justify-between items-center px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
            <span className="material-symbols-outlined text-primary">family_history</span>
          </div>
          <h1 className="text-xl font-black text-primary tracking-tighter font-headline">ডিজিটাল ব্যাপারী বাড়ি</h1>
        </div>
        <div className="flex items-center gap-2">
          {user && (memberData?.role === 'admin' || user.email === 'saifullahsojib998@gmail.com') && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={cn("w-10 h-10 flex items-center justify-center rounded-full transition-all", activeTab === 'admin' ? "bg-primary text-on-primary" : "text-primary hover:bg-primary/10")}
              title="অ্যাডমিন হাব"
            >
              <span className="material-symbols-outlined">shield_person</span>
            </button>
          )}
          <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-all" title="লগআউট">
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </header>

      <main className="pt-24 px-6 space-y-10 max-w-5xl mx-auto relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'home' && <Home memberData={memberData} user={user} setActiveTab={setActiveTab} />}
            {activeTab === 'health' && <Health memberData={memberData} />}
            {activeTab === 'tree' && <FamilyTree />}
            {activeTab === 'directory' && <Directory memberData={memberData} user={user} onLogout={handleLogout} />}
            {activeTab === 'market' && <Marketplace memberData={memberData} />}
            {activeTab === 'events' && <Events memberData={memberData} />}
            {activeTab === 'admin' && <AdminPanel />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 w-full rounded-t-[24px] z-50 bg-surface-container/90 backdrop-blur-2xl flex justify-around items-center h-20 px-4 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <NavButton icon="home" label="হোম" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <NavButton icon="medical_services" label="স্বাস্থ্য" active={activeTab === 'health'} onClick={() => setActiveTab('health')} />
        <NavButton icon="import_contacts" label="ডিরেক্টরি" active={activeTab === 'directory'} onClick={() => setActiveTab('directory')} />
        <NavButton icon="account_tree" label="বংশতালিকা" active={activeTab === 'tree'} onClick={() => setActiveTab('tree')} />
        <NavButton icon="shopping_bag" label="মার্কেট" active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
        <NavButton icon="calendar_month" label="ইভেন্ট" active={activeTab === 'events'} onClick={() => setActiveTab('events')} />
      </nav>

      <SOSButton memberData={memberData} />
    </div>
  );
}

// --- Sub-components ---

function NavButton({ icon, label, active, onClick }: { icon: string, label: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center transition-all px-5 py-2 rounded-full cursor-pointer",
        active ? "bg-primary-container text-primary" : "text-on-surface-variant opacity-60 hover:bg-surface-variant"
      )}
    >
      <span className="material-symbols-outlined">{icon}</span>
      <span className="text-[11px] font-medium uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

function LandingPage({ onLogin, onBypass }: { onLogin: () => void, onBypass: (code: string) => void }) {
  const [showBypass, setShowBypass] = useState(false);
  const [code, setCode] = useState('');

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-[#001808]">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-secondary/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[440px]"
      >
        <div className="glass-panel backdrop-blur-3xl rounded-[48px] p-10 border border-white/10 shadow-2xl space-y-12">
          <div className="text-center space-y-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-24 h-24 mx-auto bg-primary/20 rounded-[32px] flex items-center justify-center border border-primary/30 shadow-[0_0_40px_rgba(74,225,118,0.2)]"
            >
              <span className="material-symbols-outlined text-5xl text-primary">family_history</span>
            </motion.div>
            
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tighter text-primary font-headline">ডিজিটাল ব্যাপারী বাড়ি</h1>
              <p className="text-on-surface-variant/70 font-medium leading-relaxed max-w-[280px] mx-auto">
                আমাদের শিকড়কে সংযুক্ত করা, আমাদের উত্তরাধিকার উদযাপন করা।
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <button 
              onClick={onLogin} 
              className="w-full py-5 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all duration-300"
            >
              <span className="material-symbols-outlined">login</span>
              গুগল দিয়ে লগইন করুন
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest">
                <span className="bg-transparent px-4 text-on-surface-variant/40 font-bold">অথবা</span>
              </div>
            </div>

            {!showBypass ? (
              <button 
                onClick={() => setShowBypass(true)}
                className="w-full py-5 rounded-2xl bg-white/5 text-on-surface font-bold uppercase tracking-widest flex items-center justify-center gap-3 border border-white/10 hover:bg-white/10 transition-all duration-300"
              >
                <span className="material-symbols-outlined">key</span>
                অ্যাডমিন কোড
              </button>
            ) : (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <input 
                  type="password" 
                  value={code} 
                  onChange={e => setCode(e.target.value)}
                  placeholder="অ্যাডমিন কোড দিন (৯৯৪৪)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => onBypass(code)}
                    className="flex-1 py-4 rounded-2xl bg-secondary text-on-secondary font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all"
                  >
                    প্রবেশ
                  </button>
                  <button 
                    onClick={() => setShowBypass(false)}
                    className="px-6 rounded-2xl bg-white/5 text-on-surface-variant font-bold uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
                  >
                    বাতিল
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <p className="text-center text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/30 font-bold">
            © ২০২৪ ডিজিটাল ব্যাপারী বাড়ি নেটওয়ার্ক
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function RegistrationPage({ user, onLogout, isEmbedded = false, onComplete }: { user: User, onLogout: () => void, isEmbedded?: boolean, onComplete?: () => void }) {
  const [formData, setFormData] = useState({
    name: user.displayName || '',
    phone: '',
    fatherName: '',
    motherName: '',
    gender: 'Male',
    maritalStatus: 'Single',
    dob: '',
    anniversary: '',
    bloodGroup: '',
    occupation: '',
    remarks: '',
    secretCode: ''
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phone) return toast.error('ফোন নম্বর প্রয়োজন');
    if (formData.phone.length < 8 || formData.phone.length > 20) {
      return toast.error('ফোন নম্বর ৮ থেকে ২০ অক্ষরের মধ্যে হতে হবে');
    }
    
    setUploading(true);
    const isAdminCode = formData.secretCode === '9944';
    
    try {
      let photoUrl = '';
      if (photoFile) {
        const storageRef = ref(storage, `members/${user.uid}/${photoFile.name}`);
        const snapshot = await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      const member: Member = {
        id: user.uid,
        uid: user.uid,
        name: formData.name,
        phone: formData.phone,
        fatherName: formData.fatherName,
        motherName: formData.motherName,
        gender: formData.gender as any,
        maritalStatus: formData.maritalStatus as any,
        dob: formData.dob,
        anniversary: formData.anniversary,
        bloodGroup: formData.bloodGroup,
        occupation: formData.occupation,
        remarks: formData.remarks,
        status: isAdminCode ? 'approved' : 'pending',
        role: isAdminCode ? 'admin' : 'member',
        photoUrl: photoUrl || user.photoURL || '',
        email: user.email || '',
        createdAt: serverTimestamp() as any
      };

      await setDoc(doc(db, 'members', user.uid), member);
      
      toast.success(isAdminCode ? 'অ্যাডমিন নিবন্ধন সফল হয়েছে!' : 'নিবন্ধন সফল হয়েছে! অ্যাডমিন অনুমোদনের জন্য অপেক্ষা করুন।');
      
      if (onComplete) {
        onComplete();
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `members/${user.uid}`);
      toast.error('নিবন্ধন ব্যর্থ হয়েছে।');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden bg-[#001808] py-20", isEmbedded && "min-h-0 bg-transparent p-0 py-0")}>
      {!isEmbedded && (
        <>
          {/* Atmospheric Background */}
          <div className="absolute inset-0 z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-secondary/5 blur-[120px]"></div>
          </div>

          <div className="w-full max-w-lg mb-8 z-10">
            <button onClick={onLogout} className="flex items-center gap-2 text-on-surface-variant/60 hover:text-primary transition-all font-bold uppercase tracking-widest text-xs">
              <span className="material-symbols-outlined text-sm">arrow_back</span> লগআউট করুন
            </button>
          </div>
        </>
      )}

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn("glass-panel backdrop-blur-3xl rounded-[40px] p-10 border border-white/10 shadow-2xl w-full max-w-lg z-10", isEmbedded && "p-6 rounded-3xl")}
      >
        <div className="mb-10">
          <h2 className="text-3xl font-black text-primary font-headline tracking-tight">সদস্য নিবন্ধন</h2>
          <p className="text-on-surface-variant/50 text-sm mt-2">আপনার তথ্য দিয়ে আমাদের নেটওয়ার্কে যুক্ত হোন</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">পুরো নাম</label>
            <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" required />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">পিতার নাম</label>
              <input value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">মাতার নাম</label>
              <input value={formData.motherName} onChange={e => setFormData({...formData, motherName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">লিঙ্গ</label>
              <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none">
                <option value="Male">পুরুষ</option>
                <option value="Female">মহিলা</option>
                <option value="Other">অন্যান্য</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">বৈবাহিক অবস্থা</label>
              <select value={formData.maritalStatus} onChange={e => setFormData({...formData, maritalStatus: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none">
                <option value="Single">অবিবাহিত</option>
                <option value="Married">বিবাহিত</option>
                <option value="Widowed">বিপত্নীক/বিধবা</option>
                <option value="Divorced">তালাকপ্রাপ্ত</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">ফোন নম্বর</label>
              <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">রক্তের গ্রুপ</label>
              <select 
                value={formData.bloodGroup} 
                onChange={e => setFormData({...formData, bloodGroup: e.target.value})} 
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none"
                required
              >
                <option value="">নির্বাচন করুন</option>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">জন্ম তারিখ</label>
              <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">বিবাহ বার্ষিকী (ঐচ্ছিক)</label>
              <input type="date" value={formData.anniversary} onChange={e => setFormData({...formData, anniversary: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">পেশা</label>
              <input value={formData.occupation} onChange={e => setFormData({...formData, occupation: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">আপনার ছবি</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">মন্তব্য (ঐচ্ছিক)</label>
            <textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all h-24 resize-none" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">গোপন কোড (ঐচ্ছিক)</label>
            <input type="password" value={formData.secretCode} onChange={e => setFormData({...formData, secretCode: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" placeholder="অ্যাডমিন কোড থাকলে দিন" />
          </div>

          <button type="submit" disabled={uploading} className="w-full py-5 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest mt-4 shadow-xl hover:shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all duration-300 disabled:opacity-50">
            {uploading ? 'প্রসেসিং...' : 'আবেদন জমা দিন'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function PendingPage({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden bg-[#001808] text-center">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-secondary/5 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md mb-8 z-10 flex justify-start">
        <button onClick={onLogout} className="flex items-center gap-2 text-on-surface-variant/60 hover:text-primary transition-all font-bold uppercase tracking-widest text-xs">
          <span className="material-symbols-outlined text-sm">arrow_back</span> লগআউট
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel backdrop-blur-3xl rounded-[48px] p-12 border border-white/10 shadow-2xl w-full max-w-md z-10"
      >
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-10 relative">
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping opacity-20"></div>
          <span className="material-symbols-outlined text-5xl text-primary">hourglass_empty</span>
        </div>
        
        <h2 className="text-3xl font-black mb-4 text-primary font-headline tracking-tight">অ্যাকাউন্ট পেন্ডিং</h2>
        <p className="text-on-surface-variant/60 mb-12 font-medium leading-relaxed">
          আপনার আবেদনটি বর্তমানে অ্যাডমিন প্যানেল দ্বারা পর্যালোচনা করা হচ্ছে। অনুমোদিত হলে আপনি অ্যাক্সেস পাবেন।
        </p>
        
        <button 
          onClick={onLogout} 
          className="w-full py-5 rounded-2xl bg-white/5 text-on-surface font-bold uppercase tracking-widest border border-white/10 hover:bg-white/10 active:scale-95 transition-all duration-300"
        >
          লগআউট করুন
        </button>
      </motion.div>
    </div>
  );
}

// --- Feature Components ---

function Health({ memberData }: { memberData: Member | null }) {
  const [activeSubTab, setActiveSubTab] = useState<'donors' | 'medicine'>('donors');
  const [showDonorReg, setShowDonorReg] = useState(false);
  const [donors, setDonors] = useState<BloodDonor[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [showMedicineAdd, setShowMedicineAdd] = useState(false);

  useEffect(() => {
    const qDonors = query(collection(db, 'blood_donors'), orderBy('createdAt', 'desc'));
    const unsubscribeDonors = onSnapshot(qDonors, (snapshot) => {
      setDonors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BloodDonor)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'blood_donors');
    });

    const qMeds = query(collection(db, 'medicines'), orderBy('timestamp', 'desc'));
    const unsubscribeMeds = onSnapshot(qMeds, (snapshot) => {
      setMedicines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medicine)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'medicines');
    });

    return () => {
      unsubscribeDonors();
      unsubscribeMeds();
    };
  }, []);

  const handleDonorReg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberData) return toast.error('নিবন্ধন করতে সদস্য হিসেবে নিবন্ধন করুন');
    try {
      const donorData = {
        name: memberData.name,
        bloodGroup: memberData.bloodGroup || 'Unknown',
        location: 'Bepari Bari',
        phone: memberData.phone,
        status: 'ACTIVE',
        uid: memberData.uid,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'blood_donors'), donorData);
      setShowDonorReg(false);
      toast.success('রক্তদাতা হিসেবে নিবন্ধিত হয়েছেন!');
    } catch (error) {
      toast.error('নিবন্ধন ব্যর্থ হয়েছে।');
    }
  };

  const handleMedicineAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberData) return toast.error('ওষুধ শেয়ার করতে সদস্য হিসেবে নিবন্ধন করুন');
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    try {
      await addDoc(collection(db, 'medicines'), {
        name: formData.get('name'),
        type: formData.get('type'),
        quantity: formData.get('quantity'),
        donorName: memberData.name,
        donorUid: memberData.uid,
        phone: memberData.phone,
        status: 'Available',
        timestamp: serverTimestamp()
      });
      setShowMedicineAdd(false);
      toast.success('ওষুধ যুক্ত হয়েছে!');
    } catch (error) {
      toast.error('ব্যর্থ হয়েছে।');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-2 p-1 bg-surface-container rounded-2xl">
        <button 
          onClick={() => setActiveSubTab('donors')}
          className={cn(
            "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
            activeSubTab === 'donors' ? "bg-primary text-on-primary shadow-lg" : "text-on-surface-variant opacity-60"
          )}
        >
          রক্তদাতা
        </button>
        <button 
          onClick={() => setActiveSubTab('medicine')}
          className={cn(
            "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
            activeSubTab === 'medicine' ? "bg-primary text-on-primary shadow-lg" : "text-on-surface-variant opacity-60"
          )}
        >
          ওষুধ শেয়ার
        </button>
      </div>

      {activeSubTab === 'donors' && (
        <div className="space-y-6">
          <button 
            onClick={() => setShowDonorReg(!showDonorReg)}
            className="w-full py-4 rounded-2xl bg-surface-container text-primary font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-primary/20 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">{showDonorReg ? 'close' : 'volunteer_activism'}</span>
            {showDonorReg ? 'নিবন্ধন বাতিল করুন' : 'রক্তদাতা হিসেবে নিবন্ধন করুন'}
          </button>

          {showDonorReg && (
            <motion.form 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleDonorReg}
              className="glass-card p-6 space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">অবস্থান / এলাকা</label>
                <input name="location" placeholder="যেমন: ঢাকা, মিরপুর" className="input-field" required />
              </div>
              {(!memberData || !memberData.bloodGroup) && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">রক্তের গ্রুপ</label>
                  <select name="bloodGroup" className="input-field" required>
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}
              <button type="submit" className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold uppercase tracking-widest shadow-lg">
                নিবন্ধন নিশ্চিত করুন
              </button>
            </motion.form>
          )}
        </div>
      )}

      {activeSubTab === 'donors' ? <BloodDonorDirectory donors={donors} /> : <MedicineSharing medicines={medicines} memberData={memberData} onAdd={() => setShowMedicineAdd(true)} />}

      {showMedicineAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-8 w-full max-w-md space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-primary uppercase tracking-widest">ওষুধ শেয়ার করুন</h3>
              <button onClick={() => setShowMedicineAdd(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleMedicineAdd} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">ওষুধের নাম</label>
                <input name="name" className="input-field" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">ধরণ (ট্যাবলেট/সিরাপ)</label>
                <input name="type" className="input-field" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">পরিমাণ</label>
                <input name="quantity" className="input-field" required />
              </div>
              <button type="submit" className="w-full py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest shadow-xl">
                শেয়ার নিশ্চিত করুন
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function BloodDonorDirectory({ donors }: { donors: BloodDonor[] }) {
  const [filter, setFilter] = useState('All');
  const filteredDonors = filter === 'All' ? donors : donors.filter(d => d.bloodGroup === filter);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {['সব', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(group => (
          <button
            key={group}
            onClick={() => setFilter(group === 'সব' ? 'All' : group)}
            className={cn(
              "px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all",
              (filter === 'All' && group === 'সব') || filter === group ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
            )}
          >
            {group}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filteredDonors.map(donor => (
          <div key={donor.id} className="glass-card p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-error/10 flex items-center justify-center text-error font-black text-xl">
              {donor.bloodGroup}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-on-surface">{donor.name}</h4>
              <p className="text-xs opacity-60 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">location_on</span>
                {donor.location}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-tighter",
                donor.status === 'ACTIVE' ? "bg-primary/20 text-primary" : "bg-error/20 text-error"
              )}>
                {donor.status === 'ACTIVE' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
              </span>
              <a href={`tel:${donor.phone}`} className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                <span className="material-symbols-outlined text-xl">call</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MedicineSharing({ medicines, memberData, onAdd }: { medicines: Medicine[], memberData: Member, onAdd: () => void }) {
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'medicines', id));
      toast.success('মেডিসিন সফলভাবে ডিলিট করা হয়েছে!');
    } catch (error) {
      console.error("Error deleting medicine:", error);
      toast.error('ব্যর্থ হয়েছে।');
    }
  };

  return (
    <div className="space-y-6">
      <button 
        onClick={onAdd}
        className="w-full py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined">add_circle</span>
        ওষুধ শেয়ার করুন
      </button>

      <div className="grid gap-4">
        {medicines.map(med => (
          <div key={med.id} className="glass-card p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-black text-primary font-headline">{med.name}</h4>
                <p className="text-xs opacity-60 uppercase tracking-widest font-bold">{med.type} • {med.quantity}</p>
              </div>
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                med.status === 'Available' ? "bg-primary/20 text-primary" : "bg-surface-variant text-on-surface-variant opacity-50"
              )}>
                {med.status === 'Available' ? 'উপলব্ধ' : 'নেওয়া হয়েছে'}
              </span>
            </div>
            <div className="pt-3 border-t border-outline-variant/10 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">দাতা</p>
                <p className="text-sm font-bold">{med.donorName}</p>
              </div>
              <div className="flex gap-2">
                {(memberData.role === 'admin' || memberData.uid === med.donorUid) && (
                  <button onClick={() => handleDelete(med.id)} className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                )}
                <a href={`tel:${med.phone}`} className="flex items-center gap-2 text-primary font-bold text-sm">
                  <span className="material-symbols-outlined text-lg">call</span>
                  কল করুন
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Home({ memberData, user, setActiveTab }: { memberData: Member | null, user: User, setActiveTab: (tab: string) => void }) {
  const [birthdays, setBirthdays] = useState<Member[]>([]);
  const [anniversaries, setAnniversaries] = useState<Member[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'members'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      const today = format(new Date(), 'MM-dd');
      setBirthdays(allMembers.filter(m => m.dob && format(new Date(m.dob), 'MM-dd') === today));
      setAnniversaries(allMembers.filter(m => m.marriageDate && format(new Date(m.marriageDate), 'MM-dd') === today));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });
    return () => unsubscribe();
  }, []);

  const handleInvite = () => {
    const url = window.location.origin;
    if (navigator.share) {
      navigator.share({
        title: 'ডিজিটাল ব্যাপারী বাড়ি',
        text: 'আমাদের পারিবারিক নেটওয়ার্কে যোগ দিন!',
        url: url
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('লিঙ্ক ক্লিপবোর্ডে কপি করা হয়েছে!');
    }
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] bg-primary text-on-primary p-8 shadow-2xl">
        <div className="relative z-10">
          <span className="text-sm font-bold uppercase tracking-[0.2em] opacity-80">স্বাগতম</span>
          <h2 className="text-4xl font-black mt-2 leading-tight font-headline">
            {memberData ? memberData.name.split(' ')[0] : user.displayName?.split(' ')[0] || 'অতিথি'} <br/>
            <span className="opacity-60">ব্যাপারী বাড়ি</span>
          </h2>
          <div className="mt-8 flex gap-4">
            <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
              {memberData?.bloodGroup || 'N/A'} গ্রুপ
            </div>
            <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
              {memberData ? (memberData.role === 'admin' ? 'অ্যাডমিন' : 'সদস্য') : 'অতিথি'}
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </section>

      {(birthdays.length > 0 || anniversaries.length > 0) && (
        <section className="space-y-4">
          <h3 className="text-xl font-black font-headline px-2">আজকের উদযাপন</h3>
          <div className="space-y-4">
            {birthdays.map(m => <div key={`bday-${m.id}`}><GreetingCard member={m} type="birthday" /></div>)}
            {anniversaries.map(m => <div key={`anniv-${m.id}`}><GreetingCard member={m} type="anniversary" /></div>)}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined text-3xl">group</span>
          </div>
          <span className="text-2xl font-black text-primary">১৫০+</span>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">সদস্য</span>
        </div>
        <div className="glass-card p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center text-secondary mb-4">
            <span className="material-symbols-outlined text-3xl">volunteer_activism</span>
          </div>
          <span className="text-2xl font-black text-secondary">২৪/৭</span>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">সাপোর্ট</span>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-xl font-black font-headline">দ্রুত কাজ</h3>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">সব দেখুন</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: 'add_box', label: 'রক্ত', color: 'bg-error/10 text-error', action: () => setActiveTab('health') },
            { icon: 'pill', label: 'ওষুধ', color: 'bg-primary/10 text-primary', action: () => setActiveTab('health') },
            { icon: 'emergency', label: 'জরুরি', color: 'bg-error text-white', action: () => {
              const btn = document.querySelector('.btn-sos-trigger') as HTMLButtonElement;
              btn?.click();
            }},
            { icon: 'share', label: 'আমন্ত্রণ', color: 'bg-surface-variant text-on-surface-variant', action: handleInvite }
          ].map((action, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div 
                onClick={action.action}
                className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer", action.color)}
              >
                <span className="material-symbols-outlined text-2xl">{action.icon}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60">{action.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function GreetingCard({ member, type }: { member: Member, type: 'birthday' | 'anniversary' }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const downloadCard = async () => {
    if (cardRef.current) {
      const canvas = await html2canvas(cardRef.current);
      const link = document.createElement('a');
      link.download = `${member.name}-${type}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const years = type === 'anniversary' && member.marriageDate 
    ? differenceInYears(new Date(), new Date(member.marriageDate)) 
    : 0;

  return (
    <div className="glass-card p-5 space-y-5">
      <div ref={cardRef} className="p-8 rounded-[32px] bg-primary text-on-primary text-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none flex items-center justify-center">
          <span className="material-symbols-outlined text-[200px]">{type === 'birthday' ? 'cake' : 'favorite'}</span>
        </div>
        <div className="relative z-10">
          <div className="w-24 h-24 rounded-full mx-auto mb-6 border-4 border-white/30 overflow-hidden shadow-xl">
            <img src={member.photoUrl || 'https://picsum.photos/seed/user/100/100'} className="w-full h-full object-cover" />
          </div>
          <h4 className="text-2xl font-black font-headline">{member.name}</h4>
          <p className="text-sm font-bold uppercase tracking-widest opacity-80 mt-2">
            {type === 'birthday' ? 'শুভ জন্মদিন!' : `শুভ বিবাহ বার্ষিকী! (${years} বছর)`}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={downloadCard} className="flex-1 py-3 rounded-xl bg-surface-container text-primary font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-lg">download</span> ডাউনলোড
        </button>
        <button className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg">
          <span className="material-symbols-outlined text-lg">share</span> শেয়ার
        </button>
      </div>
    </div>
  );
}

function FamilyTree() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'members'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!svgRef.current || members.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Build tree structure
    const roots = members.filter(m => !m.fatherName || !members.some(p => p.name === m.fatherName));
    
    if (roots.length === 0 && members.length > 0) {
      roots.push(members[0]);
    }

    const buildTree = (parentName: string): any => {
      const children = members.filter(m => m.fatherName === parentName);
      const member = members.find(m => m.name === parentName);
      return {
        name: parentName,
        photoUrl: member?.photoUrl,
        children: children.length > 0 ? children.map(c => buildTree(c.name)) : undefined
      };
    };

    let data;
    if (roots.length > 1) {
      data = {
        name: "ব্যাপারী বাড়ি বংশতালিকা",
        children: roots.map(r => buildTree(r.name))
      };
    } else if (roots.length === 1) {
      data = buildTree(roots[0].name);
    } else {
      return;
    }

    const width = 1200;
    const height = 800;
    const margin = { top: 80, right: 50, bottom: 80, left: 50 };

    const treeLayout = d3.tree().size([width - margin.left - margin.right, height - margin.top - margin.bottom]);
    const root = d3.hierarchy(data);
    treeLayout(root);

    const g = svg
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Links
    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkVertical()
        .x((d: any) => d.x)
        .y((d: any) => d.y) as any)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(0,109,59,0.2)')
      .attr('stroke-width', 2);

    // Nodes
    const node = g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    node.append('circle')
      .attr('r', 30)
      .attr('fill', '#fff')
      .attr('stroke', '#006d3b')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))');

    node.append('clipPath')
      .attr('id', (d: any, i: number) => `clip-${i}`)
      .append('circle')
      .attr('r', 28);

    node.append('image')
      .attr('xlink:href', (d: any) => d.data.photoUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + d.data.name)
      .attr('x', -28)
      .attr('y', -28)
      .attr('width', 56)
      .attr('height', 56)
      .attr('clip-path', (d: any, i: number) => `url(#clip-${i})`);

    node.append('text')
      .attr('dy', 45)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-[12px] font-bold fill-on-surface')
      .text((d: any) => d.data.name);

  }, [members]);

  return (
    <div className="space-y-6">
      <div className="px-2">
        <h3 className="text-xl font-black font-headline">বংশতালিকা</h3>
        <p className="text-xs text-outline opacity-60">আমাদের পরিবারের শিকড় ও শাখা</p>
      </div>
      
      <div className="glass-card p-0 overflow-x-auto">
        <div className="min-w-[1200px]">
          <svg ref={svgRef}></svg>
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-3 bg-primary/5 rounded-2xl border border-primary/10">
        <span className="material-symbols-outlined text-primary">info</span>
        <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
          বংশতালিকাটি স্বয়ংক্রিয়ভাবে তৈরি হয়। যদি কোনো তথ্য ভুল থাকে, তবে অ্যাডমিনের সাথে যোগাযোগ করুন।
        </p>
      </div>
    </div>
  );
}

function Directory({ memberData, user, onLogout }: { memberData: Member | null, user: User, onLogout: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [editData, setEditData] = useState<Partial<Member>>({});
  const [uploading, setUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'members'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });
    return () => unsubscribe();
  }, []);

  if (showRegistration || (!memberData && showRegistration)) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => setShowRegistration(false)} 
          className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-xs mb-4"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span> ফিরে যান
        </button>
        <RegistrationPage user={user} onLogout={onLogout} isEmbedded={true} onComplete={() => setShowRegistration(false)} />
      </div>
    );
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setUploading(true);
    try {
      let photoUrl = editData.photoUrl || '';
      if (photoFile) {
        const storageRef = ref(storage, `members/${selectedMember.id}_${Date.now()}`);
        await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(storageRef);
      }

      await updateDoc(doc(db, 'members', selectedMember.id), {
        ...editData,
        photoUrl
      });

      setIsEditing(false);
      setSelectedMember(null);
      toast.success('সদস্যের তথ্য আপডেট করা হয়েছে!');
    } catch (error) {
      console.error("Error updating member:", error);
      toast.error('ব্যর্থ হয়েছে।');
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (m: Member) => {
    setEditData(m);
    setIsEditing(true);
  };

  const filtered = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.occupation?.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40">search</span>
          <input 
            placeholder="নাম, পেশা বা ফোন দিয়ে খুঁজুন..." 
            className="input-field pl-12"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {memberData?.role === 'admin' && (
            <button 
              onClick={() => {
                setEditData({ status: 'approved', role: 'member' });
                setIsEditing(true);
                setSelectedMember(null);
              }}
              className="flex-1 md:flex-none px-6 py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined">person_add</span>
              নতুন সদস্য
            </button>
          )}
          {!memberData && (
            <button 
              onClick={() => setShowRegistration(true)}
              className="flex-1 md:flex-none px-6 py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined">how_to_reg</span>
              নিবন্ধন করুন
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.map(m => (
          <div key={m.id} onClick={() => setSelectedMember(m)} className="glass-card p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-outline-variant/20">
              <img src={m.photoUrl || 'https://picsum.photos/seed/user/100/100'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-on-surface">{m.name}</h4>
                {m.badge === 'Gold' && (
                  <span className="bg-primary text-on-primary text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">গোল্ড</span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant opacity-60 font-medium">{m.occupation || 'সদস্য'}</p>
              <p className="text-[10px] text-primary font-bold mt-1">{m.bloodGroup} গ্রুপ</p>
            </div>
            <a href={`tel:${m.phone}`} onClick={e => e.stopPropagation()} className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary shadow-lg active:scale-90 transition-transform">
              <span className="material-symbols-outlined">call</span>
            </a>
          </div>
        ))}
      </div>

      {selectedMember && !isEditing && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card w-full max-w-md p-8 shadow-2xl my-8 relative"
          >
            <button 
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-all"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex flex-col items-center text-center space-y-4 mb-8">
              <div className="w-32 h-32 rounded-[32px] overflow-hidden border-4 border-primary/20 shadow-xl">
                <img src={selectedMember.photoUrl || 'https://picsum.photos/seed/user/200/200'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-primary font-headline">{selectedMember.name}</h3>
                <p className="text-sm font-bold opacity-60 uppercase tracking-widest">{selectedMember.occupation || 'সদস্য'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 py-6 border-y border-outline-variant/10">
              <DetailItem label="পিতার নাম" value={selectedMember.fatherName} />
              <DetailItem label="মাতার নাম" value={selectedMember.motherName} />
              <DetailItem label="ফোন নম্বর" value={selectedMember.phone} />
              <DetailItem label="রক্তের গ্রুপ" value={selectedMember.bloodGroup} />
              <DetailItem label="জন্ম তারিখ" value={selectedMember.dob} />
              <DetailItem label="বৈবাহিক অবস্থা" value={selectedMember.maritalStatus} />
              <DetailItem label="লিঙ্গ" value={selectedMember.gender} />
              <DetailItem label="পেশা" value={selectedMember.occupation} />
            </div>

            {selectedMember.remarks && (
              <div className="mt-6 p-4 bg-surface-container rounded-2xl">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">মন্তব্য</p>
                <p className="text-xs leading-relaxed opacity-70">{selectedMember.remarks}</p>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <a href={`tel:${selectedMember.phone}`} className="flex-1 py-4 rounded-2xl bg-secondary text-on-secondary font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">
                <span className="material-symbols-outlined">call</span>
                কল করুন
              </a>
              {memberData?.role === 'admin' && (
                <button 
                  onClick={() => startEdit(selectedMember)}
                  className="flex-1 py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined">edit</span>
                  এডিট করুন
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card w-full max-w-md p-8 shadow-2xl my-8"
          >
            <h3 className="text-2xl font-black mb-6 text-primary font-headline">
              {selectedMember ? 'সদস্যের তথ্য সম্পাদনা' : 'নতুন সদস্য যোগ করুন'}
            </h3>
            <form className="space-y-4" onSubmit={selectedMember ? handleUpdate : async (e) => {
              e.preventDefault();
              setUploading(true);
              try {
                let photoUrl = '';
                if (photoFile) {
                  const storageRef = ref(storage, `members/${Date.now()}`);
                  await uploadBytes(storageRef, photoFile);
                  photoUrl = await getDownloadURL(storageRef);
                }
                await addDoc(collection(db, 'members'), {
                  ...editData,
                  photoUrl,
                  createdAt: serverTimestamp()
                });
                setIsEditing(false);
                setEditData({});
                setPhotoFile(null);
                toast.success('নতুন সদস্য যোগ করা হয়েছে!');
              } catch (error) {
                console.error("Error adding member:", error);
                toast.error('ব্যর্থ হয়েছে।');
              } finally {
                setUploading(false);
              }
            }}>
              <input 
                value={editData.name || ''} 
                onChange={e => setEditData({...editData, name: e.target.value})} 
                placeholder="নাম" 
                className="input-field" 
                required 
              />
              <input 
                value={editData.fatherName || ''} 
                onChange={e => setEditData({...editData, fatherName: e.target.value})} 
                placeholder="পিতার নাম" 
                className="input-field" 
              />
              <input 
                value={editData.motherName || ''} 
                onChange={e => setEditData({...editData, motherName: e.target.value})} 
                placeholder="মাতার নাম" 
                className="input-field" 
              />
              <input 
                type="date"
                value={editData.dob || ''} 
                onChange={e => setEditData({...editData, dob: e.target.value})} 
                className="input-field" 
                placeholder="জন্ম তারিখ"
              />
              <input 
                type="date"
                value={editData.anniversary || ''} 
                onChange={e => setEditData({...editData, anniversary: e.target.value})} 
                className="input-field" 
                placeholder="বিবাহ বার্ষিকী"
              />
              <input 
                value={editData.phone || ''} 
                onChange={e => setEditData({...editData, phone: e.target.value})} 
                placeholder="ফোন নম্বর" 
                className="input-field" 
                required 
              />
              <select 
                value={editData.bloodGroup || ''} 
                onChange={e => setEditData({...editData, bloodGroup: e.target.value})} 
                className="input-field"
              >
                <option value="">রক্তের গ্রুপ</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">ছবি</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-4 rounded-2xl bg-surface-container text-on-surface-variant font-bold uppercase tracking-widest active:scale-95 transition-all">
                  বাতিল
                </button>
                <button type="submit" disabled={uploading} className="flex-1 py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50">
                  {uploading ? 'প্রসেসিং...' : 'সেভ করুন'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value?: string }) {
  return (
    <div className="text-left">
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{label}</p>
      <p className="text-sm font-bold text-on-surface">{value || 'N/A'}</p>
    </div>
  );
}

function Marketplace({ memberData }: { memberData: Member | null }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: '', desc: '' });
  const [uploading, setUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberData) return toast.error('আইটেম বিক্রি করতে সদস্য হিসেবে নিবন্ধন করুন');
    setUploading(true);
    try {
      let photoUrl = '';
      if (photoFile) {
        const storageRef = ref(storage, `products/${Date.now()}_${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'products'), {
        name: formData.name,
        price: Number(formData.price),
        description: formData.desc,
        photoUrl,
        sellerPhone: memberData.phone,
        sellerUid: memberData.uid,
        createdAt: serverTimestamp()
      });

      setShowAdd(false);
      setFormData({ name: '', price: '', desc: '' });
      setPhotoFile(null);
      toast.success('আইটেম সফলভাবে যোগ করা হয়েছে!');
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error('ব্যর্থ হয়েছে।');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে আপনি এই আইটেমটি মুছে ফেলতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('আইটেম মুছে ফেলা হয়েছে');
    } catch (e) {
      toast.error('মুছে ফেলা ব্যর্থ হয়েছে।');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end px-2">
        <h3 className="text-xl font-black font-headline">ব্যাপারী বাড়ি হাট</h3>
        {memberData && (
          <button 
            onClick={() => setShowAdd(true)}
            className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            আইটেম বিক্রি করুন
          </button>
        )}
      </div>

      <div className="grid gap-8">
        {products.map(p => (
          <div key={p.id} className="glass-card overflow-hidden p-0 group">
            <div className="relative h-56 overflow-hidden">
              <img src={p.photoUrl || 'https://picsum.photos/seed/product/400/200'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute top-4 right-4 px-4 py-2 bg-primary text-on-primary rounded-full font-black text-sm shadow-xl">
                ৳{p.price}
              </div>
              {memberData && (memberData.role === 'admin' || memberData.uid === p.sellerUid) && (
                <button 
                  onClick={() => handleDelete(p.id)}
                  className="absolute top-4 left-4 w-10 h-10 rounded-full bg-error text-on-error shadow-xl flex items-center justify-center active:scale-90 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              )}
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-black text-on-surface font-headline">{p.name}</h3>
                <p className="text-sm text-on-surface-variant opacity-60 mt-1 line-clamp-2">{p.description}</p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm">person</span>
                  </div>
                  <span className="text-xs font-bold opacity-60">বিক্রেতা</span>
                </div>
                <a href={`tel:${p.sellerPhone}`} className="px-6 py-3 rounded-xl bg-secondary text-on-secondary font-bold uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-sm">call</span>
                  যোগাযোগ করুন
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card w-full max-w-md p-8 shadow-[0_32px_64px_rgba(0,0,0,0.5)]"
          >
            <h3 className="text-2xl font-black mb-6 text-primary font-headline">নতুন আইটেম যোগ করুন</h3>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="আইটেমের নাম" 
                className="input-field" 
                required 
              />
              <input 
                value={formData.price} 
                onChange={e => setFormData({...formData, price: e.target.value})} 
                type="number" 
                placeholder="দাম (৳)" 
                className="input-field" 
                required 
              />
              <textarea 
                value={formData.desc} 
                onChange={e => setFormData({...formData, desc: e.target.value})} 
                placeholder="আইটেমের বিবরণ" 
                className="input-field h-32" 
                required 
              />
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">আইটেমের ছবি</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-4 rounded-2xl bg-surface-container text-on-surface-variant font-bold uppercase tracking-widest active:scale-95 transition-all">
                  বাতিল
                </button>
                <button type="submit" disabled={uploading} className="flex-1 py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50">
                  {uploading ? 'আপলোড হচ্ছে...' : 'পোস্ট করুন'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Events({ memberData }: { memberData: Member | null }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', date: '' });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const qEvents = query(collection(db, 'events'), where('status', '==', 'approved'), orderBy('date', 'asc'));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    const qFunds = query(collection(db, 'funds'), orderBy('createdAt', 'desc'));
    const unsubscribeFunds = onSnapshot(qFunds, (snapshot) => {
      setFunds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fund)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'funds');
    });

    return () => {
      unsubscribeEvents();
      unsubscribeFunds();
    };
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberData) return toast.error('ইভেন্ট যোগ করতে সদস্য হিসেবে নিবন্ধন করুন');
    setUploading(true);
    try {
      let photoUrl = '';
      if (photoFile) {
        const storageRef = ref(storage, `events/${Date.now()}_${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'events'), {
        title: newEvent.title,
        description: newEvent.description,
        date: newEvent.date,
        photoUrl,
        authorUid: memberData.uid,
        status: memberData?.role === 'admin' ? 'approved' : 'pending',
        createdAt: serverTimestamp()
      });

      setShowAddEvent(false);
      setNewEvent({ title: '', description: '', date: '' });
      setPhotoFile(null);
      toast.success(memberData?.role === 'admin' ? 'ইভেন্ট সফলভাবে যোগ করা হয়েছে!' : 'ইভেন্ট অনুমোদনের জন্য পাঠানো হয়েছে!');
    } catch (error) {
      console.error("Error adding event:", error);
      toast.error('ব্যর্থ হয়েছে।');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-xl font-black font-headline">আসন্ন ইভেন্ট</h3>
          <button 
            onClick={() => setShowAddEvent(true)}
            className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            ইভেন্ট যোগ করুন
          </button>
        </div>

        {showAddEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-card w-full max-w-md p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-black mb-6 text-primary font-headline">নতুন ইভেন্ট</h3>
              <form className="space-y-5" onSubmit={handleAddEvent}>
                <input 
                  value={newEvent.title} 
                  onChange={e => setNewEvent({...newEvent, title: e.target.value})} 
                  placeholder="ইভেন্টের নাম" 
                  className="input-field" 
                  required 
                />
                <input 
                  type="date"
                  value={newEvent.date} 
                  onChange={e => setNewEvent({...newEvent, date: e.target.value})} 
                  className="input-field" 
                  required 
                />
                <textarea 
                  value={newEvent.description} 
                  onChange={e => setNewEvent({...newEvent, description: e.target.value})} 
                  placeholder="বিস্তারিত বিবরণ" 
                  className="input-field h-32" 
                  required 
                />
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">ইভেন্টের ছবি</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddEvent(false)} className="flex-1 py-4 rounded-2xl bg-surface-container text-on-surface-variant font-bold uppercase tracking-widest active:scale-95 transition-all">
                    বাতিল
                  </button>
                  <button type="submit" disabled={uploading} className="flex-1 py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50">
                    {uploading ? 'আপলোড হচ্ছে...' : (memberData?.role === 'admin' ? 'পোস্ট করুন' : 'অনুমোদনের জন্য পাঠান')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        <div className="space-y-4">
          {events.map(e => (
            <div key={e.id} className="glass-card p-6 space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-black text-on-surface font-headline">{e.title}</h3>
                <div className="px-3 py-1 bg-surface-container rounded-full text-[10px] font-bold uppercase tracking-widest opacity-60">
                  {format(new Date(e.date), 'dd MMM')}
                </div>
              </div>
              <p className="text-sm text-on-surface-variant opacity-60 leading-relaxed">{e.description}</p>
              <div className="pt-3 flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest">
                <span className="material-symbols-outlined text-sm">location_on</span>
                ব্যাপারী বাড়ি প্রাঙ্গণ
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-xl font-black font-headline">তহবিল ট্র্যাকার</h3>
          <span className="text-xs font-bold text-secondary uppercase tracking-widest">সাপোর্ট</span>
        </div>
        <div className="space-y-6">
          {funds.map(f => (
            <div key={f.id} className="glass-card p-6 space-y-6">
              <div>
                <h3 className="text-lg font-black text-on-surface font-headline mb-1">{f.title}</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">লক্ষ্য: ৳{f.target}</p>
              </div>
              
              <div className="space-y-2">
                <div className="w-full bg-surface-container h-4 rounded-full overflow-hidden p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (f.current / f.target) * 100)}%` }}
                    className="bg-primary h-full rounded-full shadow-[0_0_15px_rgba(177,242,190,0.5)]"
                  ></motion.div>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-black text-primary uppercase tracking-tighter">
                    {Math.round((f.current / f.target) * 100)}% সংগৃহীত
                  </span>
                  <span className="text-[10px] font-black text-on-surface-variant opacity-40 uppercase tracking-tighter">
                    ৳{f.current} জমা হয়েছে
                  </span>
                </div>
              </div>

              <div className="p-4 bg-surface-container-highest rounded-2xl border border-outline-variant/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">পেমেন্ট নির্দেশাবলী</p>
                <p className="text-xs font-medium opacity-70 leading-relaxed">{f.instructions}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SOSButton({ memberData }: { memberData: Member | null }) {
  const [activeAlert, setActiveAlert] = useState<SOSAlert | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'sos_alerts'), where('status', '==', 'active'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveAlert({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SOSAlert);
      } else {
        setActiveAlert(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sos_alerts');
    });
    return () => unsubscribe();
  }, []);

  const handleSOS = () => {
    if (!memberData) return toast.error('এসওএস পাঠাতে সদস্য হিসেবে নিবন্ধন করুন');
    if (!navigator.geolocation) return toast.error('Geolocation সমর্থিত নয়');
    
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await addDoc(collection(db, 'sos_alerts'), {
          userName: memberData.name,
          userPhone: memberData.phone,
          userUid: memberData.uid,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          status: 'active',
          createdAt: serverTimestamp()
        });
        toast.success('জরুরি সতর্কতা পাঠানো হয়েছে!');
      } catch (error) {
        console.error("Error sending SOS:", error);
        toast.error('ব্যর্থ হয়েছে।');
      }
    }, (error) => {
      toast.error('অবস্থান পাওয়া যায়নি।');
    });
  };

  if (!memberData) return null;

  return (
    <>
      <div className="fixed bottom-28 right-6 z-50">
        <button 
          onClick={handleSOS} 
          className="w-16 h-16 rounded-full bg-error text-on-error shadow-[0_0_30px_rgba(186,26,26,0.6)] flex items-center justify-center font-black text-sm uppercase tracking-widest active:scale-90 transition-all border-4 border-white/20 btn-sos-trigger"
        >
          জরুরি
        </button>
      </div>

      {activeAlert && (
        <div className="fixed top-24 left-6 right-6 z-[100]">
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-error text-on-error p-5 rounded-[24px] shadow-2xl flex items-center gap-4 border border-white/20"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-ping absolute opacity-50"></div>
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center relative">
              <span className="material-symbols-outlined text-2xl">emergency</span>
            </div>
            <div className="flex-1">
              <p className="font-black text-sm uppercase tracking-tighter">{activeAlert.userName} বিপদে আছে!</p>
              <a 
                href={`https://www.google.com/maps?q=${activeAlert.latitude},${activeAlert.longitude}`}
                target="_blank"
                className="text-[10px] font-bold uppercase tracking-widest underline opacity-80"
              >
                ম্যাপে অবস্থান দেখুন
              </a>
            </div>
            <button onClick={() => setActiveAlert(null)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </motion.div>
        </div>
      )}
    </>
  );
}

function AdminPanel() {
  const [pendingMembers, setPendingMembers] = useState<Member[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'members'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'members', id), {
        status: 'approved'
      });
      toast.success('সদস্য অনুমোদিত হয়েছে!');
    } catch (error) {
      console.error("Error approving member:", error);
      toast.error('ব্যর্থ হয়েছে।');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'members', id));
      toast.success('সদস্য বাতিল করা হয়েছে!');
    } catch (error) {
      console.error("Error rejecting member:", error);
      toast.error('ব্যর্থ হয়েছে।');
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let count = 0;
        for (const row of data) {
          // Map Excel columns to Member fields
          // Assuming columns: Name, Father, Mother, Phone, Blood, Occupation, DOB
          const member: Partial<Member> = {
            name: row['Name'] || row['নাম'] || '',
            fatherName: row['Father'] || row['পিতার নাম'] || '',
            motherName: row['Mother'] || row['মাতার নাম'] || '',
            phone: String(row['Phone'] || row['ফোন'] || ''),
            bloodGroup: row['Blood'] || row['রক্তের গ্রুপ'] || '',
            occupation: row['Occupation'] || row['পেশা'] || '',
            dob: row['DOB'] || row['জন্ম তারিখ'] || '',
            status: 'approved',
            role: 'member',
            uid: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: serverTimestamp()
          };

          if (member.name && member.phone) {
            await addDoc(collection(db, 'members'), member);
            count++;
          }
        }
        toast.success(`${count} জন সদস্য সফলভাবে যোগ করা হয়েছে!`);
      } catch (error) {
        console.error("Excel Import Error:", error);
        toast.error('এক্সেল ইমপোর্ট ব্যর্থ হয়েছে।');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-xl font-black font-headline">অ্যাডমিন হাব</h3>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">কন্ট্রোল প্যানেল</span>
        </div>
        
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <span className="material-symbols-outlined text-3xl">cloud_upload</span>
            <div>
              <h4 className="font-black font-headline">এক্সেল ডেটা সিঙ্ক</h4>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">একসাথে অনেক সদস্য যোগ করুন</p>
            </div>
          </div>
          
          <div className="relative">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleExcelUpload} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-full py-8 border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center gap-2 bg-surface-container/30">
              <span className="material-symbols-outlined text-4xl opacity-20">upload_file</span>
              <span className="text-xs font-bold uppercase tracking-widest opacity-40">আপলোড করতে ক্লিক করুন বা ড্র্যাগ করুন</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-xl font-black font-headline">পেন্ডিং সদস্য</h3>
          <span className="text-xs font-bold text-secondary uppercase tracking-widest">{pendingMembers.length} জন অপেক্ষায়</span>
        </div>
        
        <div className="grid gap-4">
          {pendingMembers.length === 0 ? (
            <div className="glass-card p-10 text-center opacity-40">
              <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
              <p className="text-xs font-bold uppercase tracking-widest">কোন পেন্ডিং আবেদন নেই</p>
            </div>
          ) : (
            pendingMembers.map(m => (
              <div key={m.id} className="glass-card p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface">{m.name}</h4>
                    <p className="text-xs opacity-60 font-medium">{m.phone}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleApprove(m.id)} 
                  className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
                >
                  অনুমোদন করুন
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
