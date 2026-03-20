/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Newspaper, TrendingUp, Clock, Share2, ExternalLink, Menu, X, Settings, User as UserIcon, Heart, LogOut, BookOpen, LayoutGrid, Globe, Cpu, Music, Gamepad2, Palette, FlaskConical, Search } from 'lucide-react';
import { auth, loginWithGoogle, logout, onAuthStateChanged, db, handleFirestoreError, OperationType, User } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, Timestamp, getDoc } from 'firebase/firestore';

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
    scale: 0.95,
    rotateY: direction > 0 ? 30 : -30,
    filter: 'blur(10px)',
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    rotateY: 0,
    filter: 'blur(0px)',
    transition: {
      x: { type: "spring", stiffness: 250, damping: 28 },
      opacity: { duration: 0.3 },
      scale: { duration: 0.4, ease: "easeOut" },
      rotateY: { type: "spring", stiffness: 200, damping: 25 },
      filter: { duration: 0.3 }
    }
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.95,
    rotateY: direction < 0 ? 30 : -30,
    filter: 'blur(10px)',
    transition: {
      x: { type: "spring", stiffness: 250, damping: 28 },
      opacity: { duration: 0.2 },
      filter: { duration: 0.2 }
    }
  })
};

const STATIC_NEWS: NewsItem[] = [
  { 
    id: '1', 
    title: 'Esplorazione Urbana: I Segreti delle Grandi Metropoli', 
    summary: 'Un viaggio attraverso le architetture nascoste e le storie dimenticate delle città più iconiche del mondo, dalla New York sotterranea ai tetti di Parigi.', 
    category: 'Cultura', 
    time: '2 ore fa',
    imageUrl: 'https://picsum.photos/seed/city/1600/900'
  },
  { 
    id: '2', 
    title: 'Innovazione Sostenibile: Il Futuro del Design', 
    summary: 'Come i nuovi materiali biodegradabili e le tecniche di stampa 3D stanno rivoluzionando il modo in cui pensiamo agli oggetti quotidiani e all\'arredamento.', 
    category: 'Tecnologia', 
    time: '4 ore fa',
    imageUrl: 'https://picsum.photos/seed/design/1600/900'
  },
  { 
    id: '3', 
    title: 'Sinfonie Digitali: La Nuova Era della Composizione', 
    summary: 'Musicisti e programmatori collaborano per creare esperienze sonore immersive che sfidano i confini tra analogico e digitale, portando la musica in una nuova dimensione.', 
    category: 'Musica', 
    time: '6 ore fa',
    imageUrl: 'https://picsum.photos/seed/concert/1600/900'
  },
  { 
    id: '4', 
    title: 'L\'Arte del Minimalismo nel Ventesimo Secolo', 
    summary: 'Un\'analisi approfondita di come la semplicità sia diventata una forma d\'espressione potente, influenzando pittura, scultura e stile di vita moderno.', 
    category: 'Arte', 
    time: '8 ore fa',
    imageUrl: 'https://picsum.photos/seed/art/1600/900'
  },
  { 
    id: '5', 
    title: 'Oltre i Confini: Nuove Scoperte in Astrofisica', 
    summary: 'Le ultime osservazioni dei telescopi spaziali rivelano dettagli senza precedenti sulla formazione delle galassie e sulla natura della materia oscura.', 
    category: 'Scienza', 
    time: '12 ore fa',
    imageUrl: 'https://picsum.photos/seed/space/1600/900'
  },
  { 
    id: '6', 
    title: 'Il Fascino dei Videogiochi Indie', 
    summary: 'Perché i piccoli studi di sviluppo stanno conquistando il cuore dei giocatori con narrazioni profonde e meccaniche di gioco innovative e sperimentali.', 
    category: 'Gaming', 
    time: '1 giorno fa',
    imageUrl: 'https://picsum.photos/seed/gaming/1600/900'
  }
];

const CATEGORIES = [
  { id: 'all', label: 'Tutte', icon: Globe, color: 'bg-indigo-600', border: 'border-indigo-400/30' },
  { id: 'scienza', label: 'Scienza', icon: FlaskConical, color: 'bg-emerald-600', border: 'border-emerald-400/30' },
  { id: 'tecnologia', label: 'Tech', icon: Cpu, color: 'bg-blue-600', border: 'border-blue-400/30' },
  { id: 'musica', label: 'Musica', icon: Music, color: 'bg-purple-600', border: 'border-purple-400/30' },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2, color: 'bg-orange-600', border: 'border-orange-400/30' },
  { id: 'arte', label: 'Arte', icon: Palette, color: 'bg-pink-600', border: 'border-pink-400/30' },
  { id: 'sport', label: 'Sport', icon: TrendingUp, color: 'bg-red-600', border: 'border-red-400/30' },
  { id: 'politica', label: 'Politica', icon: BookOpen, color: 'bg-slate-700', border: 'border-slate-500/30' },
];

export default function App() {
  const [newsItems] = useState<NewsItem[]>(STATIC_NEWS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<Record<string, any>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCategoryData = CATEGORIES.find(c => c.id === selectedCategory);
  const SelectedCategoryIcon = selectedCategoryData?.icon;

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

  const paginate = (newDirection: number) => {
    const nextIndex = currentIndex + newDirection;
    if (nextIndex >= 0 && nextIndex < newsItems.length) {
      setDirection(newDirection);
      setCurrentIndex(nextIndex);
    }
  };

  const currentNews = newsItems[currentIndex];
  const displayedNews = (showFavoritesOnly ? Object.values(favorites) : newsItems)
    .filter(item => {
      const matchesCategory = selectedCategory === 'all' || 
        item.category.toLowerCase().includes(selectedCategory.toLowerCase()) || 
        selectedCategory.toLowerCase().includes(item.category.toLowerCase());
      
      const matchesSearch = !searchQuery || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.summary.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  const currentItem = displayedNews[currentIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative flex items-center justify-center font-montserrat text-slate-200">
      <motion.main 
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: 1,
          scale: isMenuOpen ? 0.96 : 1
        }}
        transition={{ 
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1] // Custom quintic ease-out
        }}
        className="relative z-10 w-full h-full flex items-center"
      >
        <div className="relative w-full h-full group" ref={containerRef}>
          {/* Backdrop Blur Overlay when Menu is Open */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsCategoryMenuOpen(false);
                }}
                className="absolute inset-0 bg-black/40 z-[95]"
              />
            )}
          </AnimatePresence>

          {/* Fixed Menu Button at Bottom Right */}
          <div className="absolute bottom-10 right-10 z-[100]">
            <div className="relative">
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0 },
                      show: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.08,
                          delayChildren: 0.05
                        }
                      },
                      exit: {
                        opacity: 0,
                        transition: {
                          staggerChildren: 0.05,
                          staggerDirection: -1
                        }
                      }
                    }}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="absolute bottom-full right-0 mb-6 flex flex-col gap-4"
                  >
                    {[
                      { 
                        icon: LayoutGrid, 
                        label: 'Categorie', 
                        action: () => setIsCategoryMenuOpen(!isCategoryMenuOpen)
                      },
                      { 
                        icon: Heart, 
                        label: showFavoritesOnly ? 'Tutte' : 'Preferiti', 
                        action: () => setShowFavoritesOnly(!showFavoritesOnly)
                      },
                      { 
                        icon: Share2, 
                        label: 'Condividi', 
                        action: () => {
                          if (displayedNews[currentIndex]) {
                            navigator.share?.({
                              title: displayedNews[currentIndex].title,
                              url: displayedNews[currentIndex].url
                            }).catch(() => {});
                          }
                        } 
                      },
                      { 
                        icon: ExternalLink, 
                        label: 'Vai al link', 
                        action: () => {
                          if (displayedNews[currentIndex]) {
                            window.open(displayedNews[currentIndex].url, '_blank');
                          }
                        } 
                      },
                      { 
                        icon: user ? LogOut : UserIcon, 
                        label: user ? 'Logout' : 'Profilo', 
                        action: user ? logout : loginWithGoogle 
                      },
                    ].map((item, i) => (
                      <motion.div 
                        key={i} 
                        variants={{
                          hidden: { opacity: 0, scale: 0.5, y: 20 },
                          show: { 
                            opacity: 1, 
                            scale: 1, 
                            y: 0,
                            transition: { type: "spring", stiffness: 300, damping: 25 }
                          },
                          exit: { 
                            opacity: 0, 
                            scale: 0.5, 
                            y: 20,
                            transition: { duration: 0.2 }
                          }
                        }}
                        animate={isSearchOpen && item.label !== 'Cerca' ? { opacity: 0, scale: 0.8, pointerEvents: 'none' } : 'show'}
                        className="relative group flex justify-end"
                      >
                        <motion.button
                          whileHover={{ scale: 1.15, x: -5 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => { item.action(); if (item.label !== 'Categorie') setIsMenuOpen(false); }}
                          className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-2xl transition-all relative ${
                            (item.label === 'Preferiti' && showFavoritesOnly) 
                              ? 'bg-indigo-500/40 border-indigo-400/50 text-white' 
                              : (item.label === 'Categorie' && isCategoryMenuOpen)
                                ? `${selectedCategoryData?.color.replace('bg-', 'bg-')}/40 border-indigo-400/50 text-white`
                                : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                          } ${isCategoryMenuOpen && item.label !== 'Categorie' ? 'opacity-20' : 'opacity-100'}`}
                        >
                          <motion.div layoutId={item.label === 'Preferiti' && showFavoritesOnly ? "active-fav-icon" : undefined}>
                            <item.icon className="w-5 h-5" />
                          </motion.div>
                          <span className="absolute right-full mr-4 px-3 py-1 rounded-lg bg-slate-900/90 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10">
                            {item.label}
                          </span>
                        </motion.button>

                        {item.label === 'Categorie' && (
                          <AnimatePresence>
                            {isCategoryMenuOpen && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                                {CATEGORIES.map((cat, ci, arr) => {
                                  const angle = (Math.PI / 2) + (Math.PI * (ci / (arr.length - 1))); // From 90 to 270 degrees
                                  const radius = 110;
                                  const x = Math.cos(angle) * radius;
                                  const y = Math.sin(angle) * radius;
                                  
                                  return (
                                    <motion.button
                                      key={cat.id}
                                      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                                      animate={{ x, y, opacity: 1, scale: 1 }}
                                      exit={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                                      transition={{ 
                                        delay: ci * 0.03, 
                                        type: 'spring', 
                                        stiffness: 350, 
                                        damping: 25,
                                        mass: 0.8
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCategory(cat.id);
                                        setIsCategoryMenuOpen(false);
                                        setIsMenuOpen(false);
                                        setCurrentIndex(0);
                                      }}
                                      className={`absolute pointer-events-auto w-[42px] h-[42px] rounded-full flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-xl transition-all group/cat ${
                                        selectedCategory === cat.id 
                                          ? `${cat.color} text-white` 
                                          : 'bg-white/20 text-white/80 hover:bg-white/30 hover:text-white'
                                      }`}
                                      style={{ left: '50%', top: '50%', marginLeft: '-21px', marginTop: '-21px' }}
                                    >
                                      <motion.div layoutId={selectedCategory === cat.id ? "active-cat-icon" : undefined}>
                                        <cat.icon className="w-4 h-4" />
                                      </motion.div>
                                      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-900/90 text-white text-[8px] font-medium opacity-0 group-hover/cat:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                        {cat.label}
                                      </span>
                                    </motion.button>
                                  );
                                })}
                              </div>
                            )}
                          </AnimatePresence>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: 20, scale: 0.5 }}
                    animate={{ opacity: 1, x: -70, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.5 }}
                    className="absolute top-1/2 -translate-y-1/2 right-0 flex items-center"
                  >
                    {isSearchOpen ? (
                      <motion.div 
                        layoutId="search-bubble"
                        className="h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center px-4 shadow-2xl w-[260px]"
                      >
                        <Search className="w-5 h-5 text-white/60 mr-2 shrink-0" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentIndex(0);
                          }}
                          placeholder="Cerca articoli..."
                          className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-white/40"
                          onBlur={() => {
                            if (!searchQuery) setIsSearchOpen(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setIsMenuOpen(false);
                            if (e.key === 'Escape') {
                              setIsSearchOpen(false);
                              setSearchQuery('');
                            }
                          }}
                        />
                        {searchQuery && (
                          <button 
                            onClick={() => {
                              setSearchQuery('');
                              searchInputRef.current?.focus();
                            }}
                            className="ml-2 text-white/40 hover:text-white transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </motion.div>
                    ) : (
                      <motion.button
                        layoutId="search-bubble"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setIsSearchOpen(true);
                          setTimeout(() => searchInputRef.current?.focus(), 100);
                        }}
                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-lg"
                      >
                        <Search className="w-5 h-5" />
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {selectedCategory !== 'all' && !isMenuOpen && (
                  <motion.button
                    initial={{ opacity: 0, y: 20, scale: 0.5 }}
                    animate={{ opacity: 1, y: -135, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setSelectedCategory('all');
                      setCurrentIndex(0);
                    }}
                    className={`absolute bottom-0 right-1 w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg border z-[90] ${selectedCategoryData?.color || 'bg-indigo-600'} ${selectedCategoryData?.border || 'border-indigo-400/30'}`}
                  >
                    <motion.div layoutId="active-cat-icon">
                      {SelectedCategoryIcon && <SelectedCategoryIcon className="w-5 h-5" />}
                    </motion.div>
                  </motion.button>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {!isMenuOpen && (
                  <motion.button
                    initial={{ opacity: 0, y: 20, scale: 0.5 }}
                    animate={{ opacity: 1, y: -75, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      if (!user) {
                        loginWithGoogle();
                        return;
                      }
                      if (currentItem) {
                        toggleFavorite(currentItem as NewsItem);
                      }
                    }}
                    className={`absolute bottom-0 right-1 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border z-[90] transition-all ${
                      currentItem && favorites[currentItem.id]
                        ? 'bg-pink-600 border-pink-400/30 text-white' 
                        : 'bg-white/10 border-white/10 text-white/60 hover:text-white hover:bg-white/20'
                    } ${!user ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}`}
                  >
                    <motion.div layoutId="active-fav-icon">
                      <Heart className={`w-5 h-5 ${currentItem && favorites[currentItem.id] ? 'fill-white' : ''}`} />
                    </motion.div>
                  </motion.button>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.1, rotate: isMenuOpen ? -90 : 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setIsMenuOpen(!isMenuOpen);
                  if (isMenuOpen) {
                    setIsCategoryMenuOpen(false);
                    setIsSearchOpen(false);
                  }
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center border border-white/10 transition-all shadow-2xl backdrop-blur-md z-[100] ${isMenuOpen ? 'bg-white/20 border-white/40' : 'bg-white/5 hover:bg-white/10 opacity-60 hover:opacity-100'}`}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isMenuOpen ? 'close' : 'menu'}
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isMenuOpen ? (
                      <X className="w-6 h-6 text-white" />
                    ) : (
                      <Menu className="w-6 h-6 text-white" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </div>
          </div>

          <div className="relative w-full h-full overflow-hidden flex flex-col bg-black">
            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                {currentItem && (
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
                          const swipe = Math.abs(offset.x) > 50 || Math.abs(velocity.x) > 200;
                          if (swipe) {
                            const nextIndex = currentIndex + (offset.x > 0 ? -1 : 1);
                            if (nextIndex >= 0 && nextIndex < displayedNews.length) {
                              setDirection(offset.x > 0 ? -1 : 1);
                              setCurrentIndex(nextIndex);
                            }
                          }
                        }}
                        transition={{
                          x: { type: "spring", stiffness: 300, damping: 30 },
                          opacity: { duration: 0.2 }
                        }}
                        className="absolute inset-0 flex flex-col cursor-grab active:cursor-grabbing preserve-3d"
                      >
                        <div className="absolute inset-0 z-0">
                          <img 
                            src={currentItem.imageUrl} 
                            alt={currentItem.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          {/* Vignette Effect */}
                          <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_20%,rgba(0,0,0,0.4)_70%,rgba(0,0,0,0.9)_100%)] z-10 pointer-events-none" />
                          {/* Bottom Gradient for Text Readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-20" />
                        </div>

                      <div className="relative z-20 flex-1 flex flex-col justify-end p-8 md:p-16">
                        <motion.div 
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ duration: 0.4 }}
                          className="max-w-2xl space-y-3"
                        >
                          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tighter uppercase drop-shadow-2xl">
                            {currentItem.title}
                          </h2>
                          <p className="text-base md:text-lg text-white/90 font-medium leading-snug drop-shadow-lg line-clamp-3">
                            {currentItem.summary}
                          </p>
                        </motion.div>
                      </div>
                    </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.main>

      <style dangerouslySetInnerHTML={{ __html: `
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
      `}} />
    </div>
  );
}

