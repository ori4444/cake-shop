import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CakeSlice, ShoppingBag, ArrowLeft, ArrowRight, Plus, Minus, Trash2, Heart,
  Menu, X, Check, Bell, Package, ClipboardList, ImagePlus, Upload,
  Pencil, Save, Cookie,
} from 'lucide-react';
import { categories, applyCategoryImages, customCakeImages, initialProducts, money } from './data';
import { loadCartSync, loadNewerCart, saveCart, requestPersistentStorage } from './cartStore';
import { getProducts, getCategoryImages, saveCategoryImage, getOrders, deleteOrder, saveProduct, disableProduct, uploadImage, placeOrder } from './supabase';
import './styles.css';

// Each Vercel project builds a distinct public customer site or installable admin app.
const ADMIN_SITE = import.meta.env.VITE_SITE_ROLE === 'admin';

function useShop() {
 const [products,setProducts]=useState(initialProducts);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const reload=async()=>{setLoading(true);setError('');try{const [products, savedImages] = await Promise.all([getProducts(), getCategoryImages()]);applyCategoryImages(savedImages);setProducts(products)}catch(e){setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{reload()},[]);
 return {products,setProducts,loading,error,reload};
}

function App() {
  const shop = useShop();
  const [cart, setCart] = useState(loadCartSync);
  const cartRef = React.useRef(cart);
  const touched = React.useRef(false);
  const [drawer, setDrawer] = useState(false);
  // Restore from IndexedDB if it holds a newer copy (e.g. localStorage write was lost when the app was closed).
  useEffect(() => {
    requestPersistentStorage();
    loadNewerCart().then(items => { if (items && !touched.current) setCart(items); });
  }, []);
  useEffect(() => { cartRef.current = cart; }, [cart]);
  const updateCart = next => { touched.current = true; setCart(next); };
  useEffect(() => { if (touched.current) saveCart(cart); }, [cart]);
  // Save again the moment the app is hidden or closed.
  useEffect(() => {
    const flush = () => { if (touched.current) saveCart(cartRef.current); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', flush); };
  }, []);

  const addToCart = item => updateCart(current => {
    const index = current.findIndex(x => x.type !== 'custom' && x.productId && x.productId === item.productId && x.note === item.note && x.type === item.type);
    if (index < 0) return [...current, { ...item, key: item.key || crypto.randomUUID() }];
    const next = [...current];
    next[index] = { ...next[index], quantity: next[index].quantity + item.quantity };
    return next;
  });

  const removeFromCart = key => updateCart(current => current.filter(item => item.key !== key));
  const changeQuantity = (key, delta) => updateCart(current => current.map(item =>
    item.key === key ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  return <>
    
    <main className="main">
      {!ADMIN_SITE && <CustomerBack products={shop.products} />}
      <RoutesView {...shop} cart={cart} setCart={updateCart} addToCart={addToCart}
        removeFromCart={removeFromCart} changeQuantity={changeQuantity} />
    </main>
    {!ADMIN_SITE && <Footer />}
    {!ADMIN_SITE && count > 0 && <button className="cart-float" onClick={() => setDrawer(true)} aria-label="פתיחת המארז">
      <ShoppingBag size={20} /><span>המארז שלי</span><b>{count}</b>
    </button>}
    {!ADMIN_SITE && <CartDrawer open={drawer} close={() => setDrawer(false)} cart={cart}
      removeFromCart={removeFromCart} changeQuantity={changeQuantity} />}
  </>;
}

function Header() {
  return <header className="header"><div className="header-inner">
  </div></header>;
}

function AdminInstallGate({children}) {
 const [installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true);
 const [prompt,setPrompt]=useState(null);
 useEffect(()=>{
  const onPrompt=e=>{e.preventDefault();setPrompt(e)};
  const onInstalled=()=>setInstalled(true);
  window.addEventListener('beforeinstallprompt',onPrompt);
  window.addEventListener('appinstalled',onInstalled);
  return ()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled)};
 },[]);
 if(installed)return children;
 return <section className="admin-install-gate"><div className="admin-install-box">
  <h1>התקנת האפליקציה</h1>
  <p>כדי לפתוח את הניהול יש להתקין את האפליקציה ולפתוח אותה ממסך הבית.</p>
  {prompt?<button className="button primary" onClick={()=>prompt.prompt()}>התקנת האפליקציה</button>:
  <p>באייפון: Safari ← שיתוף ← הוסף למסך הבית.<br/>באנדרואיד: Chrome ← ⋮ ← התקנת אפליקציה או הוסף למסך הבית.</p>}
 </div></section>;
}

function RoutesView(props) {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  if (ADMIN_SITE) return <Admin {...props} />;
  return <Routes>
    <Route path="/" element={<Home {...props} />} />
    <Route path="/category/:id" element={<Category {...props} />} />
    <Route path="/product/:id" element={<Product {...props} />} />
    <Route path="/custom" element={<Custom {...props} />} />
    <Route path="/checkout" element={<Checkout {...props} />} />
    <Route path="*" element={<NotFound />} />
  </Routes>;
}

// The back button must always work, even when the page was opened directly.
function CustomerBack({ products = [] }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (pathname === '/' || pathname.startsWith('/admin')) return null;
  const back = () => {
    if (pathname.startsWith('/category/') || pathname === '/custom') {
      navigate('/');
      return;
    }
    if (pathname.startsWith('/product/')) {
      const productId = decodeURIComponent(pathname.split('/')[2] || '');
      // Use the category from the loaded products when available;
      // otherwise the home page is always a safe destination.
      const product = products.find(item => item.id === productId) || initialProducts.find(item => item.id === productId);
      if (product) navigate(`/category/${product.categoryId}`);
      else navigate('/');
      return;
    }
    navigate('/');
  };
  return <nav className="customer-back-nav" aria-label="ניווט חזרה">
    <button type="button" onClick={back} aria-label="חזרה אחורה"><ArrowRight size={18} /></button>
  </nav>;
}

function Home({ error }) {
  return <section className="section categories-section home-categories" id="shop">
    {error && <div className="shop-error">{error}</div>}
    <div className="category-grid">{categories.map(category => <Link
      to={category.id === 'custom' ? '/custom' : `/category/${category.id}`}
      className="category-card" key={category.id}>
      <ShopImage src={category.image} alt={category.name} loading="lazy" />
      <div className="category-shade" />
      <div className="category-copy"><h2>{category.name}</h2></div>
    </Link>)}</div>
  </section>;
}

const FALLBACK_IMAGE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160"><rect width="200" height="160" fill="#f4ece3"/><path d="M54 91h92v42H54z" fill="#c58a67"/><path d="M54 91h92l-28-35H82z" fill="#fff8ef"/><path d="M88 72c0-8 6-14 12-14s12 6 12 14" fill="none" stroke="#b67360" stroke-width="5" stroke-linecap="round"/></svg>')}`;

function ShopImage({ src, fallback, alt = '', ...props }) {
  const sources = [...new Set([src, fallback, FALLBACK_IMAGE].filter(Boolean))];
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [src, fallback]);
  return <img {...props} src={sources[sourceIndex] || FALLBACK_IMAGE} alt={alt}
    onError={event => {
      if (sourceIndex < sources.length - 1) setSourceIndex(sourceIndex + 1);
      else event.currentTarget.onerror = null;
    }} />;
}

function FilePicker({ id, file, onChange, placeholder = 'בחרו תמונה', ...rest }) {
  return <label htmlFor={id} className="file-picker">
    <ImagePlus size={18} />
    <span>{file ? file.name : placeholder}</span>
    <input id={id} type="file" onChange={onChange} {...rest} />
  </label>;
}

function ProductCard({ product }) {
  const [loaded, setLoaded] = useState(false);
  return <Link to={`/product/${product.id}`} className="product-card">
    <div className="product-img">
      {!loaded && <Cookie className="product-loading" size={28} aria-hidden="true" />}
      <ShopImage src={product.image} fallback={categories.find(c => c.id === product.categoryId)?.image}
        alt="" loading="lazy" className={loaded ? 'loaded' : ''} onLoad={() => setLoaded(true)} />
    </div>
    <div className="product-copy"><h3>{product.name}</h3><span className="product-price">{money(product.price)}</span></div>
  </Link>;
}

function Category({ products, loading, error }) {
  const { id } = useParams();
  const category = categories.find(item => item.id === id);
  const items = products.filter(product => product.categoryId === id && product.active !== false);
  if (!category) return <NotFound />;
  return <section className="section listing">
    {items.length ? <div className="product-grid">{items.map(product => <ProductCard key={product.id} product={product} />)}</div> :
      loading ? <p className="empty">טוענים מוצרים…</p> :
      error ? <p className="error-msg">{error}</p> :
        <p className="empty">עדיין אין מוצרים בקטגוריה הזאת.</p>}
  </section>;
}

function Product({ products, loading, addToCart }) {
  const { id } = useParams();
  const product = products.find(item => item.id === id);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const navigate = useNavigate();
  if (!product) return loading ? <p className="empty section">טוענים מוצר…</p> : <NotFound />;
  const item = { type: 'product', productId: product.id, name: product.name, image: product.image,
    price: product.price, quantity, note: note.trim() };
  const checkoutNow = () => navigate('/checkout', { state: { direct: true, items: [item] } });
  return <section className="section detail">
    <div className="detail-grid"><div className="detail-photo"><ShopImage src={product.image} fallback={categories.find(c => c.id === product.categoryId)?.image} alt={product.name} /></div>
      <div className="detail-copy"><h1>{product.name}</h1>
        <p>{product.description}</p><div className="detail-price">{money(product.price)}</div>
        <label className="field-label">כמות</label><div className="quantity">
          <button type="button" onClick={() => setQuantity(n => Math.max(1, n - 1))}><Minus size={15} /></button>
          <b>{quantity}</b><button type="button" onClick={() => setQuantity(n => n + 1)}><Plus size={15} /></button>
        </div>
        <label className="field-label" htmlFor="product-note">הערות למוצר</label>
        <textarea id="product-note" value={note} onChange={e => setNote(e.target.value)} rows="3" />
        <button type="button" className="button outline full" onClick={() => { addToCart(item); navigate('/'); }}>הוסף למארז <ShoppingBag size={16} /></button>
        <button className="button primary full" onClick={checkoutNow}>הזמן מוצר <ArrowLeft size={16} /></button>
      </div></div>
  </section>;
}

function Custom({ addToCart }) {
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const chooseFile = event => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!['image/jpeg','image/png','image/webp'].includes(selected.type) || selected.size > 8 * 1024 * 1024) {
      setError('אפשר לצרף תמונת JPG, PNG או WebP עד 8MB.'); return;
    }
    setError('');
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };
  const item = { key: crypto.randomUUID(), type: 'custom', name: 'הזמנה אישית',
    image: preview || categories[5].image, description: description.trim(),
    quantity: 1, file };
  const checkoutNow = () => navigate('/checkout', { state: { direct: true, items: [item] } });
  const addCustomToCart = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      const uploadedImage = file ? await uploadImage(file) : '';
      addToCart({ ...item, file: null, uploadedImage, image: uploadedImage || item.image });
      navigate('/');
    } catch(err) { setError(err.message || 'העלאת התמונה נכשלה.'); }
    finally { setSaving(false); }
  };
  return <section className="section custom-simple">
    <h1>הזמנה אישית</h1>
    <p>כתבו מה להכין, אפשר גם לצרף תמונה לדוגמה.</p>
    <label className="field-label" htmlFor="custom-description">שם / קישור / תיאור ההזמנה</label>
    <textarea id="custom-description" rows="4" maxLength="1000" value={description} onChange={e => setDescription(e.target.value)}
      placeholder="שם העוגה, קישור לדוגמה או תיאור חופשי" />
    <label className="field-label" htmlFor="custom-file">תמונה להמחשה</label>
    <FilePicker id="custom-file" accept="image/jpeg,image/png,image/webp" required file={file} onChange={chooseFile} placeholder="בחרו תמונה להשראה" />
    {preview && <img className="custom-preview" src={preview} alt="תמונת ההשראה שצירפת" />}
    <p className="quote-note">מחיר להזמנה אישית ייקבע לאחר בדיקת הבקשה.</p>
    {error && <p className="error-msg">{error}</p>}
    <button type="button" className="button outline full" disabled={!description.trim() || !file || saving} onClick={addCustomToCart}>
      {saving ? 'מוסיפים…' : 'הוסף למארז'} <ShoppingBag size={16} />
    </button>
    <button className="button primary full" disabled={!description.trim() || !file || saving} onClick={checkoutNow}>
      הזמן עוגה אישית <ArrowLeft size={16} />
    </button>
  </section>;
}

function CartDrawer({ open, close, cart, removeFromCart, changeQuantity }) {
  const total = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const hasUnknownPrice = cart.some(item => item.price == null);
  return <div className={`drawer-wrap ${open ? 'show' : ''}`} onClick={close}>
    <div className="drawer" onClick={e => e.stopPropagation()}>
      <div className="drawer-head"><div><small>הבחירות שלכם</small><h2>המארז שלי <span>({cart.length})</span></h2></div>
        <button onClick={close} aria-label="סגירה"><X /></button></div>
      {cart.length ? <><div className="drawer-items">{cart.map(item => <CartRow key={item.key} item={item}
        remove={() => removeFromCart(item.key)} change={delta => changeQuantity(item.key, delta)} />)}</div>
        {!(hasUnknownPrice && !total) && <div className="drawer-total"><span>{hasUnknownPrice ? "סכום ביניים (ללא הזמנות אישיות)" : "מחיר סופי"}</span><b>{money(total)}</b></div>}
        {hasUnknownPrice && <small className="quote-note">מחיר ההזמנה האישית ייקבע לאחר בדיקה.</small>}
        <Link className="button primary full" to="/checkout" onClick={close}>לסיכום הזמנה <ArrowLeft size={16} /></Link>
      </> : <div className="empty-cart"><ShoppingBag size={32} /><h3>המארז ריק</h3><p>בחרו מוצר כדי להוסיף אותו למארז.</p><button className="button outline" onClick={close}>המשך לגלוש</button></div>}
    </div></div>;
}

function CartRow({ item, remove, change }) {
  return <div className="cart-row"><ShopImage src={item.image} alt={item.name} /><div className="cart-item-copy"><b>{item.name}</b>
    <small>{item.price != null ? money(item.price) : 'ממתינה להצעת מחיר'}</small>
    {item.note && <small className="muted">{item.note}</small>}{item.description && <small className="muted">{item.description}</small>}
    <div className="quantity small"><button onClick={() => change(-1)} aria-label="הפחתת כמות"><Minus size={12} /></button>
      <b>{item.quantity}</b><button onClick={() => change(1)} aria-label="הגדלת כמות"><Plus size={12} /></button></div>
  </div><div className="cart-row-end"><b>{item.price != null ? money(item.price * item.quantity) : 'לפי הצעת מחיר'}</b>
    <button onClick={remove} aria-label="הסרה"><Trash2 size={15} /></button></div></div>;
}

// Accepts Israeli numbers with or without spaces/dashes and an optional +972/972 prefix.
function isValidPhone(value) {
  const digits = value.trim().replace(/[\s-]/g, '');
  const normalized = digits.startsWith('+972') ? '0' + digits.slice(4)
    : digits.startsWith('972') ? '0' + digits.slice(3)
    : digits;
  return /^0\d{8,9}$/.test(normalized);
}

function Checkout({ cart, setCart }) {
  const location = useLocation();
  const direct = Boolean(location.state?.direct);
  const [items] = useState(() => direct ? location.state?.items || [] : cart);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const total = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const hasUnknownPrice = items.some(item => item.price == null);
  const phoneValid = isValidPhone(phone);
  const formValid = Boolean(items.length) && name.trim() && phoneValid && date;
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!items.length) return setError('אין פריטים להזמנה.');
    if (!name.trim()) return setError('נא למלא שם מלא.');
    if (!phoneValid) return setError('נא למלא מספר טלפון תקין.');
    if (!date) return setError('נא לבחור תאריך נדרש להזמנה.');
    setBusy(true);
    try {
      // Files are uploaded before creating the order; errors must not produce a false confirmation.
      const prepared = await Promise.all(items.map(async item => {
        if (item.type !== 'custom' || !item.file) return item;
        const uploadedImage = await uploadImage(item.file);
        return { ...item, uploadedImage };
      }));
      await placeOrder({ name: name.trim(), phone: phone.trim(), date, items: prepared, type: direct ? 'direct' : 'cart' });
      if (!direct) setCart([]);
      setDone(true);
    } catch (err) {
      setError(err.message || 'שליחת ההזמנה נכשלה. נסו שוב.');
    } finally { setBusy(false); }
  };
  if (done) return <section className="section done-page"><span className="modal-icon"><Check /></span>
    <h1>ההזמנה התקבלה</h1><p>תודה {name}, ההזמנה נשלחה לניהול. ניצור קשר לאישור הפרטים.</p>
    <Link className="button primary" to="/">חזרה לקטגוריות</Link></section>;
  return <section className="section checkout">
    <div className="checkout-title"><h1>סיכום הזמנה</h1></div>
    <form className="checkout-grid" onSubmit={submit}>
      <div className="checkout-form"><h2>פרטי קשר</h2>
        <label className="field-label" htmlFor="name">שם מלא *</label>
        <input id="name" required value={name} onChange={e => setName(e.target.value)} />
        <label className="field-label" htmlFor="phone">טלפון *</label>
        <input id="phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} />
        {phone.trim() && !phoneValid && <small className="error-msg">מספר טלפון לא תקין</small>}
        <label className="field-label" htmlFor="date">תאריך נדרש להזמנה *</label>
        <input id="date" type="date" required value={date} onChange={e => setDate(e.target.value)} />
        {error && <p className="error-msg">{error}</p>}
        <button type="submit" disabled={busy || !formValid} className="button primary full">
          {busy ? 'שולחים…' : 'אישור הזמנה'} <ArrowLeft size={16} />
        </button>
      </div>
      <div className="order-summary"><h2>הפריטים בהזמנה <span>{items.length}</span></h2>
        {items.map((item, index) => <div className="cart-row" key={item.key || index}>
          <ShopImage src={item.image} alt={item.name} />
          <div className="cart-item-copy"><b>{item.name} × {item.quantity}</b>
            {item.description && <small>{item.description}</small>}
            <small>{item.price != null ? money(item.price * item.quantity) : 'מחיר לאחר בירור'}</small>
          </div></div>)}
        {!(hasUnknownPrice && !total) && <div className="summary-total"><span>{hasUnknownPrice ? 'סכום ביניים' : 'מחיר סופי'}</span><b>{money(total)}</b></div>}
      </div>
    </form>
  </section>;
}

function urlBase64ToUint8Array(base64String) {
 const base64 = (base64String + '='.repeat((4 - base64String.length % 4) % 4)).replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from([...atob(base64)].map(c=>c.charCodeAt(0)));
}

async function subscribePush() {
 const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
 if (!vapidKey || !('serviceWorker' in navigator)) return;
 const registration = await navigator.serviceWorker.ready;
 let subscription = await registration.pushManager.getSubscription();
 if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
 const { endpoint, keys } = subscription.toJSON();
 await fetch('/api/push-subscriptions', { method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ endpoint, keys }) });
}

function AdminNotificationPrompt() {
 const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext;
 const [permission,setPermission]=useState(()=>supported ? Notification.permission : 'unsupported');
 const [dismissed,setDismissed]=useState(false);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const sync=()=>setPermission(supported ? Notification.permission : 'unsupported');
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('focus',sync);
  return ()=>{document.removeEventListener('visibilitychange',sync);window.removeEventListener('focus',sync)};
 },[supported]);
 // Re-sync the subscription on every launch: it may have expired, or the service worker may have updated.
 useEffect(()=>{if(supported && permission==='granted')subscribePush().catch(console.error)},[supported,permission]);
 if (permission === 'granted' || dismissed) return null;
 const enable=async()=>{
  if(!supported)return;
  setBusy(true);
  try {
   const result = await Notification.requestPermission();
   setPermission(result);
   if (result === 'granted') await subscribePush();
  }
  catch { setPermission(Notification.permission); }
  finally { setBusy(false); }
 };
 return <div className="admin-notification-prompt" role="region" aria-label="הפעלת התראות">
  <Bell size={24} aria-hidden="true"/>
  <div className="admin-notification-copy">
   <strong>הפעלת התראות</strong>
   <p>{permission==='denied'
     ? 'ההתראות חסומות בדפדפן. כדי לאפשר אותן, היכנסי להגדרות האתר בטלפון ושני את הרשאת ההתראות ל״אפשר״.'
     : permission==='unsupported'
       ? 'הדפדפן אינו מאפשר בקשת התראות כאן. פתחי את האפליקציה המותקנת ממסך הבית.'
       : 'כדי לקבל התראות מהאפליקציה, אשרי את הרשאת ההתראות.'}</p>
  </div>
  <div className="admin-notification-buttons">
   {permission==='default'&&<button type="button" className="button primary" onClick={enable} disabled={busy}>{busy?'מבקשים אישור…':'אישור התראות'}</button>}
   <button type="button" className="button outline" onClick={()=>setDismissed(true)}>אחר כך</button>
  </div>
 </div>;
}

const ORDER_TYPE_TAG = /^סוג הזמנה: ([^—]+?)(?: — |$)/;
const orderTypeOf = order => ORDER_TYPE_TAG.exec((order.items || [])[0]?.note || (order.items || [])[0]?.description || '')?.[1]?.trim() || null;
const stripOrderTypeTag = text => text ? text.replace(ORDER_TYPE_TAG, '') : text;

function Admin({ reload }) {
 const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
 const [error,setError]=useState(''),[orders,setOrders]=useState([]),[products,setProducts]=useState([]);
 const [toast,setToast]=useState(null);
 const notify=message=>setToast({id:Date.now(),message});
 useEffect(()=>{
   if (!toast) return;
   const timer=setTimeout(()=>setToast(null),2800);
   return ()=>clearTimeout(timer);
 },[toast]);
 const [screen,setScreen]=useState('home'),[busy,setBusy]=useState(false),[category,setCategory]=useState('yeast');
 const [form,setForm]=useState({name:'',categoryId:'yeast',price:'',description:'',image:''}),[file,setFile]=useState(null);
 const [coverCategory,setCoverCategory]=useState('yeast'),[coverFile,setCoverFile]=useState(null);
 const [coverPreview,setCoverPreview]=useState('');
 const [productImageBusy,setProductImageBusy]=useState(null);
 const [editingId,setEditingId]=useState(null);
 const startAdd=()=>{setEditingId(null);setForm({name:'',categoryId:'yeast',price:'',description:'',image:''});setFile(null);setScreen('add')};
 const startEdit=p=>{setEditingId(p.id);setForm({name:p.name,categoryId:p.categoryId,price:p.price,description:p.description||'',image:p.image||''});setFile(null);setError('');setScreen('add')};
 useEffect(()=>{
  if(!coverFile){setCoverPreview('');return}
  const url=URL.createObjectURL(coverFile);
  setCoverPreview(url);
  return ()=>URL.revokeObjectURL(url);
 },[coverFile]);
 const refresh=async()=>{
   const [p,o]=await Promise.all([getProducts(),getOrders()]);
   setProducts(p);setOrders(o);await reload();
 };
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 useEffect(()=>{if(screen!=='orders')return;const interval=setInterval(()=>refresh().catch(e=>setError(e.message)),20000);return ()=>clearInterval(interval)},[screen]);
 const removeOrder=async id=>{if(!window.confirm('למחוק את ההזמנה לצמיתות?'))return;try{setError('');await deleteOrder(id);await refresh();notify('ההזמנה נמחקה בהצלחה')}catch(err){setError(err.message)}};
 const save=async e=>{e.preventDefault();setBusy(true);setError('');try{
  if(!file&&!(editingId&&form.image))throw Error('יש לבחור תמונה למוצר');
  const image=file?await uploadImage(file):form.image;
  await saveProduct({...form,description:form.description.trim(),image},editingId||undefined);
  const wasEditing=!!editingId;
  setForm({name:'',categoryId:'yeast',price:'',description:'',image:''});setFile(null);setEditingId(null);await refresh();setScreen(wasEditing?'edit':'home');
  notify(wasEditing?'המוצר עודכן בהצלחה':'המוצר נוסף בהצלחה')
 }catch(err){setError(err.message)}finally{setBusy(false)}};
 const remove=async id=>{if(!window.confirm('למחוק את המוצר?'))return;try{setError('');await disableProduct(id);await refresh();notify('המוצר נמחק בהצלחה')}catch(err){setError(err.message)}};
 const updateCover=async e=>{
  e.preventDefault();
  if(!coverFile)return;
  setBusy(true);setError('');
  try {
   const image=await uploadImage(coverFile);
   await saveCategoryImage(coverCategory,image);
   await reload();
   setCoverFile(null);setScreen('home');
   notify('תמונת הקטגוריה עודכנה בהצלחה');
  } catch(err) {setError(err.message || 'שמירת התמונה נכשלה')}
  finally {setBusy(false)}
 };
 const replaceProductImage=async(product,newFile)=>{
  if(!newFile)return;
  setProductImageBusy(product.id);setError('');
  try {
   const image=await uploadImage(newFile);
   await saveProduct({name:product.name,categoryId:product.categoryId,price:product.price,description:product.description||'',image},product.id);
   await refresh();
   notify('תמונת המוצר עודכנה בהצלחה');
  } catch(err) {setError(err.message || 'עדכון תמונת המוצר נכשל')}
  finally {setProductImageBusy(null)}
 };
 return <section className="admin-page">
 <AdminNotificationPrompt />
 {toast&&<div className="admin-toast" key={toast.id} role="status" aria-live="polite"><Check size={19} aria-hidden="true"/>{toast.message}</div>}
 {screen==='home'&&!installed&&<p className="admin-install-tip">להתקנה בטלפון: באנדרואיד פתחי את תפריט Chrome ובחרי ״התקנת אפליקציה״; באייפון פתחי ב־Safari, לחצי על שיתוף ואז ״הוסף למסך הבית״.</p>}
 {screen!=='home'&&<button className="button outline" onClick={()=>{setScreen(screen==='add'&&editingId?'edit':'home');setEditingId(null);setError('')}}>חזרה</button>}
 {error&&<p className="error-msg">{error}</p>}

 {screen==='home'&&<div className="admin-three-actions">
 {[
  ['הזמנות',ClipboardList,()=>setScreen('orders')],
  ['הוספת מוצר',Plus,startAdd],
  ['עריכת מוצר',Pencil,()=>setScreen('edit')],
  ['מחיקת מוצר',Trash2,()=>setScreen('delete')],
  ['תמונות קטגוריות',ImagePlus,()=>setScreen('covers')],
 ].map(([label,Icon,go])=><button key={label} onClick={go}><span className="admin-action-icon"><Icon size={18} aria-hidden="true"/></span><span className="admin-action-label">{label}</span><ArrowLeft size={16} className="admin-action-arrow" aria-hidden="true"/></button>)}
 </div>}
 {screen==='orders'&&<div><h2>הזמנות</h2>{orders.length===0?<p>אין הזמנות עדיין</p>:orders.map(o=><article key={o.id} className="admin-order">
  <div className="admin-order-head"><h3>{o.customer_name} — {o.phone}</h3>
   <div className="admin-order-actions">
    <button type="button" className="icon-btn" aria-label="מחיקת הזמנה" onClick={()=>removeOrder(o.id)}><Trash2 size={16}/></button>
   </div></div>
  <small>{orderTypeOf(o)&&orderTypeOf(o)+' · '}{o.requested_date?`לתאריך ${new Date(o.requested_date).toLocaleDateString('he-IL')}`:'ללא תאריך מבוקש'}</small>
  <div>{(o.items||[]).map((item,i)=><div key={i} className="admin-order-item"><p>{item.name} × {item.quantity}{stripOrderTypeTag(item.note)&&' — '+stripOrderTypeTag(item.note)}{stripOrderTypeTag(item.description)&&' — '+stripOrderTypeTag(item.description)}</p>{item.image&&<img src={item.image} alt="" className="admin-order-item-img"/>}</div>)}</div>
  {Boolean(o.total) && <b>{o.items?.some(item=>item.custom) ? `סכום ביניים: ${money(o.total)}` : `מחיר סופי: ${money(o.total)}`}</b>}
 </article>)}</div>}
 {screen==='add'&&<form className="admin-product-form" onSubmit={save}><h2>{editingId?'עריכת מוצר':'הוספת מוצר'}</h2>
 <label className="field-label">שם מוצר</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
 <label className="field-label" htmlFor="product-description">פירוט</label>
 <textarea id="product-description" rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
 <label className="field-label">קטגוריה</label><select value={form.categoryId} onChange={e=>setForm({...form,categoryId:e.target.value})}>{categories.filter(c=>c.id!=='custom').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
 <label className="field-label">מחיר</label><input type="number" min="0" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/>
 <label className="field-label" htmlFor="product-image-file">תמונת המוצר</label>
 {editingId&&form.image&&!file&&<img className="admin-edit-current" src={form.image} alt="התמונה הנוכחית"/>}
 <FilePicker id="product-image-file" accept="image/jpeg,image/png,image/webp" required={!editingId} file={file} onChange={e=>setFile(e.target.files?.[0]||null)} placeholder={editingId?'החלפת תמונה (לא חובה)':'בחרו תמונה למוצר'} />
 <button className="button primary" disabled={busy}>{busy?'שומרים…':editingId?'שמירת שינויים':'שמירה'}</button></form>}
 {screen==='edit'&&<div className="admin-edit-list"><h2>עריכת מוצר</h2><label className="field-label">קטגוריה</label><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.filter(c=>c.id!=='custom').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="admin-products">{products.filter(p=>p.categoryId===category).length===0?<p className="empty">עדיין אין מוצרים בקטגוריה הזאת.</p>:products.filter(p=>p.categoryId===category).map(p=><div className="cart-row" key={p.id}><img src={p.image} alt=""/><div className="cart-item-copy"><b>{p.name}</b><small>{money(p.price)}</small>{p.description&&<small className="muted">{p.description}</small>}</div><button className="button outline" onClick={()=>startEdit(p)}>עריכה</button></div>)}</div></div>}
 {screen==='covers'&&<>
 <form className="admin-product-form" onSubmit={updateCover}>
  <h2>תמונות הקטגוריה</h2>
  <label className="field-label" htmlFor="cover-category">בחרי קטגוריה</label>
  <select id="cover-category" value={coverCategory} onChange={e=>{setCoverCategory(e.target.value);setCoverFile(null)}}>
   {categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}
  </select>
  <label className="field-label">תמונה ראשית של הקטגוריה (מוצגת ברשימת הקטגוריות)</label>
  <ShopImage className="admin-category-cover-preview" src={coverPreview || categories.find(category=>category.id===coverCategory)?.image} alt="תמונת הקטגוריה" />
  <label className="field-label" htmlFor="cover-image-file">תמונה ראשית חדשה (JPG, PNG או WebP)</label>
  <FilePicker id="cover-image-file" key={coverCategory} accept="image/jpeg,image/png,image/webp" required file={coverFile} onChange={e=>setCoverFile(e.target.files?.[0]||null)} placeholder="בחרו תמונה ראשית" />
  <button className="button primary" disabled={busy||!coverFile}>{busy?'שומרים…':'שמירת התמונה הראשית'}</button>
 </form>
 {coverCategory!=='custom'&&<div className="admin-product-list admin-category-products">
  <h3>תמונות המוצרים בקטגוריה זו</h3>
  {products.filter(p=>p.categoryId===coverCategory).length===0
   ? <p className="empty">עדיין אין מוצרים בקטגוריה הזאת.</p>
   : products.filter(p=>p.categoryId===coverCategory).map(p=><div className="admin-product" key={p.id}>
      <img src={p.image} alt=""/>
      <div><b>{p.name}</b><small>{money(p.price)}</small></div>
      <label className="button outline admin-inline-upload">
       {productImageBusy===p.id?'מעלה…':'החלפת תמונה'}
       <input type="file" accept="image/jpeg,image/png,image/webp" disabled={productImageBusy===p.id}
        onChange={e=>{const chosen=e.target.files?.[0];e.target.value='';if(chosen)replaceProductImage(p,chosen)}}/>
      </label>
     </div>)}
 </div>}
 </>}
 {screen==='delete'&&<div><h2>מחיקת מוצר</h2><label className="field-label">קטגוריה</label><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.filter(c=>c.id!=='custom').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="admin-products">{products.filter(p=>p.categoryId===category).map(p=><div className="cart-row" key={p.id}><img src={p.image} alt=""/><div className="cart-item-copy"><b>{p.name}</b><small>{money(p.price)}</small></div><button className="button outline" onClick={()=>remove(p.id)}>מחיקה</button></div>)}</div></div>}
 </section>;
}

function Footer() { return null; }

function NotFound() {
  return <section className="section done-page"><span className="modal-icon"><CakeSlice /></span><h1>העמוד לא נמצא</h1><Link to="/" className="button primary">חזרה לבית <ArrowRight /></Link></section>;
}

function Mount() {
  useEffect(() => {
    if (!ADMIN_SITE) return;
    document.title = 'ניהול עוגות';
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = '/manifest.webmanifest';
    document.head.appendChild(manifest);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);
    return () => manifest.remove();
  }, []);
  return <BrowserRouter><App /></BrowserRouter>;
}

createRoot(document.getElementById('root')).render(<Mount />);
