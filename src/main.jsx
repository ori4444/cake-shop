import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CakeSlice, ShoppingBag, ArrowLeft, ArrowRight, Plus, Minus, Trash2, Heart,
  Menu, X, Check, ChevronDown, Bell, Package, ClipboardList, ImagePlus, Upload,
  Clock, LoaderCircle, Pencil, Save, LogOut,
} from 'lucide-react';
import { categories, customCakeImages, initialProducts, money } from './data';
import { configured, getProducts, authUser, signIn, signUp, signOut, isAdmin, getOrders, changeOrder, saveProduct, disableProduct, uploadImage, placeOrder } from './supabase';
import './styles.css';

// Each Vercel project builds a distinct public customer site or installable admin app.
const ADMIN_SITE = import.meta.env.VITE_SITE_ROLE === 'admin';

function useShop() {
 const [products,setProducts]=useState(initialProducts);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const reload=async()=>{setLoading(true);setError('');try{setProducts(await getProducts())}catch(e){setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{reload()},[]);
 return {products,setProducts,loading,error,reload};
}

function App() {
  const shop = useShop();
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cake-cart')) || []; } catch { return []; }
  });
  const [drawer, setDrawer] = useState(false);
  useEffect(() => localStorage.setItem('cake-cart', JSON.stringify(cart, (key, value) => key === 'file' ? undefined : value)), [cart]);

  const addToCart = item => setCart(current => {
    const index = current.findIndex(x => x.type !== 'custom' && x.productId && x.productId === item.productId && x.note === item.note && x.type === item.type);
    if (index < 0) return [...current, { ...item, key: item.key || crypto.randomUUID() }];
    const next = [...current];
    next[index] = { ...next[index], quantity: next[index].quantity + item.quantity };
    return next;
  });

  const removeFromCart = key => setCart(current => current.filter(item => item.key !== key));
  const changeQuantity = (key, delta) => setCart(current => current.map(item =>
    item.key === key ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  return <>
    
    <main className="main">
      {!ADMIN_SITE && <CustomerBack />}
      <RoutesView {...shop} cart={cart} setCart={setCart} addToCart={addToCart}
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
  useEffect(() => window.scrollTo(0, 0), [location.pathname]);
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
function CustomerBack() {
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
      // Use the category from the current URL history when available;
      // otherwise the home page is always a safe destination.
      const product = initialProducts.find(item => item.id === productId);
      if (product) navigate(`/category/${product.categoryId}`);
      else navigate('/');
      return;
    }
    navigate('/');
  };
  return <nav className="customer-back-nav" aria-label="ניווט חזרה">
    <button type="button" onClick={back}><ArrowRight size={18} /> חזרה אחורה</button>
    <Link to="/">כל הקטגוריות</Link>
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

function ProductCard({ product, index = 0 }) {
  return <Link to={`/product/${product.id}`} className="product-card">
    <div className="product-img"><ShopImage src={product.image} fallback={categories.find(c => c.id === product.categoryId)?.image} alt={product.name} loading="lazy" />
      <span className="product-tag">נאפה טרי</span><span className="product-arrow"><ArrowLeft size={17} /></span></div>
    <div className="product-info"><div><h3>{product.name}</h3><p>{product.description}</p></div>
      <b>{money(product.price)}</b></div>
  </Link>;
}

function Category({ products, loading, error }) {
  const { id } = useParams();
  const category = categories.find(item => item.id === id);
  const items = products.filter(product => product.categoryId === id && product.active !== false);
  if (!category) return <NotFound />;
  return <section className="section listing">
    <div className="breadcrumbs"><Link to="/">← חזרה לכל הקטגוריות</Link><span>/</span><b>{category.name}</b></div>
    <div className="listing-head"><h1>{category.name}</h1></div>
    {items.length ? <div className="product-grid">{items.map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}</div> :
      loading ? <p className="empty">טוענים מוצרים…</p> :
      error ? <p className="error-msg">{error}</p> :
        <p className="empty">עדיין אין מוצרים בקטגוריה הזאת.</p>}
    <CategoryGallery categoryId={id} />
  </section>;
}

function CategoryGallery({ categoryId }) {
  const category = categories.find(item => item.id === categoryId);
  const images = initialProducts.filter(product => product.categoryId === categoryId).slice(0, 4);
  if (!category || !images.length) return null;
  return <div className="category-gallery-section">
    <h2>עוד תמונות של {category.name}</h2>
    <div className="category-photo-grid">
      {images.map(product => <Link to={`/product/${product.id}`} key={product.id} aria-label={product.name}>
        <ShopImage src={product.image} fallback={category.image} alt={product.name} loading="lazy" />
      </Link>)}
    </div>
  </div>;
}

function Product({ products, loading, addToCart }) {
  const { id } = useParams();
  const product = products.find(item => item.id === id);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [summary, setSummary] = useState(false);
  const navigate = useNavigate();
  if (!product) return loading ? <p className="empty section">טוענים מוצר…</p> : <NotFound />;
  const item = { type: 'product', productId: product.id, name: product.name, image: product.image,
    price: product.price, quantity, note: note.trim() };
  const checkoutNow = () => navigate('/checkout', { state: { direct: true, items: [item] } });
  return <section className="section detail">
    <div className="breadcrumbs"><Link to="/">חזרה לכל הקטגוריות</Link><span>/</span>
      <Link to={`/category/${product.categoryId}`}>← חזרה לקטגוריה</Link>
      <span>/</span><b>{product.name}</b></div>
    <div className="detail-grid"><div className="detail-photo"><ShopImage src={product.image} fallback={categories.find(c => c.id === product.categoryId)?.image} alt={product.name} /><span className="product-tag">נאפה טרי</span></div>
      <div className="detail-copy"><div className="eyebrow">הבחירה שלכם</div><h1>{product.name}</h1>
        <p>{product.description}</p><div className="detail-price">{money(product.price)} <small>ליחידה</small></div>
        <label className="field-label">כמות</label><div className="quantity">
          <button type="button" onClick={() => setQuantity(n => Math.max(1, n - 1))}><Minus size={15} /></button>
          <b>{quantity}</b><button type="button" onClick={() => setQuantity(n => n + 1)}><Plus size={15} /></button>
        </div>
        <label className="field-label" htmlFor="product-note">הערות למוצר</label>
        <textarea id="product-note" value={note} onChange={e => setNote(e.target.value)} placeholder="הקדשה או בקשה מיוחדת" rows="3" />
        <button className="button primary full" onClick={() => setSummary(true)}>המשך לסיכום <ArrowLeft size={16} /></button>
      </div></div>
    {summary && <SelectionSummary title={product.name} image={product.image}
      details={`${quantity} יחידות · ${money(product.price * quantity)}`} note={note}
      onClose={() => setSummary(false)} onAdd={() => { addToCart(item); setSummary(false); navigate('/'); }}
      onOrder={checkoutNow} />}
  </section>;
}

function Custom({ addToCart }) {
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [requestedAt, setRequestedAt] = useState('');
  const [summary, setSummary] = useState(false);
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
    requestedAt, quantity: 1, file };
  const checkoutNow = () => navigate('/checkout', { state: { direct: true, items: [item] } });
  const addCustomToCart = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      const uploadedImage = file ? await uploadImage(file) : '';
      addToCart({ ...item, file: null, uploadedImage, image: uploadedImage || item.image });
      setSummary(false);
      navigate('/');
    } catch(err) { setError(err.message || 'העלאת התמונה נכשלה.'); setSummary(false); }
    finally { setSaving(false); }
  };
  return <section className="section custom-simple">
    <h1>הזמנה אישית</h1>
    <p>כתבו מה להכין, אפשר גם לצרף תמונה לדוגמה.</p>
    <label className="field-label" htmlFor="custom-description">שם / קישור / תיאור ההזמנה</label>
    <textarea id="custom-description" rows="4" maxLength="1000" value={description} onChange={e => setDescription(e.target.value)}
      placeholder="שם העוגה, קישור לדוגמה או תיאור חופשי" />
    <label className="field-label" htmlFor="custom-file">תמונה להמחשה (לא חובה)</label>
    <input id="custom-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} />
    {preview && <img className="custom-preview" src={preview} alt="תמונת ההשראה שצירפת" />}
    <label className="field-label" htmlFor="custom-date">מתי צריך את ההזמנה? (לא חובה)</label>
    <input id="custom-date" type="datetime-local" value={requestedAt} onChange={e => setRequestedAt(e.target.value)} />
    <p className="quote-note">מחיר להזמנה אישית ייקבע לאחר בדיקת הבקשה.</p>
    {error && <p className="error-msg">{error}</p>}
    <button className="button primary full" disabled={!description.trim() && !file} onClick={() => setSummary(true)}>
      המשך לסיכום <ArrowLeft size={16} />
    </button>
    {summary && <SelectionSummary title="הזמנה אישית" image={item.image}
      details={requestedAt ? `לתאריך ${new Date(requestedAt).toLocaleString('he-IL')}` : 'ממתינה להצעת מחיר'}
      note={description} onClose={() => setSummary(false)}
      onAdd={addCustomToCart} onOrder={checkoutNow} busy={saving} />}
  </section>;
}

function SelectionSummary({ title, image, details, note, onClose, onAdd, onOrder, busy = false }) {
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
    <button className="modal-close" onClick={onClose} aria-label="סגירה"><X /></button>
    <ShopImage className="selection-image" src={image} fallback={categories[5].image} alt={title} />
    <div className="eyebrow">סיכום בחירה</div><h2>{title}</h2><p>{details}</p>
    {note && <div className="modal-note">{note}</div>}
    <button className="button primary full" disabled={busy} onClick={onAdd}>{busy ? 'מוסיפים…' : 'הוסף למארז'} <ShoppingBag size={16} /></button>
    <button className="button outline full" disabled={busy} onClick={onOrder}>שלח הזמנה <ArrowLeft size={16} /></button>
  </div></div>;
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
        <div className="drawer-total"><span>{hasUnknownPrice ? "סכום ביניים (ללא הזמנות אישיות)" : "מחיר סופי"}</span><b>{money(total)}</b></div>
        {hasUnknownPrice && <small className="quote-note">מחיר ההזמנה האישית ייקבע לאחר בדיקה.</small>}
        <Link className="button primary full" to="/checkout" onClick={close}>אישור הזמנת המארז <ArrowLeft size={16} /></Link>
      </> : <div className="empty-cart"><ShoppingBag size={32} /><h3>המארז ריק</h3><p>בחרו מוצר כדי להוסיף אותו למארז.</p><button className="button outline" onClick={close}>המשך לגלוש</button></div>}
    </div></div>;
}

function CartRow({ item, remove, change }) {
  return <div className="cart-row"><ShopImage src={item.image} alt={item.name} /><div className="cart-item-copy"><b>{item.name}</b>
    <small>{item.price != null ? money(item.price) : 'ממתינה להצעת מחיר'}</small>
    {item.requestedAt && <small className="muted">צריך ל־{new Date(item.requestedAt).toLocaleString('he-IL')}</small>}{item.note && <small className="muted">{item.note}</small>}{item.description && <small className="muted">{item.description}</small>}
    <div className="quantity small"><button onClick={() => change(-1)} aria-label="הפחתת כמות"><Minus size={12} /></button>
      <b>{item.quantity}</b><button onClick={() => change(1)} aria-label="הגדלת כמות"><Plus size={12} /></button></div>
  </div><div className="cart-row-end"><b>{item.price != null ? money(item.price * item.quantity) : 'לפי הצעת מחיר'}</b>
    <button onClick={remove} aria-label="הסרה"><Trash2 size={15} /></button></div></div>;
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
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!items.length) return setError('אין פריטים להזמנה.');
    if (!name.trim() || phone.replace(/\D/g, '').length < 9) return setError('נא למלא שם וטלפון תקין.');
    setBusy(true);
    try {
      // Files are uploaded before creating the order; errors must not produce a false confirmation.
      const prepared = await Promise.all(items.map(async item => {
        if (item.type !== 'custom' || !item.file) return item;
        const uploadedImage = await uploadImage(item.file);
        return { ...item, uploadedImage };
      }));
      await placeOrder({ name: name.trim(), phone: phone.trim(), date, items: prepared });
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
    <div className="checkout-title"><h1>סיכום הזמנה</h1><p>אישור ההזמנה שולח אותה לניהול.</p></div>
    <form className="checkout-grid" onSubmit={submit}>
      <div className="checkout-form"><h2>פרטי קשר</h2>
        <label className="field-label" htmlFor="name">שם מלא *</label>
        <input id="name" required value={name} onChange={e => setName(e.target.value)} />
        <label className="field-label" htmlFor="phone">טלפון *</label>
        <input id="phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} />
        <label className="field-label" htmlFor="date">מועד להזמנה כולה (לא חובה)</label>
        <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        {error && <p className="error-msg">{error}</p>}
        <button type="submit" disabled={busy || !items.length} className="button primary full">
          {busy ? 'שולחים…' : 'אישור ושליחת הזמנה'} <ArrowLeft size={16} />
        </button>
      </div>
      <div className="order-summary"><h2>הפריטים בהזמנה <span>{items.length}</span></h2>
        {items.map((item, index) => <div className="cart-row" key={item.key || index}>
          <ShopImage src={item.image} alt={item.name} />
          <div className="cart-item-copy"><b>{item.name} × {item.quantity}</b>
            {item.description && <small>{item.description}</small>}
            {item.requestedAt && <small>צריך ל־{new Date(item.requestedAt).toLocaleString('he-IL')}</small>}
            <small>{item.price != null ? money(item.price * item.quantity) : 'מחיר לאחר בירור'}</small>
          </div></div>)}
        <div className="summary-total"><span>{hasUnknownPrice ? 'סכום ביניים' : 'מחיר סופי'}</span><b>{money(total)}</b></div>
        {hasUnknownPrice && <p className="quote-note">הסכום אינו כולל הזמנות אישיות שעדיין לא תומחרו.</p>}
        <p className="no-payment">אין חיוב באתר. אישור פרטי ההזמנה יתבצע מול העסק.</p>
      </div>
    </form>
  </section>;
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
 if (permission === 'granted' || dismissed) return null;
 const enable=async()=>{
  if(!supported)return;
  setBusy(true);
  try { setPermission(await Notification.requestPermission()); }
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
 const [form,setForm]=useState({name:'',categoryId:'yeast',price:'',image:''}),[file,setFile]=useState(null);
 const lastOrderRef = React.useRef(null);
 const refresh=async()=>{
   const [p,o]=await Promise.all([getProducts(),getOrders()]);
   if(lastOrderRef.current && o.length && o[0].id !== lastOrderRef.current && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('התקבלה הזמנה חדשה', {body: `${o[0].customer_name} שלח/ה הזמנה`});
   }
   if(o.length)lastOrderRef.current=o[0].id;
   setProducts(p);setOrders(o);await reload();
 };
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 useEffect(()=>{if(screen!=='orders')return;const interval=setInterval(()=>refresh().catch(e=>setError(e.message)),20000);return ()=>clearInterval(interval)},[screen]);
 const change=async(id,status)=>{try{setError('');await changeOrder(id,status);await refresh();notify('סטטוס ההזמנה עודכן בהצלחה')}catch(err){setError(err.message)}};
 const save=async e=>{e.preventDefault();setBusy(true);setError('');try{if(!file)throw Error('יש לבחור תמונה למוצר');const image=await uploadImage(file);notify('התמונה עלתה בהצלחה');await saveProduct({...form,description:'',image});setForm({name:'',categoryId:'yeast',price:'',image:''});setFile(null);await refresh();setScreen('home');notify('המוצר נוסף בהצלחה')}catch(err){setError(err.message)}finally{setBusy(false)}};
 const remove=async id=>{if(!window.confirm('למחוק את המוצר?'))return;try{setError('');await disableProduct(id);await refresh();notify('המוצר נמחק בהצלחה')}catch(err){setError(err.message)}};
 return <section className="admin-page">
 <AdminNotificationPrompt />
 {toast&&<div className="admin-toast" key={toast.id} role="status" aria-live="polite"><Check size={19} aria-hidden="true"/>{toast.message}</div>}
 {screen==='home'&&!installed&&<p className="admin-install-tip">להתקנה בטלפון: באנדרואיד פתחי את תפריט Chrome ובחרי ״התקנת אפליקציה״; באייפון פתחי ב־Safari, לחצי על שיתוף ואז ״הוסף למסך הבית״.</p>}
 {screen!=='home'&&<button className="button outline" onClick={()=>{setScreen('home');setError('')}}>חזרה</button>}
 {error&&<p className="error-msg">{error}</p>}

 {screen==='home'&&<div className="admin-three-actions">
 <button onClick={()=>setScreen('orders')}>הזמנות</button>
 <button onClick={()=>setScreen('add')}>הוספת מוצר</button>
 <button onClick={()=>setScreen('delete')}>מחיקת מוצר</button>
 </div>}
 {screen==='orders'&&<div><h2>הזמנות</h2>{orders.length===0?<p>אין הזמנות עדיין</p>:orders.map(o=><article key={o.id} className="admin-order"><h3>{o.customer_name} — {o.phone}</h3><small>{new Date(o.created_at).toLocaleDateString('he-IL')} · {o.requested_date||'ללא תאריך מבוקש'}</small><div>{(o.items||[]).map((item,i)=><p key={i}>{item.name} × {item.quantity}{item.note&&' — '+item.note}{item.description&&' — '+item.description}{item.image&&<a href={item.image} target="_blank" rel="noreferrer"> · תמונה מצורפת</a>}</p>)}</div><b>{o.items?.some(item=>item.custom) ? `סכום ביניים: ${money(o.total)}` : `מחיר סופי: ${money(o.total)}`}</b><select value={o.status} onChange={e=>change(o.id,e.target.value)}><option value="new">חדשה</option><option value="confirmed">אושרה</option><option value="preparing">בהכנה</option><option value="completed">הושלמה</option><option value="cancelled">בוטלה</option></select></article>)}</div>}
 {screen==='add'&&<form className="admin-product-form" onSubmit={save}><h2>הוספת מוצר</h2>
 <label className="field-label">שם מוצר</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
 <label className="field-label">קטגוריה</label><select value={form.categoryId} onChange={e=>setForm({...form,categoryId:e.target.value})}>{categories.filter(c=>c.id!=='custom').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
 <label className="field-label">מחיר</label><input type="number" min="0" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/>
 <input aria-label="בחירת קובץ" type="file" accept="image/jpeg,image/png,image/webp" required onChange={e=>setFile(e.target.files?.[0]||null)}/>
 <button className="button primary" disabled={busy}>שמירה</button></form>}
 {screen==='delete'&&<div><h2>מחיקת מוצר</h2><label className="field-label">קטגוריה</label><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.filter(c=>c.id!=='custom').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="admin-products">{products.filter(p=>p.categoryId===category).map(p=><div className="cart-row" key={p.id}><img src={p.image} alt=""/><div className="cart-item-copy"><b>{p.name}</b><small>{money(p.price)}</small></div><button className="button outline" onClick={()=>remove(p.id)}>מחיקה</button></div>)}</div></div>}
 </section>;
}

function AdminOrder({ order, update }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(order.created_at || order.$createdAt).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' });
  const items = Array.isArray(order.items) ? order.items : [];
  return <article className="order-card"><button className="order-head" onClick={() => setExpanded(!expanded)}>
    <div className="order-avatar">{order.customer_name?.slice(0, 1) || '?'}</div>
    <div className="order-customer"><b>{order.customer_name}</b><a href={`https://wa.me/${(order.phone || '').replace(/\D/g, '')}`} onClick={e => e.stopPropagation()} target="_blank" rel="noreferrer" dir="ltr">{order.phone}</a><small><Clock size={12} />{date}</small></div>
    <div className="order-meta"><b>{money(order.total || 0)}</b><small>{order.requested_date ? `לתאריך ${new Date(order.requested_date).toLocaleDateString('he-IL')}` : 'תאריך גמיש'}</small></div>
    <span className={`status status-${order.status || 'new'}`}>{({ new: 'חדשה', in_progress: 'בטיפול', completed: 'הושלמה' })[order.status || 'new']}</span>
    <ChevronDown size={17} className={expanded ? 'turned' : ''} />
  </button>{order.has_custom && <div className="custom-flag">עוגה בעיצוב אישי — נדרשת הצעת מחיר</div>}
    {expanded && <div className="order-details">{items.map((item, index) => <div className="order-item" key={index}>
      {item.image && <img src={item.image} />}{item.imageId && <img src={storage.getFileView(bucketId, item.imageId).toString()} />}
      <div><b>{item.name} {item.custom && <small className="custom-label">עיצוב אישי</small>}</b>
        <small>{item.quantity} יח׳ · {item.unit_price ? money(item.unit_price) : 'ממתינה להצעת מחיר'}</small>
        {item.description && <p>{item.description}</p>}{item.note && <p>הערה: {item.note}</p>}</div></div>)}
      <div className="order-status-buttons"><span>עדכון סטטוס</span>
        <button className={order.status === 'new' ? 'selected' : ''} onClick={() => update(order, 'new')}>חדשה</button>
        <button className={order.status === 'in_progress' ? 'selected' : ''} onClick={() => update(order, 'in_progress')}>בטיפול</button>
        <button className={order.status === 'completed' ? 'selected' : ''} onClick={() => update(order, 'completed')}>הושלמה</button></div>
    </div>}</article>;
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
