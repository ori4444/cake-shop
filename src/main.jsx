import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CakeSlice, ShoppingBag, ArrowLeft, ArrowRight, Plus, Minus, Trash2, Heart,
  Menu, X, Check, ChevronDown, Bell, Package, ClipboardList, ImagePlus, Upload,
  Clock, LoaderCircle, Pencil, Save, LogOut,
} from 'lucide-react';
import { categories, initialProducts, money } from './data';
import { Account, Client, Databases, ID, Permission, Query, Role, Storage } from 'appwrite';
import './styles.css';

const env = import.meta.env;
const projectId = env.VITE_APPWRITE_PROJECT_ID || '6ae66bb4002feda402cd';
const endpoint = env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const databaseId = env.VITE_APPWRITE_DATABASE_ID;
const productsCollection = env.VITE_APPWRITE_PRODUCTS_COLLECTION || 'products';
const ordersCollection = env.VITE_APPWRITE_ORDERS_COLLECTION || 'orders';
const bucketId = env.VITE_APPWRITE_BUCKET_ID || 'cake-images';
const adminUserId = env.VITE_APPWRITE_ADMIN_USER_ID;
const adminEmail = (env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
const client = new Client().setEndpoint(endpoint).setProject(projectId);
const account = new Account(client);
const db = new Databases(client);
const storage = new Storage(client);

function useShop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      if (!databaseId) throw new Error('VITE_APPWRITE_DATABASE_ID is not configured');
      const result = await db.listDocuments(databaseId, productsCollection, [Query.limit(100)]);
      setProducts(result.documents.filter(p => p.active !== false).map(p => ({ ...p, id: p.$id })));
    } catch (err) {
      console.error(err);
      setError('לא הצלחנו לטעון את המוצרים מ־Appwrite. בדקו את המסד וההרשאות.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);
  return { products, setProducts, loading, error, reload };
}

function App() {
  const shop = useShop();
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cake-cart')) || []; } catch { return []; }
  });
  const [drawer, setDrawer] = useState(false);
  useEffect(() => localStorage.setItem('cake-cart', JSON.stringify(cart, (key, value) => key === 'file' ? undefined : value)), [cart]);

  const addToCart = item => setCart(current => {
    const index = current.findIndex(x => x.productId && x.productId === item.productId && x.note === item.note && x.type === item.type);
    if (index < 0) return [...current, { ...item, key: item.key || ID.unique() }];
    const next = [...current];
    next[index] = { ...next[index], quantity: next[index].quantity + item.quantity };
    return next;
  });

  const removeFromCart = key => setCart(current => current.filter(item => item.key !== key));
  const changeQuantity = (key, delta) => setCart(current => current.map(item =>
    item.key === key ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  return <>
    <Header />
    <main className="main">
      <RoutesView {...shop} cart={cart} setCart={setCart} addToCart={addToCart}
        removeFromCart={removeFromCart} changeQuantity={changeQuantity} />
    </main>
    <Footer />
    {count > 0 && <button className="cart-float" onClick={() => setDrawer(true)} aria-label="פתיחת המארז">
      <ShoppingBag size={20} /><span>המארז שלי</span><b>{count}</b>
    </button>}
    <CartDrawer open={drawer} close={() => setDrawer(false)} cart={cart}
      removeFromCart={removeFromCart} changeQuantity={changeQuantity} />
  </>;
}

function Header() {
  const [menu, setMenu] = useState(false);
  return <header className="header"><div className="header-inner">
    <Link to="/" className="brand"><span className="brand-icon"><CakeSlice size={21} /></span>
      <span><b>פירורים של אהבה</b><small>קונדיטוריה ביתית</small></span></Link>
    <nav className={menu ? 'nav open' : 'nav'}>
      <a href="/#shop" onClick={() => setMenu(false)}>הקטגוריות</a>
      <a href="/#contact" onClick={() => setMenu(false)}>צרו קשר</a>
    </nav>
    <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="תפריט">
      {menu ? <X /> : <Menu />}
    </button>
  </div></header>;
}

function RoutesView(props) {
  const loc = useLocation();
  useEffect(() => window.scrollTo(0, 0), [loc.pathname]);
  if (loc.pathname.startsWith('/admin')) return <Admin {...props} />;
  if (loc.pathname === '/checkout') return <Checkout {...props} />;
  if (loc.pathname === '/custom') return <Custom {...props} />;
  if (loc.pathname.startsWith('/category/')) return <Category {...props} />;
  if (loc.pathname.startsWith('/product/')) return <Product {...props} />;
  return <Home {...props} />;
}

function Home({ error }) {
  return <>
    <section className="hero home-hero"><div className="hero-content">
      <div className="eyebrow"><span /> נאפה באהבה</div>
      <h1>מה מתחשק לכם<br /><em>היום?</em></h1>
      <p>בחרו קטגוריה, מצאו את המתוק שלכם, ואנחנו נכין אותו באהבה.</p>
      <a className="button primary" href="#shop">לכל הקטגוריות <ArrowLeft size={17} /></a>
    </div><div className="hero-photo">
      <img src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1100&q=90" />
      <div className="photo-badge"><Heart size={16} fill="currentColor" /> נאפה במיוחד בשבילך</div>
    </div></section>
    {error && <div className="shop-error">{error}</div>}
    <section className="section categories-section" id="shop">
      <div className="section-heading"><div><div className="eyebrow">הקולקציה שלנו</div>
        <h2>מה בא לכם להזמין?</h2></div></div>
      <div className="category-grid">{categories.map((category, i) => <Link
        to={category.id === 'custom' ? '/custom' : `/category/${category.id}`}
        className={`category-card cat-${i}`} key={category.id}>
        <img src={category.image} loading="lazy" /><div className="category-shade" />
        <div className="category-top"><span>0{i + 1}</span><ArrowLeft size={17} /></div>
        <div className="category-copy"><small>{category.short}</small><h3>{category.name}</h3>
          <span className="category-open">{category.id === 'custom' ? 'לעיצוב אישי' : 'לגלריה'} <ArrowLeft size={14} /></span>
        </div></Link>)}</div>
    </section>
    <section className="contact-section compact-contact" id="contact"><div>
      <div className="eyebrow">צרו קשר</div><h2>צריכים עזרה בהזמנה?</h2>
    </div><a className="button primary" href="https://wa.me/972500000000" target="_blank" rel="noreferrer">דברו איתנו בוואטסאפ</a></section>
  </>;
}

function ProductCard({ product, index = 0 }) {
  return <Link to={`/product/${product.id}`} className="product-card">
    <div className="product-img"><img src={product.image} loading="lazy" />
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
    <div className="breadcrumbs"><Link to="/">בית</Link><span>/</span><b>{category.name}</b></div>
    <div className="listing-head"><div><div className="eyebrow">הקטגוריה שלנו</div>
      <h1>{category.name}</h1><p>{category.short}</p></div>
      <span className="count-note">{items.length} מוצרים</span></div>
    {error ? <p className="error-msg">{error}</p> : loading ? <p className="empty">טוענים מוצרים…</p> :
      items.length ? <div className="product-grid">{items.map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}</div> :
        <p className="empty">עדיין אין מוצרים בקטגוריה הזאת.</p>}
  </section>;
}

function Product({ products, addToCart }) {
  const { id } = useParams();
  const product = products.find(item => item.id === id);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [summary, setSummary] = useState(false);
  const navigate = useNavigate();
  if (!product) return <NotFound />;
  const item = { type: 'product', productId: product.id, name: product.name, image: product.image,
    price: product.price, quantity, note: note.trim() };
  const checkoutNow = () => {
    sessionStorage.setItem('cake-direct-checkout', JSON.stringify([item]));
    navigate('/checkout', { state: { direct: true, items: [item] } });
  };
  return <section className="section detail">
    <div className="breadcrumbs"><Link to="/">בית</Link><span>/</span>
      <Link to={`/category/${product.categoryId}`}>{categories.find(c => c.id === product.categoryId)?.name}</Link>
      <span>/</span><b>{product.name}</b></div>
    <div className="detail-grid"><div className="detail-photo"><img src={product.image} /><span className="product-tag">נאפה טרי</span></div>
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
      onClose={() => setSummary(false)} onAdd={() => { addToCart(item); setSummary(false); }}
      onOrder={checkoutNow} />}
  </section>;
}

function Custom({ addToCart }) {
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [note, setNote] = useState('');
  const [summary, setSummary] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const chooseFile = event => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.size > 8 * 1024 * 1024) { setError('התמונה גדולה מדי. הגודל המרבי הוא 8MB.'); return; }
    setError(''); setFile(selected); setPreview(URL.createObjectURL(selected));
  };
  const item = { type: 'custom', name: 'עוגה בעיצוב אישי', image: preview || categories[5].image,
    description: description.trim(), note: note.trim(), quantity: 1, file };
  const orderNow = () => { sessionStorage.setItem('cake-direct-checkout', JSON.stringify([{ ...item, file: null }]));
    navigate('/checkout', { state: { direct: true, items: [item] } }); };
  return <section className="section detail">
    <div className="breadcrumbs"><Link to="/">בית</Link><span>/</span><b>עוגה בעיצוב אישי</b></div>
    <div className="custom-layout"><div className="custom-banner"><img src={categories[5].image} />
      <div><span>החלום שלכם, בעיצוב שלנו</span><h1>עוגה אישית<br />בעיצוב שלכם</h1></div></div>
      <div className="custom-form"><div className="eyebrow">עוגה בעיצוב אישי</div><h2>מה תרצו שנכין?</h2>
        <p>תארו את העוגה, צרפו תמונה להשראה או מלאו את שניהם.</p>
        <label className="field-label" htmlFor="cake-desc">תיאור העוגה</label>
        <textarea id="cake-desc" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="למשל: עוגת יום הולדת בנושא חלל" rows="4" />
        <label className="field-label">תמונה להמחשה</label>
        <label className="upload-box">{preview ? <img src={preview} /> : <><ImagePlus size={25} /><b>בחירת תמונה</b><small>PNG או JPG, עד 8MB</small></>}
          <input type="file" accept="image/*" onChange={chooseFile} hidden /></label>
        <label className="field-label" htmlFor="custom-note">הערות נוספות</label>
        <textarea id="custom-note" value={note} onChange={e => setNote(e.target.value)} placeholder="אלרגיות או בקשה נוספת" rows="2" />
        <div className="quote-note">העוגה ממתינה להצעת מחיר. ניצור קשר לאחר קבלת הבקשה.</div>
        {error && <p className="error-msg">{error}</p>}
        <button className="button primary full" disabled={!description.trim() && !file} onClick={() => setSummary(true)}>המשך לסיכום <ArrowLeft size={16} /></button>
      </div></div>
    {summary && <SelectionSummary title={item.name} image={item.image}
      details="ממתינה להצעת מחיר" note={`${description}${note ? ` · ${note}` : ''}`}
      onClose={() => setSummary(false)} onAdd={() => { addToCart(item); setSummary(false); }} onOrder={orderNow} />}
  </section>;
}

function SelectionSummary({ title, image, details, note, onClose, onAdd, onOrder }) {
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
    <button className="modal-close" onClick={onClose} aria-label="סגירה"><X /></button>
    <img className="selection-image" src={image} />
    <div className="eyebrow">סיכום בחירה</div><h2>{title}</h2><p>{details}</p>
    {note && <div className="modal-note">{note}</div>}
    <button className="button primary full" onClick={onAdd}>הוסף למארז <ShoppingBag size={16} /></button>
    <button className="button outline full" onClick={onOrder}>הזמן עכשיו <ArrowLeft size={16} /></button>
  </div></div>;
}

function CartDrawer({ open, close, cart, removeFromCart, changeQuantity }) {
  const total = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  return <div className={`drawer-wrap ${open ? 'show' : ''}`} onClick={close}>
    <div className="drawer" onClick={e => e.stopPropagation()}>
      <div className="drawer-head"><div><small>הבחירות שלכם</small><h2>המארז שלי <span>({cart.length})</span></h2></div>
        <button onClick={close} aria-label="סגירה"><X /></button></div>
      {cart.length ? <><div className="drawer-items">{cart.map(item => <CartRow key={item.key} item={item}
        remove={() => removeFromCart(item.key)} change={delta => changeQuantity(item.key, delta)} />)}</div>
        <div className="drawer-total"><span>סך המוצרים המתומחרים</span><b>{money(total)}</b></div>
        {cart.some(item => item.type === 'custom') && <small className="quote-note">המחיר אינו כולל עוגה בעיצוב אישי.</small>}
        <Link className="button primary full" to="/checkout" onClick={close}>בצע הזמנה <ArrowLeft size={16} /></Link>
      </> : <div className="empty-cart"><ShoppingBag size={32} /><h3>המארז ריק</h3><p>בחרו מוצר כדי להוסיף אותו למארז.</p><button className="button outline" onClick={close}>המשך לגלוש</button></div>}
    </div></div>;
}

function CartRow({ item, remove, change }) {
  return <div className="cart-row"><img src={item.image} /><div className="cart-item-copy"><b>{item.name}</b>
    <small>{item.price ? money(item.price) : 'ממתינה להצעת מחיר'}</small>
    {item.note && <small className="muted">{item.note}</small>}{item.description && <small className="muted">{item.description}</small>}
    <div className="quantity small"><button onClick={() => change(-1)} aria-label="הפחתת כמות"><Minus size={12} /></button>
      <b>{item.quantity}</b><button onClick={() => change(1)} aria-label="הגדלת כמות"><Plus size={12} /></button></div>
  </div><div className="cart-row-end"><b>{item.price ? money(item.price * item.quantity) : '—'}</b>
    <button onClick={remove} aria-label="הסרה"><Trash2 size={15} /></button></div></div>;
}

function Checkout({ cart, setCart, changeQuantity, removeFromCart }) {
  const location = useLocation();
  const direct = Boolean(location.state?.direct);
  const [items, setItems] = useState(() => {
    if (location.state?.direct && location.state.items) return location.state.items;
    if (direct) return [];
    try { return JSON.parse(sessionStorage.getItem('cake-direct-checkout') || 'null') || cart; } catch { return cart; }
  });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const total = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

  useEffect(() => {
    if (location.state?.direct && location.state.items) {
      setItems(location.state.items);
      sessionStorage.setItem('cake-direct-checkout', JSON.stringify(location.state.items.map(({ file, ...item }) => item)));
    } else {
      setItems(cart);
      sessionStorage.removeItem('cake-direct-checkout');
    }
  }, [location.state, cart]);

  const setItemQuantity = (item, delta) => {
    if (direct) setItems(current => current.map(x => x.key === item.key ? { ...x, quantity: Math.max(1, x.quantity + delta) } : x));
    else changeQuantity(item.key, delta);
  };
  const removeItem = item => {
    if (direct) setItems(current => current.filter(x => x.key !== item.key));
    else removeFromCart(item.key);
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (!databaseId) return setError('החיבור ל־Appwrite עדיין לא הוגדר.');
    if (!items.length) return setError('אין פריטים להזמנה.');
    if (!name.trim() || phone.replace(/\D/g, '').length < 9) return setError('נא למלא שם מלא ומספר טלפון תקין.');
    setBusy(true);
    try {
      const orderItems = [];
      for (const item of items) {
        let imageId = item.imageId || '';
        if (item.file instanceof File) {
          const uploaded = await storage.createFile(bucketId, ID.unique(), item.file,
            adminUserId ? [Permission.read(Role.user(adminUserId))] : []);
          imageId = uploaded.$id;
        }
        orderItems.push(item.type === 'custom'
          ? { custom: true, name: item.name, description: item.description, note: item.note || '', quantity: item.quantity, imageId }
          : { custom: false, productId: item.productId, name: item.name, note: item.note || '', quantity: item.quantity });
      }
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: name.trim(), phone: phone.trim(), requested_date: date || '', items: orderItems }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'שמירת ההזמנה נכשלה.');
      if (!direct) setCart([]);
      sessionStorage.removeItem('cake-direct-checkout');
      setDone(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'לא הצלחנו לשמור את ההזמנה. נסו שוב.');
    } finally { setBusy(false); }
  };

  if (done) return <section className="section done-page"><span className="modal-icon"><Check /></span>
    <div className="eyebrow">איזה כיף!</div><h1>ההזמנה התקבלה</h1>
    <p>תודה {name}, קיבלנו את הבקשה וניצור קשר לאישור הפרטים.</p><Link className="button primary" to="/">חזרה לאתר <ArrowLeft size={16} /></Link>
  </section>;

  return <section className="section checkout"><div className="breadcrumbs"><Link to="/">בית</Link><span>/</span><b>סיכום הזמנה</b></div>
    <div className="checkout-title"><div className="eyebrow">סיכום הזמנה</div><h1>סוגרים משהו מתוק</h1><p>מלאו פרטים וניצור קשר לאישור.</p></div>
    <form className="checkout-grid" onSubmit={submit}>
      <div className="checkout-form"><h2>פרטי קשר</h2>
        <label className="field-label" htmlFor="name">שם מלא *</label><input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="איך קוראים לכם?" />
        <label className="field-label" htmlFor="phone">מספר טלפון *</label><input id="phone" type="tel" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="050-000-0000" />
        <label className="field-label" htmlFor="date">תאריך מבוקש <small>(לא חובה)</small></label><input id="date" type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={e => setDate(e.target.value)} />
        <div className="privacy-note">לא צריך להירשם כדי להזמין.</div>{error && <div className="error-msg">{error}</div>}
        <button disabled={busy || !items.length} className="button primary full">{busy ? <><LoaderCircle className="spin" size={17} /> שולחים…</> : <>אישור הזמנה <ArrowLeft size={16} /></>}</button>
      </div>
      <div className="order-summary"><h2>הפריטים בהזמנה <span>{items.length}</span></h2>
        {items.length ? items.map(item => <CartRow key={item.key} item={item}
          remove={() => removeItem(item)} change={delta => setItemQuantity(item, delta)} />) : <p className="empty">אין פריטים להזמנה</p>}
        <div className="summary-total"><span>סך המוצרים המתומחרים</span><b>{money(total)}</b></div>
        {items.some(item => item.type === 'custom') && <div className="quote-note">עוגה בעיצוב אישי ממתינה להצעת מחיר.</div>}
        <div className="no-payment">אין תשלום באתר. נתאם את הפרטים מולכם.</div>
      </div>
    </form>
  </section>;
}

function Admin({ products, setProducts, reload }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [subscribed, setSubscribed] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', categoryId: 'yeast', description: '' });
  const [file, setFile] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    account.get().then(current => {
      if (!adminEmail || current.email.toLowerCase() !== adminEmail) throw new Error('This account is not the configured admin');
      if (adminUserId && current.$id !== adminUserId) throw new Error('This account is not authorized');
      setUser(current);
    }).catch(() => setUser(null)).finally(() => setChecking(false));
  }, []);

  const loadOrders = async () => {
    if (!databaseId) { setMsg('Appwrite עדיין לא הוגדר.'); return; }
    try {
      const result = await db.listDocuments(databaseId, ordersCollection, [Query.orderDesc('created_at'), Query.limit(100)]);
      setOrders(result.documents.map(doc => ({ ...doc, id: doc.$id, items: JSON.parse(doc.items_json || '[]') })));
    } catch (err) { console.error(err); setMsg('לא ניתן לטעון הזמנות מ־Appwrite. בדקו הרשאות.'); }
  };

  useEffect(() => { if (user) loadOrders(); }, [user]);

  const login = async event => {
    event.preventDefault(); setLoginError(''); setBusy(true);
    try {
      if (!databaseId || !adminEmail || !adminUserId) throw new Error('יש להגדיר ב־Vercel את VITE_APPWRITE_DATABASE_ID, VITE_APPWRITE_ADMIN_USER_ID ואת VITE_ADMIN_EMAIL.');
      if (email.trim().toLowerCase() !== adminEmail) throw new Error('כתובת האימייל אינה מורשית לניהול.');
      await account.createEmailPasswordSession(email.trim(), password);
      const current = await account.get();
      if (current.$id !== adminUserId || current.email.toLowerCase() !== adminEmail) {
        await account.deleteSession('current'); throw new Error('המשתמש אינו מורשה לניהול.');
      }
      setUser(current);
      const existing = await db.listDocuments(databaseId, productsCollection, [Query.limit(1)]);
      if (existing.total === 0) {
        for (const product of initialProducts) await db.createDocument(databaseId, productsCollection, product.id,
          { name: product.name, categoryId: product.categoryId, description: product.description,
            image: product.image, price: product.price, active: true },
          [Permission.read(Role.any()), Permission.update(Role.user(current.$id)), Permission.delete(Role.user(current.$id))]);
        await reload();
      }
    } catch (err) { console.error(err); setLoginError(err.message || 'ההתחברות נכשלה.'); }
    finally { setBusy(false); }
  };

  const updateOrder = async (order, status) => {
    try {
      await db.updateDocument(databaseId, ordersCollection, order.id, { status });
      setOrders(current => current.map(item => item.id === order.id ? { ...item, status } : item));
    } catch (err) { console.error(err); setMsg('עדכון הסטטוס נכשל.'); }
  };

  const saveProduct = async event => {
    event.preventDefault(); setMsg(''); setBusy(true);
    try {
      if (!databaseId || !user) throw new Error('נדרשת התחברות ל־Appwrite.');
      let image = edit?.image || '';
      if (file) {
        const uploaded = await storage.createFile(bucketId, ID.unique(), file,
          [Permission.read(Role.any()), Permission.update(Role.user(user.$id)), Permission.delete(Role.user(user.$id))]);
        image = storage.getFileView(bucketId, uploaded.$id).toString();
      }
      const data = { name: form.name.trim(), price: Number(form.price), categoryId: form.categoryId,
        description: form.description.trim(), image, active: true };
      if (edit) {
        await db.updateDocument(databaseId, productsCollection, edit.id, data);
        setProducts(current => current.map(product => product.id === edit.id ? { ...product, ...data } : product));
        setMsg('המוצר עודכן.');
      } else {
        const id = ID.unique();
        const created = await db.createDocument(databaseId, productsCollection, id, data,
          [Permission.read(Role.any()), Permission.update(Role.user(user.$id)), Permission.delete(Role.user(user.$id))]);
        setProducts(current => [...current, { ...data, id: created.$id }]);
        setMsg('המוצר נוסף.');
      }
      setForm({ name: '', price: '', categoryId: 'yeast', description: '' }); setFile(null); setEdit(null);
    } catch (err) { console.error(err); setMsg(err.message || 'שמירת המוצר נכשלה.'); }
    finally { setBusy(false); }
  };

  const removeProduct = async product => {
    if (!confirm(`להסיר את ${product.name} מהקטלוג?`)) return;
    try {
      await db.updateDocument(databaseId, productsCollection, product.id, { active: false });
      setProducts(current => current.filter(item => item.id !== product.id));
      setMsg('המוצר הוסר מהקטלוג.');
    } catch (err) { console.error(err); setMsg('מחיקת המוצר נכשלה.'); }
  };

  const subscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setMsg('הדפדפן אינו תומך בהתראות Push.'); return; }
    if (!env.VITE_VAPID_PUBLIC_KEY) { setMsg('חסר מפתח Push ב־Vercel.'); return; }
    try {
      const nextPermission = await Notification.requestPermission(); setPermission(nextPermission);
      if (nextPermission !== 'granted') return;
      const registration = await navigator.serviceWorker.ready;
      const base64 = env.VITE_VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/');
      const key = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const jwt = await account.createJWT();
      const response = await fetch('/api/push-subscriptions', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt.jwt}` },
        body: JSON.stringify(subscription) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'רישום ההתראות נכשל.');
      setSubscribed(true); setMsg('המכשיר נרשם לקבלת התראות.');
    } catch (err) { console.error(err); setMsg(err.message || 'לא הצלחנו להפעיל התראות.'); }
  };

  if (checking) return <section className="admin-page"><p className="empty">בודקים הרשאת ניהול…</p></section>;
  if (!user) return <section className="admin-page admin-login-page"><div className="admin-login">
    <Link to="/" className="brand"><span className="brand-icon"><CakeSlice size={20} /></span>
      <span><b>פירורים של אהבה</b><small>כניסה לניהול</small></span></Link>
    <h1>כניסה למנהלת</h1><p>התחברו עם חשבון Appwrite שהוגדר לניהול.</p>
    <form onSubmit={login}><label className="field-label" htmlFor="admin-email">אימייל</label>
      <input id="admin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      <label className="field-label" htmlFor="admin-password">סיסמה</label>
      <input id="admin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      {loginError && <div className="error-msg">{loginError}</div>}
      <button className="button primary full" disabled={busy}>{busy ? 'מתחברים…' : 'התחברות'}</button>
    </form></div></section>;

  const latest = orders.filter(order => order.status === 'new').length;
  const sales = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const signOut = async () => { await account.deleteSession('current'); setUser(null); };

  return <section className="admin-page"><div className="admin-top">
    <Link className="brand" to="/"><span className="brand-icon"><CakeSlice size={20} /></span>
      <span><b>פירורים של אהבה</b><small>מרכז ניהול</small></span></Link>
    <button className="admin-signout" onClick={signOut}><LogOut size={15} /> יציאה</button>
  </div><div className="admin-welcome"><div><div className="eyebrow">ניהול החנות</div>
    <h1>הזמנות ומוצרים</h1></div><button className="icon-btn" onClick={subscribe} aria-label="הפעלת התראות"><Bell size={19} /></button></div>
    <div className="admin-stats"><div><span>הזמנות חדשות</span><b>{latest}</b></div>
      <div><span>כל ההזמנות</span><b>{orders.length}</b></div><div><span>סך הזמנות</span><b>{money(sales)}</b></div></div>
    <div className="admin-tabs"><button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ClipboardList size={16} /> הזמנות <span>{latest}</span></button>
      <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}><Package size={16} /> מוצרים</button>
      <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Bell size={16} /> התראות</button></div>
    {msg && <div className="admin-message" onClick={() => setMsg('')}>{msg}<X size={15} /></div>}
    {tab === 'orders' ? <div className="admin-panel"><div className="panel-heading"><div><h2>הזמנות</h2><p>מהחדשה ביותר לישנה ביותר</p></div>
      <button className="refresh-btn" onClick={loadOrders}>רענון <ArrowLeft size={14} /></button></div>
      {orders.length ? orders.map(order => <AdminOrder key={order.id} order={order} update={updateOrder} />) :
        <div className="admin-empty"><span><ShoppingBag /></span><h3>אין הזמנות עדיין</h3></div>}</div>
      : tab === 'products' ? <div className="admin-panel"><div className="panel-heading"><div><h2>{edit ? 'עריכת מוצר' : 'הוספת מוצר'}</h2></div></div>
        <form className="admin-product-form" onSubmit={saveProduct}>
          <label>שם המוצר<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label>מחיר בשקלים<input required type="number" min="1" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label>
          <label>קטגוריה<select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>{categories.filter(c => c.id !== 'custom').map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <label>תיאור<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows="2" /></label>
          <label className="admin-file"><Upload size={16} />{file?.name || 'בחירת תמונה'}<input type="file" accept="image/*" required={!edit} onChange={e => setFile(e.target.files?.[0])} /></label>
          <button className="button primary" disabled={busy}>{edit ? <><Save size={16} /> שמירה</> : <><Plus size={16} /> הוספה</>}</button>
          {edit && <button type="button" className="button outline" onClick={() => { setEdit(null); setFile(null); setForm({ name: '', price: '', categoryId: 'yeast', description: '' }); }}>ביטול</button>}
        </form><div className="admin-product-list"><h3>מוצרים <small>{products.length}</small></h3>
          {products.map(product => <div className="admin-product" key={product.id}><img src={product.image} /><div><b>{product.name}</b><small>{money(product.price)}</small></div>
            <button onClick={() => { setEdit(product); setFile(null); setForm({ name: product.name, price: product.price, categoryId: product.categoryId, description: product.description || '' }); }} aria-label="עריכת מוצר"><Pencil size={16} /></button>
            <button onClick={() => removeProduct(product)} aria-label="מחיקת מוצר"><Trash2 size={16} /></button></div>)}</div></div>
        : <div className="admin-panel settings-panel"><div className="panel-heading"><div><h2>התראות Push</h2><p>{subscribed ? 'המכשיר רשום להתראות.' : 'קבלת התראה על כל הזמנה חדשה.'}</p></div></div>
          <button className="button outline" onClick={subscribe}>{permission === 'granted' ? 'רישום המכשיר להתראות' : 'הפעלת התראות'}</button>
          <div className="setting-row"><div className="setting-icon"><Package /></div><div><b>התקנה בטלפון</b><p>פתחו את תפריט הדפדפן ובחרו ״הוספה למסך הבית״.</p></div></div>
        </div>}
    <div className="admin-bottom"><span>פירורים של אהבה</span><Link to="/">חזרה לחנות</Link></div>
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

function Footer() {
  return <footer className="footer"><div className="footer-inner"><Link to="/" className="brand">
    <span className="brand-icon"><CakeSlice size={19} /></span><span><b>פירורים של אהבה</b><small>קונדיטוריה ביתית</small></span></Link>
    <span className="footer-copy">נאפה באהבה</span><div className="footer-links"><Link to="/admin">ניהול</Link></div>
  </div></footer>;
}

function NotFound() {
  return <section className="section done-page"><span className="modal-icon"><CakeSlice /></span><h1>העמוד לא נמצא</h1><Link to="/" className="button primary">חזרה לבית <ArrowRight /></Link></section>;
}

function Mount() {
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error); }, []);
  return <BrowserRouter><App /></BrowserRouter>;
}

createRoot(document.getElementById('root')).render(<Mount />);
