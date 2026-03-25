import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, doc, getDoc, setDoc, updateDoc, onSnapshot, query, where, orderBy, 
  addDoc, serverTimestamp, type User, handleFirestoreError, OperationType, getDocs, limit
} from './firebase';
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
  dob?: string;
  marriageDate?: string;
  phone: string;
  profession?: string;
  achievement?: string;
  badge?: 'Gold' | 'Silver' | 'None';
  status: 'pending' | 'approved';
  role: 'admin' | 'member';
  photoUrl?: string;
  uid: string;
  bloodGroup?: string;
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
  phone: string;
  status: 'Available' | 'Taken';
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

  useEffect(() => {
    if (isMock) {
      setMemberData({
        id: 'mock-admin',
        name: 'Admin (Bypass)',
        phone: '01700000000',
        status: 'approved',
        role: 'admin',
        uid: 'mock-admin'
      } as Member);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const memberRef = doc(db, 'members', u.uid);
        onSnapshot(memberRef, (docSnap) => {
          if (docSnap.exists()) {
            setMemberData({ id: docSnap.id, ...docSnap.data() } as Member);
          } else {
            setMemberData(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("Error fetching member data:", err);
          setLoading(false);
        });
      } else {
        setMemberData(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [isMock]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('লগইন সফল হয়েছে!');
    } catch (error) {
      toast.error('লগইন ব্যর্থ হয়েছে।');
    }
  };

  const handleBypassLogin = (code: string) => {
    if (code === '9944') {
      setIsMock(true);
      setUser({
        uid: 'mock-admin',
        email: 'saifullahsojib998@gmail.com',
        displayName: 'Admin Bypass'
      });
      toast.success('অ্যাডমিন বাইপাস সফল!');
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

  if (!memberData) {
    return <RegistrationPage user={user} onLogout={handleLogout} />;
  }

  if (memberData.status === 'pending') {
    return <PendingPage onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen pb-32 bg-background text-on-surface font-body">
      <Toaster position="top-center" />
      
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
            <span className="material-symbols-outlined text-primary">family_history</span>
          </div>
          <h1 className="text-xl font-black text-primary tracking-tighter font-headline">ডিজিটাল ব্যাপারী বাড়ি</h1>
        </div>
        <div className="flex items-center gap-2">
          {(memberData.role === 'admin' || user.email === 'saifullahsojib998@gmail.com') && (
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

      <main className="pt-24 px-6 space-y-10 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'home' && <Home memberData={memberData} setActiveTab={setActiveTab} />}
            {activeTab === 'health' && <Health memberData={memberData} />}
            {activeTab === 'tree' && <FamilyTree />}
            {activeTab === 'directory' && <Directory />}
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-on-surface font-body relative overflow-hidden">
      <div className="absolute top-6 left-6 z-20">
        <button onClick={() => setShowBypass(false)} className="flex items-center gap-2 text-on-surface-variant opacity-60 hover:opacity-100 transition-all font-bold uppercase tracking-widest text-xs">
          <span className="material-symbols-outlined text-sm">arrow_back</span> পিছনে
        </button>
      </div>

      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[120px]"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center z-10"
      >
        <div className="w-24 h-24 bg-surface-container-highest rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl border border-outline-variant/20">
          <span className="material-symbols-outlined text-5xl text-primary">family_history</span>
        </div>
        
        <h1 className="text-4xl font-black mb-4 tracking-tighter text-primary font-headline">ডিজিটাল ব্যাপারী বাড়ি</h1>
        <p className="text-on-surface-variant opacity-60 mb-12 font-medium leading-relaxed">
          আমাদের শিকড়কে সংযুক্ত করা, আমাদের উত্তরাধিকার উদযাপন করা। <br/>
          ডিজিটাল পারিবারিক নেটওয়ার্কে যোগ দিন।
        </p>
        
        <div className="space-y-4">
          <div className="relative group">
            <button 
              onClick={onLogin} 
              disabled={true}
              className="w-full py-4 rounded-2xl bg-surface-container text-on-surface-variant opacity-40 font-bold uppercase tracking-widest flex items-center justify-center gap-3 cursor-not-allowed"
            >
              <span className="material-symbols-outlined">login</span>
              গুগল লগইন (নিষ্ক্রিয়)
            </button>
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-error text-on-error text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              সাময়িকভাবে অনুপলব্ধ
            </div>
          </div>

          <div className="pt-8 border-t border-outline-variant/10">
            {!showBypass ? (
              <button 
                onClick={() => setShowBypass(true)}
                className="w-full py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined">key</span>
                অ্যাডমিন কোড দিয়ে লগইন করুন
              </button>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <input 
                  type="password" 
                  value={code} 
                  onChange={e => setCode(e.target.value)}
                  placeholder="অ্যাডমিন কোড দিন (৯৯৪৪)"
                  className="input-field text-center"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => onBypass(code)}
                    className="flex-1 py-4 rounded-2xl bg-secondary text-on-secondary font-bold uppercase tracking-widest active:scale-95 transition-all"
                  >
                    প্রবেশ করুন
                  </button>
                  <button 
                    onClick={() => setShowBypass(false)}
                    className="px-6 rounded-2xl bg-surface-container text-on-surface-variant font-bold uppercase tracking-widest active:scale-95 transition-all"
                  >
                    বাতিল
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RegistrationPage({ user, onLogout }: { user: User, onLogout: () => void }) {
  const [name, setName] = useState(user.displayName || '');
  const [phone, setPhone] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dob, setDob] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [secretCode, setSecretCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return toast.error('ফোন নম্বর প্রয়োজন');
    
    const isAdminCode = secretCode === '9944';
    
    try {
      await setDoc(doc(db, 'members', user.uid), {
        name,
        phone,
        fatherName,
        dob,
        bloodGroup,
        status: isAdminCode ? 'approved' : 'pending',
        role: isAdminCode ? 'admin' : 'member',
        uid: user.uid,
        photoUrl: user.photoURL,
        createdAt: serverTimestamp()
      });
      if (isAdminCode) {
        toast.success('অ্যাডমিন নিবন্ধন সফল হয়েছে!');
      } else {
        toast.success('নিবন্ধন সফল হয়েছে! অ্যাডমিন অনুমোদনের জন্য অপেক্ষা করুন।');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'members');
    }
  };

  return (
    <div className="min-h-screen p-6 flex flex-col items-center justify-center bg-background text-on-surface font-body">
      <div className="w-full max-w-md mb-6">
        <button onClick={onLogout} className="flex items-center gap-2 text-on-surface-variant opacity-60 hover:opacity-100 transition-all font-bold uppercase tracking-widest text-xs">
          <span className="material-symbols-outlined text-sm">arrow_back</span> পিছনে
        </button>
      </div>
      <div className="glass-card max-w-md w-full p-8">
        <h2 className="text-3xl font-black mb-8 text-primary font-headline">সদস্য নিবন্ধন</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1">পুরো নাম</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1">পিতার নাম</label>
            <input value={fatherName} onChange={e => setFatherName(e.target.value)} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1">ফোন নম্বর</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="input-field" required />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1">রক্তের গ্রুপ</label>
              <select 
                value={bloodGroup} 
                onChange={e => setBloodGroup(e.target.value)} 
                className="input-field appearance-none"
                required
              >
                <option value="">নির্বাচন করুন</option>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1">জন্ম তারিখ</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="input-field" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1">গোপন কোড (ঐচ্ছিক)</label>
            <input type="password" value={secretCode} onChange={e => setSecretCode(e.target.value)} className="input-field" placeholder="অ্যাডমিন কোড থাকলে দিন" />
          </div>
          <button type="submit" className="w-full py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest mt-4 shadow-xl active:scale-95 transition-all">
            আবেদন জমা দিন
          </button>
        </form>
      </div>
    </div>
  );
}

function PendingPage({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen p-6 flex flex-col items-center justify-center text-center bg-background text-on-surface font-body">
      <div className="w-full max-w-md mb-6 flex justify-start">
        <button onClick={onLogout} className="flex items-center gap-2 text-on-surface-variant opacity-60 hover:opacity-100 transition-all font-bold uppercase tracking-widest text-xs">
          <span className="material-symbols-outlined text-sm">arrow_back</span> পিছনে
        </button>
      </div>
      <div className="glass-card max-w-md p-10">
        <div className="w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center mx-auto mb-8 animate-pulse">
          <span className="material-symbols-outlined text-4xl text-secondary">hourglass_empty</span>
        </div>
        <h2 className="text-3xl font-black mb-4 text-primary font-headline">অ্যাকাউন্ট পেন্ডিং</h2>
        <p className="text-on-surface-variant opacity-60 mb-10 font-medium leading-relaxed">আপনার আবেদনটি বর্তমানে অ্যাডমিন প্যানেল দ্বারা পর্যালোচনা করা হচ্ছে। অনুমোদিত হলে আপনি অ্যাক্সেস পাবেন।</p>
        <button onClick={onLogout} className="w-full py-4 rounded-2xl bg-surface-container text-on-surface-variant font-bold uppercase tracking-widest active:scale-95 transition-all">
          লগআউট
        </button>
      </div>
    </div>
  );
}

// --- Feature Components ---

function Health({ memberData }: { memberData: Member }) {
  const [activeSubTab, setActiveSubTab] = useState<'donors' | 'medicine'>('donors');
  const [showDonorReg, setShowDonorReg] = useState(false);

  const handleDonorReg = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    try {
      await addDoc(collection(db, 'blood_donors'), {
        name: memberData.name,
        bloodGroup: memberData.bloodGroup || form.bloodGroup.value,
        location: form.location.value,
        phone: memberData.phone,
        status: 'ACTIVE',
        uid: memberData.uid,
        createdAt: serverTimestamp()
      });
      setShowDonorReg(false);
      toast.success('রক্তদাতা হিসেবে নিবন্ধিত হয়েছেন!');
    } catch (error) {
      toast.error('নিবন্ধন করতে ব্যর্থ হয়েছে');
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
              {!memberData.bloodGroup && (
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

      {activeSubTab === 'donors' ? <BloodDonorDirectory /> : <MedicineSharing memberData={memberData} />}
    </div>
  );
}

function BloodDonorDirectory() {
  const [donors, setDonors] = useState<BloodDonor[]>([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const q = query(collection(db, 'blood_donors'), orderBy('bloodGroup'));
    return onSnapshot(q, (snapshot) => {
      setDonors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BloodDonor)));
    });
  }, []);

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

function MedicineSharing({ memberData }: { memberData: Member }) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', type: '', quantity: '' });

  useEffect(() => {
    const q = query(collection(db, 'medicines'), orderBy('status'));
    return onSnapshot(q, (snapshot) => {
      setMedicines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medicine)));
    });
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'medicines'), {
        ...newMed,
        donorName: memberData.name,
        donorUid: memberData.uid,
        phone: memberData.phone,
        status: 'Available',
        timestamp: serverTimestamp()
      });
      setShowAdd(false);
      setNewMed({ name: '', type: '', quantity: '' });
      toast.success('ওষুধ সফলভাবে শেয়ার করা হয়েছে!');
    } catch (error) {
      toast.error('ওষুধ শেয়ার করতে ব্যর্থ হয়েছে');
    }
  };

  return (
    <div className="space-y-6">
      <button 
        onClick={() => setShowAdd(!showAdd)}
        className="w-full py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined">{showAdd ? 'close' : 'add_circle'}</span>
        {showAdd ? 'বাতিল' : 'ওষুধ শেয়ার করুন'}
      </button>

      {showAdd && (
        <motion.form 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleAdd} 
          className="glass-card p-6 space-y-4"
        >
          <input
            type="text"
            placeholder="ওষুধের নাম"
            className="input-field"
            value={newMed.name}
            onChange={e => setNewMed({ ...newMed, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="ধরন (যেমন: ট্যাবলেট)"
              className="input-field"
              value={newMed.type}
              onChange={e => setNewMed({ ...newMed, type: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="পরিমাণ"
              className="input-field"
              value={newMed.quantity}
              onChange={e => setNewMed({ ...newMed, quantity: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-secondary text-on-secondary font-bold uppercase tracking-widest">
            ওষুধ পোস্ট করুন
          </button>
        </motion.form>
      )}

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
              <a href={`tel:${med.phone}`} className="flex items-center gap-2 text-primary font-bold text-sm">
                <span className="material-symbols-outlined text-lg">call</span>
                কল করুন
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Home({ memberData, setActiveTab }: { memberData: Member, setActiveTab: (tab: string) => void }) {
  const [birthdays, setBirthdays] = useState<Member[]>([]);
  const [anniversaries, setAnniversaries] = useState<Member[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'members'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMembers = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member));
      const today = format(new Date(), 'MM-dd');
      
      setBirthdays(allMembers.filter(m => m.dob && format(new Date(m.dob), 'MM-dd') === today));
      setAnniversaries(allMembers.filter(m => m.marriageDate && format(new Date(m.marriageDate), 'MM-dd') === today));
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
            {memberData.name.split(' ')[0]} <br/>
            <span className="opacity-60">ব্যাপারী বাড়ি</span>
          </h2>
          <div className="mt-8 flex gap-4">
            <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
              {memberData.bloodGroup || 'N/A'} গ্রুপ
            </div>
            <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
              {memberData.role === 'admin' ? 'অ্যাডমিন' : 'সদস্য'}
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

  useEffect(() => {
    if (!svgRef.current) return;

    const data = {
      name: "দাদা ব্যাপারী",
      children: [
        {
          name: "বড় বাবা",
          children: [
            { name: "ভাই ১" },
            { name: "ভাই ২" }
          ]
        },
        {
          name: "ছোট বাবা",
          children: [
            { name: "ভাই ৩" },
            { name: "বোন ১" }
          ]
        }
      ]
    };

    const width = 800;
    const height = 400;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", "translate(80,0)");

    const treeLayout = d3.tree().size([height, width - 200]);
    const root = d3.hierarchy(data);
    treeLayout(root);

    svg.selectAll(".link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "link")
      .attr("stroke", "#b1f2be")
      .attr("stroke-width", 2)
      .attr("fill", "none")
      .attr("opacity", 0.3)
      .attr("d", d3.linkHorizontal<any, any>()
        .x((d: any) => d.y)
        .y((d: any) => d.x) as any);

    const node = svg.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

    node.append("circle")
      .attr("r", 8)
      .attr("fill", "#006d3b")
      .attr("stroke", "#b1f2be")
      .attr("stroke-width", 2);

    node.append("text")
      .attr("dy", ".35em")
      .attr("x", (d: any) => d.children ? -15 : 15)
      .attr("text-anchor", (d: any) => d.children ? "end" : "start")
      .attr("fill", "#e1e3db")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .text((d: any) => d.data.name);

  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end px-2">
        <h3 className="text-xl font-black font-headline">বংশতালিকা</h3>
        <span className="text-xs font-bold text-primary uppercase tracking-widest">ইন্টারেক্টিভ</span>
      </div>
      <div className="glass-card overflow-x-auto p-6">
        <div className="min-w-[600px]">
          <svg ref={svgRef}></svg>
        </div>
      </div>
    </div>
  );
}

function Directory() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'members'), where('status', '==', 'approved'));
    return onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
    });
  }, []);

  const filtered = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.profession?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40">search</span>
        <input 
          placeholder="নাম বা পেশা দিয়ে খুঁজুন..." 
          className="input-field pl-12"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {filtered.map(m => (
          <div key={m.id} className="glass-card p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-outline-variant/20">
              <img src={m.photoUrl || 'https://picsum.photos/seed/user/100/100'} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-on-surface">{m.name}</h4>
                {m.badge === 'Gold' && (
                  <span className="bg-primary text-on-primary text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">গোল্ড</span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant opacity-60 font-medium">{m.profession || 'সদস্য'}</p>
              {m.achievement && (
                <p className="text-[10px] text-primary font-bold mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">workspace_premium</span>
                  {m.achievement}
                </p>
              )}
            </div>
            <a href={`tel:${m.phone}`} className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary shadow-lg active:scale-90 transition-transform">
              <span className="material-symbols-outlined">call</span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function Marketplace({ memberData }: { memberData: Member }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end px-2">
        <h3 className="text-xl font-black font-headline">ব্যাপারী বাড়ি হাট</h3>
        <button 
          onClick={() => setShowAdd(true)}
          className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
          আইটেম বিক্রি করুন
        </button>
      </div>

      <div className="grid gap-8">
        {products.map(p => (
          <div key={p.id} className="glass-card overflow-hidden p-0 group">
            <div className="relative h-56 overflow-hidden">
              <img src={p.photoUrl || 'https://picsum.photos/seed/product/400/200'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute top-4 right-4 px-4 py-2 bg-primary text-on-primary rounded-full font-black text-sm shadow-xl">
                ৳{p.price}
              </div>
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
            <form className="space-y-5" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as any;
              try {
                await addDoc(collection(db, 'products'), {
                  name: form.name.value,
                  price: Number(form.price.value),
                  description: form.desc.value,
                  sellerPhone: memberData.phone,
                  sellerUid: memberData.uid,
                  createdAt: serverTimestamp()
                });
                setShowAdd(false);
                toast.success('আইটেম সফলভাবে যোগ করা হয়েছে!');
              } catch (error) {
                handleFirestoreError(error, OperationType.CREATE, 'products');
              }
            }}>
              <input name="name" placeholder="আইটেমের নাম" className="input-field" required />
              <input name="price" type="number" placeholder="দাম (৳)" className="input-field" required />
              <textarea name="desc" placeholder="আইটেমের বিবরণ" className="input-field h-32" required />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-4 rounded-2xl bg-surface-container text-on-surface-variant font-bold uppercase tracking-widest active:scale-95 transition-all">
                  বাতিল
                </button>
                <button type="submit" className="flex-1 py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                  পোস্ট করুন
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Events({ memberData }: { memberData: Member }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);

  useEffect(() => {
    const qEvents = query(collection(db, 'events'), where('status', '==', 'approved'), orderBy('date', 'desc'));
    const qFunds = query(collection(db, 'funds'), orderBy('createdAt', 'desc'));
    
    const unsubEvents = onSnapshot(qEvents, (s) => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as Event))));
    const unsubFunds = onSnapshot(qFunds, (s) => setFunds(s.docs.map(d => ({ id: d.id, ...d.data() } as Fund))));
    
    return () => { unsubEvents(); unsubFunds(); };
  }, []);

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-xl font-black font-headline">আসন্ন ইভেন্ট</h3>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">ফিড</span>
        </div>
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

function SOSButton({ memberData }: { memberData: Member }) {
  const [activeAlert, setActiveAlert] = useState<SOSAlert | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'sos'), orderBy('timestamp', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const alert = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SOSAlert;
        if (alert.timestamp && Date.now() - alert.timestamp.toMillis() < 30 * 60 * 1000) {
          setActiveAlert(alert);
        } else {
          setActiveAlert(null);
        }
      }
    });
  }, []);

  const handleSOS = () => {
    if (!navigator.geolocation) return toast.error('Geolocation সমর্থিত নয়');
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await addDoc(collection(db, 'sos'), {
          uid: memberData.uid,
          userName: memberData.name,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          message: 'জরুরি সাহায্য প্রয়োজন!',
          timestamp: serverTimestamp()
        });
        toast.success('জরুরি সতর্কতা পাঠানো হয়েছে!');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'sos');
      }
    }, () => {
      toast.error('অবস্থান অ্যাক্সেস প্রত্যাখ্যাত হয়েছে');
    });
  };

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
    return onSnapshot(q, (snapshot) => {
      setPendingMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
    });
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'members', id), { status: 'approved' });
      toast.success('সদস্য সফলভাবে অনুমোদিত হয়েছে');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'members');
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      toast.loading('ডেটা আপলোড হচ্ছে...');
      for (const row of data) {
        if (row.Name && row.Phone) {
          try {
            const q = query(collection(db, 'members'), where('phone', '==', String(row.Phone)));
            const existing = await getDocs(q);
            if (existing.empty) {
              await addDoc(collection(db, 'members'), {
                name: row.Name,
                fatherName: row.Father || '',
                dob: row.DOB || '',
                marriageDate: row.Marriage || '',
                phone: String(row.Phone),
                status: 'approved',
                role: 'member',
                createdAt: serverTimestamp()
              });
            }
          } catch (err) {
            console.error("Error uploading row:", err);
          }
        }
      }
      toast.dismiss();
      toast.success('এক্সেল ডেটা সিঙ্ক সম্পন্ন হয়েছে');
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
