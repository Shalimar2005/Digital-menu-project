import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { db, auth, storage } from '../firebase';
import { Order, Dish, CATEGORIES, Category, BAR_SUBCATEGORIES, FOOD_SUBCATEGORIES, SNACKS_SUBCATEGORIES } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Plus, Trash2, CheckCircle, Clock, ChefHat, LayoutGrid, ListOrdered, ChevronDown, BarChart3, Users, IndianRupee, TrendingUp, Upload, Loader2, Edit3, QrCode } from 'lucide-react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { QRCodeCanvas } from 'qrcode.react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export default function ManagerDashboard() {
  const [view, setView] = useState<'dashboard' | 'kds' | 'cms' | 'qr'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [isAddingDish, setIsAddingDish] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dishToDelete, setDishToDelete] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingWrite, setIsTestingWrite] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const user = auth.currentUser;

  // CMS Form State
  const [newDish, setNewDish] = useState({
    name: '',
    price: '',
    ingredients: '',
    category: CATEGORIES[0] as Category,
    subcategory: '',
    pairing_tag: '',
    imageUrl: ''
  });

  const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        providerInfo: auth.currentUser?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName,
          email: p.email
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error:', JSON.stringify(errInfo, null, 2));
    // We don't throw here to avoid crashing the whole dashboard, but we log it clearly
    return errInfo;
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, () => {
      setAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const qOrders = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsubscribeOrders = onSnapshot(qOrders,
      (snapshot) => {
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'orders');
      }
    );

    const qDishes = query(collection(db, 'dishes'));
    const unsubscribeDishes = onSnapshot(qDishes,
      (snapshot) => {
        setDishes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dish)));
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'dishes');
      }
    );

    return () => {
      unsubscribeOrders();
      unsubscribeDishes();
    };
  }, [authReady]);

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      alert('Failed to update order status. Check permissions.');
    }
  };

  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clean price string (remove ₹, $ and commas)
    const cleanPrice = newDish.price.replace(/[₹$,]/g, '');
    const priceNum = parseFloat(cleanPrice);
    if (isNaN(priceNum)) {
      alert('Please enter a valid price (numbers only)');
      return;
    }

    setIsSaving(true);
    try {
      const dishData = {
        ...newDish,
        price: priceNum,
        timestamp: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'dishes', editingId), dishData);
      } else {
        await addDoc(collection(db, 'dishes'), dishData);
      }

      setIsAddingDish(false);
      setEditingId(null);
      setNewDish({ name: '', price: '', ingredients: '', category: CATEGORIES[0], subcategory: '', pairing_tag: '', imageUrl: '' });
    } catch (err: any) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `dishes/${editingId}` : 'dishes');
      alert(`Failed to save dish: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditDish = (dish: Dish) => {
    setNewDish({
      name: dish.name,
      price: dish.price.toString(),
      ingredients: dish.ingredients,
      category: dish.category as Category,
      subcategory: dish.subcategory || '',
      pairing_tag: dish.pairing_tag,
      imageUrl: dish.imageUrl || ''
    });
    setEditingId(dish.id);
    setIsAddingDish(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('Starting image upload:', file.name, file.size);
    setIsUploading(true);
    try {
      // Client-side image compression
      console.log('Compressing image...');
      const compressedFile = await compressImage(file);
      console.log('Compressed size:', compressedFile.size);
      const storageRef = ref(storage, `dishes/${Date.now()}_${file.name}`);
      console.log('Uploading to storage...');
      const snapshot = await uploadBytes(storageRef, compressedFile);
      console.log('Upload successful, getting URL...');
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Image URL:', downloadURL);
      setNewDish(prev => ({ ...prev, imageUrl: downloadURL }));
    } catch (err: any) {
      console.error('Upload Error:', err);
      alert(`Failed to upload image: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Compression timed out')), 15000);
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          clearTimeout(timeout);
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas to Blob failed'));
          }, 'image/jpeg', 0.7);
        };
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load image for compression'));
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSeedData = async () => {
    const sampleDishes = [
      { name: 'Truffle Wagyu Sliders', price: 28, ingredients: 'A5 Wagyu, Black truffle aioli, Brioche', category: 'Snacks', pairing_tag: 'Rich, Umami', imageUrl: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=800' },
      { name: 'Oysters Rockefeller', price: 24, ingredients: 'Half dozen oysters, Spinach, Pernod, Breadcrumbs', category: 'Snacks', pairing_tag: 'Briny, Herbal', imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800' },
      { name: 'Lobster Thermidor', price: 65, ingredients: 'Whole lobster, Cognac cream sauce, Gruyere', category: 'Classic Food Menu', subcategory: 'Seafood', pairing_tag: 'Decadent, Creamy', imageUrl: 'https://images.unsplash.com/photo-1559742811-822873691df8?auto=format&fit=crop&w=800' },
      { name: 'Vintage Old Fashioned', price: 22, ingredients: 'Small batch bourbon, Demerara, House bitters', category: 'Drinks', subcategory: 'Signature Cocktail', pairing_tag: 'Oak, Spice', imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800' },
      { name: 'Dom Pérignon', price: 450, ingredients: 'Vintage Champagne', category: 'Drinks', subcategory: 'Wines', pairing_tag: 'Effervescent, Toasty', imageUrl: 'https://images.unsplash.com/photo-1594460541513-667946995191?auto=format&fit=crop&w=800' },
      { name: 'Beluga Caviar', price: 120, ingredients: '30g Beluga, Blinis, Traditional garnishes', category: 'Snacks', pairing_tag: 'Luxurious, Salty', imageUrl: 'https://images.unsplash.com/photo-1519354141505-08189871587d?auto=format&fit=crop&w=800' },
      { name: 'Gold Leaf Sushi Roll', price: 45, ingredients: 'Bluefin toro, Gold leaf, Caviar topping', category: 'Classic Food Menu', subcategory: 'Sushi', pairing_tag: 'Extravagant', imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800' },
      { name: 'Classic Vanilla Milkshake', price: 12, ingredients: 'Premium vanilla bean ice cream, Whole milk, Whipped cream', category: 'Drinks', subcategory: 'Milkshake', pairing_tag: 'Creamy, Sweet', imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800' },
      { name: 'Butter Naan', price: 12, ingredients: 'Soft tandoor-baked flatbread brushed with melted butter. Perfect for scooping up rich curries and gravies.', category: 'Classic Food Menu', subcategory: 'Naan/ Roti', pairing_tag: 'bread', imageUrl: 'https://picsum.photos/seed/butternaan/800/600' },
      { name: 'Tandoori Roti', price: 10, ingredients: 'Whole wheat bread cooked in a traditional clay oven. Light, slightly crisp, and a healthier choice.', category: 'Classic Food Menu', subcategory: 'Naan/ Roti', pairing_tag: 'bread', imageUrl: 'https://picsum.photos/seed/tandooriroti/800/600' },
      { name: 'Cheese Naan', price: 20, ingredients: 'Soft naan stuffed with melted cheese inside. A rich and indulgent bread loved by cheese lovers.', category: 'Classic Food Menu', subcategory: 'Naan/ Roti', pairing_tag: 'bread', imageUrl: 'https://picsum.photos/seed/cheesenaan/800/600' },
      { name: 'Plain Roti (Chapati)', price: 10, ingredients: 'Soft whole-wheat flatbread cooked on a hot griddle. A simple and healthy bread that pairs perfectly with any curry or dal.', category: 'Classic Food Menu', subcategory: 'Naan/ Roti', pairing_tag: 'bread', imageUrl: 'https://picsum.photos/seed/chapati/800/600' }
    ];

    try {
      for (const dish of sampleDishes) {
        await addDoc(collection(db, 'dishes'), {
          ...dish,
          timestamp: new Date().toISOString()
        });
      }
      alert('Sample menu seeded successfully!');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'dishes (seeding)');
      alert(`Failed to seed menu: ${err.message}`);
    }
  };

  const handleDeleteDish = async (id: string) => {
    setDishToDelete(id);
  };

  const confirmDelete = async () => {
    if (!dishToDelete) return;
    try {
      await deleteDoc(doc(db, 'dishes', dishToDelete));
      setDishToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `dishes/${dishToDelete}`);
      alert('Failed to delete dish. Check permissions.');
    }
  };

  const stats = {
    totalRevenue: orders.filter(o => o.status === 'served').reduce((acc, o) => acc + o.totalAmount, 0),
    activeOrders: orders.filter(o => o.status !== 'served').length,
    totalOrders: orders.length,
    averageOrderValue: orders.length > 0 ? orders.reduce((acc, o) => acc + o.totalAmount, 0) / orders.length : 0
  };

  const popularItems = orders.flatMap(o => o.items).reduce((acc, item) => {
    acc[item.name] = (acc[item.name] || 0) + item.quantity;
    return acc;
  }, {} as { [key: string]: number });

  const topItems = Object.entries(popularItems)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Chart Data Preparation
  const categoryData = orders.reduce((acc, order) => {
    order.items.forEach(item => {
      const dish = dishes.find(d => d.name === item.name);
      const cat = dish?.category || 'Other';
      acc[cat] = (acc[cat] || 0) + (item.price * item.quantity);
    });
    return acc;
  }, {} as { [key: string]: number });

  const pieData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];

  const revenueTrend = orders
    .filter(o => o.status === 'served')
    .slice(0, 10)
    .reverse()
    .map(o => ({
      time: o.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amount: o.totalAmount
    }));

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">

      {/* Admin Nav */}
      <nav className="bg-[#111] border-b border-white/10 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <h1 className="font-serif text-2xl italic">Opal</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${view === 'dashboard' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
            >
              <BarChart3 size={16} /> Dashboard
            </button>
            <button
              onClick={() => setView('kds')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${view === 'kds' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
            >
              <ListOrdered size={16} /> Orders
            </button>
            <button
              onClick={() => setView('cms')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${view === 'cms' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
            >
              <LayoutGrid size={16} /> Menu
            </button>
            <button
              onClick={() => setView('qr')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${view === 'qr' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
            >
              <QrCode size={16} /> QR Codes
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
              {user?.email === 'kathadeshalimar@gmail.com' ? 'System Admin' : 'Manager Access'}
            </p>
            <p className="text-[10px] text-white/30">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="text-white/40 hover:text-white flex items-center gap-2 text-sm"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </nav>

      <main className="flex-grow p-8">
        {view === 'dashboard' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#111] border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                    <IndianRupee size={20} />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-white/40">Total Revenue</span>
                </div>
                <div className="text-3xl font-mono">₹{stats.totalRevenue.toFixed(2)}</div>
              </div>
              <div className="bg-[#111] border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                    <ListOrdered size={20} />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-white/40">Total Orders</span>
                </div>
                <div className="text-3xl font-mono">{stats.totalOrders}</div>
              </div>
              <div className="bg-[#111] border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                    <Clock size={20} />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-white/40">Active Orders</span>
                </div>
                <div className="text-3xl font-mono">{stats.activeOrders}</div>
              </div>
              <div className="bg-[#111] border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
                    <TrendingUp size={20} />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-white/40">Avg. Order Value</span>
                </div>
                <div className="text-3xl font-mono">₹{stats.averageOrderValue.toFixed(2)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-[#111] border border-white/5 p-8 rounded-3xl min-h-[400px]">
                <h3 className="font-serif text-xl italic mb-6">Revenue Trend (Last 10 Served)</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="time" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                        itemStyle={{ color: '#10b981' }}
                      />
                      <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#111] border border-white/5 p-8 rounded-3xl min-h-[400px]">
                <h3 className="font-serif text-xl italic mb-6">Revenue by Category</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-4 justify-center mt-4">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-[10px] text-white/40 uppercase tracking-widest">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#111] border border-white/5 p-8 rounded-3xl">
                <h3 className="font-serif text-xl italic mb-6">Popular Items</h3>
                <div className="space-y-4">
                  {topItems.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <span className="font-medium">{name}</span>
                      <span className="text-sm text-white/40">{count} sold</span>
                    </div>
                  ))}
                  {topItems.length === 0 && (
                    <div className="text-center py-12 text-white/20 uppercase tracking-widest text-xs">No data available</div>
                  )}
                </div>
              </div>

              <div className="bg-[#111] border border-white/5 p-8 rounded-3xl">
                <h3 className="font-serif text-xl italic mb-6">Recent Activity</h3>
                <div className="space-y-4">
                  {orders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <div>
                        <div className="font-medium">Table {order.tableId}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-widest">
                          {order.timestamp?.toDate().toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">₹{order.totalAmount.toFixed(2)}</div>
                        <div className={`text-[10px] uppercase font-bold ${order.status === 'pending' ? 'text-orange-500' : order.status === 'cooking' ? 'text-blue-500' : 'text-green-500'}`}>
                          {order.status}
                        </div>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="text-center py-12 text-white/20 uppercase tracking-widest text-xs">No activity yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : view === 'kds' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {orders.map(order => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`bg-[#111] border rounded-2xl p-6 flex flex-col ${order.status === 'pending' ? 'border-orange-500/30' : order.status === 'cooking' ? 'border-blue-500/30' : 'border-green-500/30'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold">Table {order.tableId}</h3>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">
                        {order.timestamp?.toDate().toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${order.status === 'pending' ? 'bg-orange-500/20 text-orange-500' : order.status === 'cooking' ? 'bg-blue-500/20 text-blue-500' : 'bg-green-500/20 text-green-500'}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="flex-grow space-y-2 mb-6">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.quantity}× {item.name}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'cooking')}
                        className="flex-grow bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <ChefHat size={14} /> Start Cooking
                      </button>
                    )}
                    {order.status === 'cooking' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'served')}
                        className="flex-grow bg-green-600 hover:bg-green-500 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={14} /> Mark Served
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : view === 'qr' ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-serif italic">QR Code Generator</h2>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">Generate table-specific menu links</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(tableId => {
                const url = `${window.location.origin}/menu?table=${tableId}`;
                return (
                  <div key={tableId} className="bg-[#111] border border-white/5 p-8 rounded-3xl flex flex-col items-center space-y-6">
                    <div className="bg-white p-4 rounded-2xl shadow-2xl shadow-white/5">
                      <QRCodeCanvas
                        id={`qr-table-${tableId}`}
                        value={url}
                        size={160}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-bold">Table {tableId}</h3>
                      <p className="text-[10px] text-white/40 break-all mt-2 max-w-[200px] mx-auto">{url}</p>
                    </div>
                    <button
                      onClick={() => {
                        const canvas = document.getElementById(`qr-table-${tableId}`) as HTMLCanvasElement;
                        if (canvas) {
                          const link = document.createElement('a');
                          link.download = `table-${tableId}-qr.png`;
                          link.href = canvas.toDataURL('image/png');
                          link.click();
                        }
                      }}
                      className="w-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-white/5"
                    >
                      Download PNG
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-serif italic">Menu Management</h2>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
                  Logged in as: <span className="text-white/60">{user?.email || 'Unknown'}</span>
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  disabled={isTestingWrite}
                  onClick={async () => {
                    setIsTestingWrite(true);
                    try {
                      const testRef = collection(db, 'test_connection');
                      await addDoc(testRef, {
                        test: true,
                        time: new Date().toISOString(),
                        user: user?.email
                      });
                      alert('Database write test successful!');
                    } catch (err: any) {
                      handleFirestoreError(err, OperationType.WRITE, 'test_connection');
                      alert(`Database write test failed: ${err.message}\n\nCheck if your email (${user?.email}) is correctly set in firestore.rules`);
                    } finally {
                      setIsTestingWrite(false);
                    }
                  }}
                  className="border border-white/10 text-white/40 px-6 py-2 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  {isTestingWrite ? 'Testing...' : 'Test Write'}
                </button>
                <button
                  onClick={handleSeedData}
                  className="border border-white/10 text-white/60 px-6 py-2 rounded-full font-bold text-sm hover:text-white transition-colors"
                >
                  Seed Sample Data
                </button>
                <button
                  onClick={() => setIsAddingDish(true)}
                  className="bg-white text-black px-6 py-2 rounded-full font-bold text-sm flex items-center gap-2"
                >
                  <Plus size={18} /> Add New Dish
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dishes.map(dish => (
                <div key={dish.id} className="bg-[#111] border border-white/5 rounded-2xl p-6 flex gap-4">
                  {dish.imageUrl && <img src={dish.imageUrl} className="w-20 h-20 object-cover rounded-lg" referrerPolicy="no-referrer" />}
                  <div className="flex-grow">
                    <div className="flex justify-between">
                      <h4 className="font-bold">{dish.name}</h4>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditDish(dish)} className="text-white/20 hover:text-white transition-colors"><Edit3 size={16} /></button>
                        <button onClick={() => handleDeleteDish(dish.id)} className="text-white/20 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <p className="text-xs text-white/40 mb-2">{dish.category}</p>
                    <p className="font-mono text-sm">₹{dish.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add Dish Modal */}
      <AnimatePresence>
        {isAddingDish && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAddingDish(false)} />
            <motion.form
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onSubmit={handleSaveDish}
              className="relative w-full max-w-lg bg-[#111] border border-white/10 rounded-3xl p-8 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <h3 className="text-xl font-serif italic mb-4">{editingId ? 'Edit Menu Item' : 'New Menu Item'}</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Dish Name</label>
                  <input
                    required
                    value={newDish.name}
                    onChange={e => setNewDish({ ...newDish, name: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Price (₹)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={newDish.price}
                    onChange={e => setNewDish({ ...newDish, price: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Category</label>
                  <select
                    value={newDish.category}
                    onChange={e => setNewDish({ ...newDish, category: e.target.value as Category })}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {newDish.category === 'Drinks' && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Subcategory</label>
                    <select
                      value={newDish.subcategory}
                      onChange={e => setNewDish({ ...newDish, subcategory: e.target.value })}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm"
                    >
                      <option value="">None</option>
                      {BAR_SUBCATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                {newDish.category === 'Snacks' && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">
                      Subcategory
                    </label>
                    <select
                      value={newDish.subcategory}
                      onChange={e => setNewDish({ ...newDish, subcategory: e.target.value })}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm"
                    >
                      <option value="">None</option>
                      {SNACKS_SUBCATEGORIES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
                {newDish.category === 'Classic Food Menu' && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Subcategory</label>
                    <select
                      value={newDish.subcategory}
                      onChange={e => setNewDish({ ...newDish, subcategory: e.target.value })}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm"
                    >
                      <option value="">None</option>
                      {FOOD_SUBCATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Ingredients</label>
                <textarea
                  value={newDish.ingredients}
                  onChange={e => setNewDish({ ...newDish, ingredients: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm h-20"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Pairing Tag (Flavor Profile)</label>
                <input
                  placeholder="e.g. Spicy, Umami, Citrusy"
                  value={newDish.pairing_tag}
                  onChange={e => setNewDish({ ...newDish, pairing_tag: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Dish Image</label>
                <div className="flex gap-4 items-center">
                  <div className="flex-grow">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="dish-image-upload"
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="dish-image-upload"
                      className={`flex items-center justify-center gap-2 w-full bg-white/5 border border-white/10 border-dashed rounded-lg px-4 py-3 text-sm transition-colors ${isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white/10'}`}
                    >
                      {isUploading ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <Upload size={18} />
                      )}
                      {isUploading ? 'Uploading...' : newDish.imageUrl ? 'Change Image' : 'Upload from Media'}
                    </label>
                  </div>
                  {newDish.imageUrl && (
                    <div className="relative group">
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                        <img
                          src={newDish.imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/broken/200/200';
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewDish(prev => ({ ...prev, imageUrl: '' }))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] text-white/20">Or paste Image URL</p>
                    {isUploading && (
                      <button
                        type="button"
                        onClick={() => setIsUploading(false)}
                        className="text-[10px] text-red-500 hover:underline"
                      >
                        Cancel Upload
                      </button>
                    )}
                  </div>
                  <input
                    value={newDish.imageUrl}
                    onChange={e => {
                      setNewDish({ ...newDish, imageUrl: e.target.value });
                      if (isUploading) setIsUploading(false);
                    }}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => {
                  setIsAddingDish(false);
                  setEditingId(null);
                  setNewDish({ name: '', price: '', ingredients: '', category: CATEGORIES[0], subcategory: '', pairing_tag: '', imageUrl: '' });
                }} className="flex-grow border border-white/10 py-3 rounded-xl text-sm">Cancel</button>
                <button
                  type="submit"
                  disabled={isUploading || isSaving}
                  className="flex-grow bg-white text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : isSaving ? 'Saving...' : 'Save Dish'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {dishToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDishToDelete(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-3xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Dish?</h3>
              <p className="text-white/40 text-sm mb-6">This action cannot be undone. Are you sure you want to remove this item from the menu?</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDishToDelete(null)}
                  className="flex-1 px-6 py-3 rounded-xl border border-white/10 font-bold text-sm hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
