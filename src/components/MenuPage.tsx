import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Dish, Category, CATEGORIES, BAR_SUBCATEGORIES, FOOD_SUBCATEGORIES } from '../types';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ShoppingCart, Sparkles, Plus, X, ArrowLeft } from 'lucide-react';
import { getAIPairingSuggestion } from '../services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function DishItem({ dish, onAdd }: { dish: Dish, onAdd: () => void }) {
  return (
    <motion.div
      layout
      className="group relative flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all"
    >
      {dish.imageUrl && (
        <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
          <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="flex-grow">
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-medium text-lg">{dish.name}</h4>
          <span className="font-mono text-sm text-white/60">₹{dish.price}</span>
        </div>
        <p className="text-xs text-white/40 leading-relaxed mb-4 line-clamp-2">{dish.ingredients}</p>
        <button
          onClick={onAdd}
          className="text-[10px] uppercase tracking-widest font-semibold text-white/60 hover:text-white flex items-center gap-2 transition-colors"
        >
          <Plus size={14} /> Add to Order
        </button>
      </div>
    </motion.div>
  );
}

export default function MenuPage() {
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table') || '00';

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [view, setView] = useState<'landing' | 'menu'>('landing');
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [pairing, setPairing] = useState<any>(null);
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'dishes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dish));
      setDishes(items);
    });
    return unsubscribe;
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const addToCart = (dishId: string) => {
    setCart(prev => ({ ...prev, [dishId]: (prev[dishId] || 0) + 1 }));

    const dish = dishes.find(d => d.id === dishId);
    if (dish && (dish.subcategory === 'Main Course' || dish.subcategory === 'Sushi' || dish.subcategory === 'Appetizers')) {
      handleShowPairing(dish);
    }
  };

  const handleShowPairing = async (dish: Dish) => {
    setSelectedDish(dish);
    setIsPairingLoading(true);
    setPairing(null);
    const suggestion = await getAIPairingSuggestion(dish, dishes);
    setPairing(suggestion);
    setIsPairingLoading(false);
  };

  const addSuggestedItem = () => {
    if (!pairing) return;
    const name = pairing.suggestedDrinkName || pairing.suggestedItemName;
    const item = dishes.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (item) {
      setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
    }
    setSelectedDish(null);
  };

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const categoryImages: { [key in Category]: string } = {
    'Drinks': 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80',
    'Snacks': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    'Classic Food Menu': 'https://images.ctfassets.net/3s5io6mnxfqz/6ZImCEzx6UuvuKaAiZEDDN/50479ee4a0902deb4eb1bab720ce248a/image1.jpg'
  };

  return (
    <div className="min-h-screen premium-gradient pb-24 text-white">
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/5 px-6 py-6 flex justify-between items-end">
        <div onClick={() => setView('landing')} className="cursor-pointer">
          <h1 className="font-serif text-4xl italic tracking-tight">Opal</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">Table {tableId} • Fine Dining</p>
        </div>
        <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-white/80 hover:text-white transition-colors">
          <ShoppingCart size={24} strokeWidth={1.5} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-white text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </header>

      <AnimatePresence mode="wait">
        {view === 'landing' ? (
          <motion.section key="landing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="px-6 py-12 grid grid-cols-1 gap-6">
            <div className="mb-8">
              <h2 className="font-serif text-3xl italic mb-2 text-white">Welcome</h2>
              <p className="text-white/40 text-sm">Select a category to explore our menu</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {CATEGORIES.map(category => (
                <button key={category} onClick={() => { setActiveCategory(category); setView('menu'); }} className="relative h-48 rounded-3xl overflow-hidden group active:scale-[0.98] transition-all">
                  <img src={categoryImages[category]} alt={category} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute bottom-6 left-6 text-left">
                    <h3 className="font-serif text-2xl italic text-white">{category}</h3>
                  </div>
                </button>
              ))}
            </div>
          </motion.section>
        ) : (
          <motion.section key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 py-12">
            <button onClick={() => setView('landing')} className="mb-8 text-[10px] uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-2 group">
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Categories
            </button>
            <div className="space-y-12">
              {CATEGORIES.filter(c => !activeCategory || c === activeCategory).map(category => {
                const categoryDishes = dishes.filter(d => d.category === category);
                const subCats = category === 'Drinks' ? BAR_SUBCATEGORIES : FOOD_SUBCATEGORIES;

                return (
                  <div key={category} className="space-y-8">
                    <div className="flex items-center gap-4">
                      <h3 className="font-serif text-2xl italic whitespace-nowrap text-white">{category}</h3>
                      <div className="h-[1px] w-full bg-white/10" />
                    </div>
                    <div className="grid gap-4">
                      {subCats.map(sub => {
                        const subDishes = categoryDishes.filter(d => d.subcategory === sub);
                        if (subDishes.length === 0) return null;
                        return (
                          <div key={sub} className="border border-white/10 rounded-2xl overflow-hidden">
                            <button onClick={() => toggleSection(sub)} className="w-full flex justify-between items-center p-6 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                              <h4 className="font-serif text-xl italic text-white">{sub}</h4>
                              <ChevronDown className={cn("transition-transform duration-300", expandedSections[sub] && "rotate-180")} />
                            </button>
                            <AnimatePresence>
                              {expandedSections[sub] && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-black/40">
                                  <div className="p-6 grid gap-6">
                                    {subDishes.map(dish => <DishItem key={dish.id} dish={dish} onAdd={() => addToCart(dish.id)} />)}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDish && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 text-white">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDish(null)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-3xl p-8 overflow-hidden">
              <button onClick={() => setSelectedDish(null)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={20} /></button>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/80"><Sparkles size={32} strokeWidth={1} /></div>
              </div>
              <div className="text-center space-y-4">
                <h3 className="font-serif text-2xl italic">Chef's Recommendation</h3>
                <p className="text-sm text-white/60">To enhance your <span className="text-white font-medium">{selectedDish.name}</span>, we suggest:</p>
                {isPairingLoading ? (
                  <div className="py-8 flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <p className="text-[10px] uppercase tracking-widest text-white/40">Analyzing Flavors...</p>
                  </div>
                ) : pairing ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-lg font-medium text-white">{pairing.suggestedDrinkName || pairing.suggestedItemName}</p>
                      <p className="text-xs italic text-white/40 mt-1">"{pairing.reason}"</p>
                    </div>
                    <div className="space-y-3">
                      <button
                        onClick={addSuggestedItem}
                        className="w-full bg-white text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-2"
                      >
                        <Plus size={18} /> Add to Order
                      </button>

                      <button
                        onClick={() => setSelectedDish(null)}
                        className="w-full border border-white/20 text-white py-3 rounded-xl hover:bg-white/10 transition"
                      >
                        Don’t Add
                      </button>
                    </div>
                  </div>
                ) : <p className="text-xs text-white/20 py-4 italic">Finding the perfect match...</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111] border border-white/10 p-6 rounded-3xl w-full max-w-sm text-white"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif italic">Your Order</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-white/40 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {Object.keys(cart).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-white/40">Your cart is currently empty</p>
              </div>
            ) : (
              <>
                <ul className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {Object.entries(cart).map(([id, qty]) => {
                    const item = dishes.find(d => d.id === id);
                    if (!item || qty === 0) return null;

                    return (
                      <li key={id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="flex-grow">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-wider">₹{item.price} per unit</p>
                        </div>

                        <div className="flex items-center gap-3 bg-black/40 rounded-lg p-1 border border-white/10">
                          <button
                            onClick={() => setCart(prev => ({ ...prev, [id]: Math.max(prev[id] - 1, 0) }))}
                            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono w-4 text-center">{qty}</span>
                          <button
                            onClick={() => setCart(prev => ({ ...prev, [id]: prev[id] + 1 }))}
                            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-white/40 text-sm">Total Amount</span>
                    <span className="text-xl font-mono font-semibold">
                      ₹{Object.entries(cart).reduce((total, [id, qty]) => {
                        const item = dishes.find(d => d.id === id);
                        return total + (item ? item.price * qty : 0);
                      }, 0)}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={async () => {
                        try {
                          const orderItems = Object.entries(cart)
                            .filter(([_, qty]) => qty > 0)
                            .map(([id, quantity]) => {
                              const dish = dishes.find(d => d.id === id);
                              if (!dish) return null;

                              return {
                                dishId: id,
                                name: dish.name,
                                price: dish.price,
                                quantity
                              };
                            })
                            .filter(Boolean);

                          const totalAmount = Object.entries(cart).reduce((total, [id, qty]) => {
                            const item = dishes.find(d => d.id === id);
                            return total + (item ? item.price * qty : 0);
                          }, 0);

                          await addDoc(collection(db, 'orders'), {
                            tableId,
                            items: orderItems,
                            status: 'pending',
                            timestamp: serverTimestamp(),
                            totalAmount: totalAmount
                          });


                          console.log("Order sent:", {
                            tableId,
                            items: orderItems,
                            totalAmount
                          });

                          setCart({});
                          setIsCartOpen(false);
                          alert('Order placed successfully!');
                        } catch (error) {
                          console.error("Error placing order: ", error);
                          alert('Failed to place order.');
                        }
                      }}
                      className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-white/90 transition-colors"
                    >
                      Place Order
                    </button>

                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="w-full text-white/40 text-[10px] uppercase tracking-widest hover:text-white transition-colors py-2"
                    >
                      Continue Browsing
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}