/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Newspaper, TrendingUp, Clock, Share2, ExternalLink, RefreshCw, ChevronLeft, ChevronRight, Menu, X, Info, Settings, User as UserIcon, Heart, LogOut } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { auth, loginWithGoogle, logout, onAuthStateChanged, db, handleFirestoreError, OperationType, User } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, Timestamp, getDoc } from 'firebase/firestore';

// Initialize Gemini for news generation (mocking a news API for the demo)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  time: string;
  imageUrl: string;
}

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.9,
    rotateY: direction > 0 ? 45 : -45,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    rotateY: 0,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.9,
    rotateY: direction < 0 ? 45 : -45,
  })
};

export default function App() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<Record<string, any>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Create user doc if not exists
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: 'user'
            });
          }
        } catch (err) {
          console.error("Error setting up user doc:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Favorites Listener & Expiration Check
  useEffect(() => {
    if (!user) {
      setFavorites({});
      return;
    }

    const q = query(collection(db, 'favorites'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const favs: Record<string, any> = {};
      const now = Timestamp.now();
      
      snapshot.docs.forEach(async (docSnap) => {
        const data = docSnap.data();
        // Check expiration (24 hours)
        if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
          try {
            await deleteDoc(doc(db, 'favorites', docSnap.id));
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `favorites/${docSnap.id}`);
          }
        } else {
          favs[data.newsId] = { ...data, id: docSnap.id };
        }
      });
      setFavorites(favs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'favorites');
    });

    return () => unsubscribe();
  }, [user]);

  const toggleFavorite = async (news: NewsItem) => {
    if (!user) {
      loginWithGoogle();
      return;
    }

    const favId = `${user.uid}_${news.id}`;
    if (favorites[news.id]) {
      try {
        await deleteDoc(doc(db, 'favorites', favId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `favorites/${favId}`);
      }
    } else {
      const now = Timestamp.now();
      const expiresAt = new Timestamp(now.seconds + 24 * 60 * 60, now.nanoseconds);
      try {
        await setDoc(doc(db, 'favorites', favId), {
          userId: user.uid,
          newsId: news.id,
          title: news.title,
          summary: news.summary,
          imageUrl: news.imageUrl,
          createdAt: now,
          expiresAt: expiresAt
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `favorites/${favId}`);
      }
    }
  };

  const fetchNews = async (isPrefetch = false) => {
    if (loading && !isPrefetch) return;
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Genera una singola notizia flash di oggi in italiano molto interessante. Formato JSON: un oggetto con id, title, summary, category, time, e imageSearchTerm (un termine in inglese per cercare un'immagine correlata).",
        config: {
          responseMimeType: "application/json",
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      const imageUrl = `https://picsum.photos/seed/${data.imageSearchTerm || Math.random()}/1600/900`;
      const newItem = { ...data, imageUrl, id: Date.now().toString() };
      
      setNewsItems(prev => {
        // Avoid duplicates if prefetch triggers twice
        if (prev.some(item => item.title === newItem.title)) return prev;
        return [...prev, newItem];
      });

      // Preload image
      const img = new Image();
      img.src = imageUrl;

    } catch (err) {
      console.error("Error fetching news:", err);
    } finally {
      if (!isPrefetch) setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchNews();
      setLoading(false);
      // Prefetch the second one immediately
      fetchNews(true);
    };
    init();
  }, []);

  const paginate = (newDirection: number) => {
    const nextIndex = currentIndex + newDirection;
    if (nextIndex >= 0 && nextIndex < newsItems.length) {
      setDirection(newDirection);
      setCurrentIndex(nextIndex);
      
      // If we are moving to the last item, prefetch the next one
      if (nextIndex === newsItems.length - 1 && !showFavoritesOnly) {
        fetchNews(true);
      }
    }
  };

  const currentNews = newsItems[currentIndex];
  const displayedNews = showFavoritesOnly ? Object.values(favorites) : newsItems;
  const currentItem = displayedNews[currentIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative flex items-center justify-center font-montserrat text-slate-200 p-5 perspective-1000">
      {/* Background Layer with Stars and Lights */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-black" />
        
        {/* Animated Background Lights */}
        {[
          { color: 'bg-indigo-600/20', size: 'w-[600px] h-[600px]', initial: { x: -100, y: -100 } },
          { color: 'bg-blue-600/10', size: 'w-[500px] h-[500px]', initial: { x: '80%', y: '20%' } },
          { color: 'bg-slate-800/20', size: 'w-[700px] h-[700px]', initial: { x: '20%', y: '70%' } },
        ].map((light, i) => (
          <motion.div
            key={`light-${i}`}
            initial={light.initial}
            animate={{
              x: [light.initial.x, '50%', light.initial.x],
              y: [light.initial.y, '50%', light.initial.y],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 15 + i * 5,
              repeat: Infinity,
              ease: "linear"
            }}
            className={`absolute rounded-full blur-[120px] mix-blend-screen ${light.color} ${light.size}`}
          />
        ))}

        {/* Animated Blurred Stars */}
        {[...Array(25)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            initial={{ 
              x: (Math.random() * 90 + 5) + '%', 
              y: (Math.random() * 90 + 5) + '%',
              opacity: Math.random() * 0.3 + 0.1,
              scale: Math.random() * 0.4 + 0.3
            }}
            animate={{
              opacity: [0.1, 0.5, 0.1],
              scale: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 4 + Math.random() * 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute w-1 h-1 bg-white/60 rounded-full blur-[1.5px]"
          />
        ))}
      </div>

      <motion.main 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="relative z-10 w-full h-full max-w-7xl flex items-center"
      >
        <div className="relative w-full h-full group" ref={containerRef}>
          {/* Top-Right Heart Icon (Add to Favorite) */}
          {currentItem && (
            <motion.button
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => toggleFavorite(currentItem as NewsItem)}
              className="absolute top-[30px] right-[30px] z-[100] w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all group shadow-2xl"
            >
              <Heart className={`w-5 h-5 transition-all duration-300 ${favorites[currentItem.id] ? 'text-pink-500 fill-pink-500 scale-110' : 'text-white/40 group-hover:text-white'}`} />
            </motion.button>
          )}

          {/* Fixed Floating Menu - Bottom Right */}
          <div className="absolute bottom-[30px] right-[30px] z-[100]">
            <div className="relative">
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial="closed"
                    animate="open"
                    exit="closed"
                    variants={{
                      open: {
                        transition: {
                          staggerChildren: 0.1,
                          delayChildren: 0.1
                        }
                      },
                      closed: {
                        transition: {
                          staggerChildren: 0.05,
                          staggerDirection: -1
                        }
                      }
                    }}
                    className="absolute bottom-full right-0 mb-6 flex flex-col items-end gap-4"
                  >
                    {[
                      { icon: RefreshCw, label: 'Aggiorna', action: () => fetchNews() },
                      { 
                        icon: user ? LogOut : UserIcon, 
                        label: user ? 'Logout' : 'Account', 
                        action: user ? logout : loginWithGoogle 
                      },
                      { 
                        icon: Heart, 
                        label: showFavoritesOnly ? 'Tutte le News' : 'Preferite (24h)', 
                        action: () => { setShowFavoritesOnly(!showFavoritesOnly); setCurrentIndex(0); } 
                      },
                      { 
                        icon: Share2, 
                        label: 'Condividi', 
                        action: () => {
                          if (navigator.share && currentItem) {
                            navigator.share({
                              title: currentItem.title,
                              text: currentItem.summary,
                              url: window.location.href
                            }).catch(console.error);
                          }
                        } 
                      },
                      { 
                        icon: ExternalLink, 
                        label: 'Fonte Originale', 
                        action: () => {
                          // Placeholder for future source link
                          window.open('https://news.google.com', '_blank');
                        } 
                      },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        variants={{
                          open: { 
                            opacity: 1, 
                            x: 0, 
                            scale: 1,
                            transition: { type: "spring", stiffness: 300, damping: 20 }
                          },
                          closed: { 
                            opacity: 0, 
                            x: 20, 
                            scale: 0.5,
                            transition: { duration: 0.2 }
                          }
                        }}
                        className="flex items-center gap-3"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 pointer-events-none whitespace-nowrap bg-black/20 px-2 py-1 rounded-md backdrop-blur-sm border border-white/5">
                          {item.label}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.15, backgroundColor: 'rgba(255,255,255,0.15)' }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => { item.action(); setIsMenuOpen(false); }}
                          className="w-12 h-12 rounded-full bg-slate-900/90 backdrop-blur-2xl border border-white/10 flex items-center justify-center text-white/80 hover:text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-colors"
                        >
                          <item.icon className="w-5 h-5" />
                        </motion.button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center border border-white/10 transition-all shadow-2xl backdrop-blur-md ${isMenuOpen ? 'bg-white/20 border-white/40' : 'bg-white/5 hover:bg-white/10 opacity-60 hover:opacity-100'}`}
              >
                {isMenuOpen ? (
                  <X className="w-6 h-6 text-white" />
                ) : (
                  <Menu className="w-6 h-6 text-white" />
                )}
              </motion.button>
            </div>
          </div>

          <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-cyan-500 to-indigo-500 rounded-[2.5rem] blur-lg opacity-10 group-hover:opacity-30 transition duration-1000 animate-tilt"></div>
          
          <div className="relative w-full h-full bg-slate-900/20 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden border border-slate-700/20 shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col">
            <div className="absolute inset-0 pointer-events-none border-[3.5px] border-t-slate-100/40 border-l-slate-100/40 border-b-black/80 border-r-black/80 rounded-[2.5rem] z-30 shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]"></div>
            
            <div className="absolute inset-0 pointer-events-none rounded-[2.5rem] overflow-hidden z-40">
              {/* Reflection removed from here to be moved inside the news item */}
            </div>
            
            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                {loading && displayedNews.length === 0 ? (
                  <motion.div 
                    key="loading"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-12 h-12 border-2 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                  </motion.div>
                ) : error && displayedNews.length === 0 ? (
                  <motion.div 
                    key="error"
                    className="absolute inset-0 flex items-center justify-center p-10"
                  >
                    <p className="text-slate-500 font-light italic text-sm">Segnale disturbato...</p>
                  </motion.div>
                ) : (
                  currentItem && (
                    <motion.div
                      key={currentItem.id}
                      custom={direction}
                      variants={variants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.8}
                      onDragEnd={(e, { offset, velocity }) => {
                        const swipe = Math.abs(offset.x) > 100 || Math.abs(velocity.x) > 500;
                        if (swipe) {
                          const nextIndex = currentIndex + (offset.x > 0 ? -1 : 1);
                          if (nextIndex >= 0 && nextIndex < displayedNews.length) {
                            setDirection(offset.x > 0 ? -1 : 1);
                            setCurrentIndex(nextIndex);
                            
                            // Prefetch if near the end
                            if (nextIndex === displayedNews.length - 1 && !showFavoritesOnly) {
                              fetchNews(true);
                            }
                          }
                        }
                      }}
                      transition={{
                        x: { type: "spring", stiffness: 450, damping: 35 },
                        opacity: { duration: 0.15 },
                        scale: { duration: 0.2 },
                        rotateY: { duration: 0.2 }
                      }}
                      className="absolute inset-0 flex flex-col cursor-grab active:cursor-grabbing preserve-3d"
                    >
                      {/* Dynamic Reflection - Triggers only on entry */}
                      <motion.div 
                        initial={{ left: '-100%', top: '-100%' }}
                        animate={{ left: '200%', top: '200%' }}
                        transition={{ duration: 1.2, ease: "easeInOut", delay: 0.3 }}
                        className="absolute w-[40%] h-[300%] bg-gradient-to-r from-transparent via-white/40 to-transparent rotate-[35deg] blur-md z-40 pointer-events-none"
                      />

                      <div className="absolute inset-0 z-0">
                        <img 
                          src={currentItem.imageUrl} 
                          alt={currentItem.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover grayscale-[20%] contrast-[110%]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-10" />
                      </div>

                      <div className="relative z-20 flex-1 flex flex-col justify-end p-10 md:p-20">
                        <motion.div 
                          initial={{ y: 30, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2, duration: 0.8 }}
                          className="max-w-2xl space-y-4"
                        >
                          <div className="flex items-center gap-4">
                            <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight drop-shadow-2xl font-montserrat uppercase">
                              {currentItem.title}
                            </h2>
                          </div>
                          <p className="text-sm md:text-base text-slate-300 font-light leading-relaxed drop-shadow-lg font-montserrat">
                            {currentItem.summary}
                          </p>
                        </motion.div>
                      </div>
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            </div>

            {/* Loading overlay for subsequent fetches */}
            {loading && newsItems.length > 0 && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </motion.main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tilt {
          0%, 50%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(0.1deg); }
          75% { transform: rotate(-0.1deg); }
        }
        .animate-tilt {
          animation: tilt 15s infinite linear;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .bg-silver-metallic {
          background: linear-gradient(135deg, #bdc3c7 0%, #2c3e50 50%, #bdc3c7 100%);
          background-size: 200% 200%;
          animation: metallic-shine 3s linear infinite;
        }
        @keyframes metallic-shine {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}} />
    </div>
  );
}

