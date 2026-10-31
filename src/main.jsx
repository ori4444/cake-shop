import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CakeSlice, ShoppingBag, ArrowLeft, ArrowRight, Plus, Minus, Trash2, Heart,
  Menu, X, Check, ChevronDown, Bell, Package, ClipboardList, ImagePlus, Upload,
  Clock, LoaderCircle, Pencil, Save, LogOut,
} from 'lucide-react';
import { categories, initialProducts, money } from './data';
import { configured, getProducts, authUser, signIn, signOut, isAdmin, getOrders, changeOrder, saveProduct, disableProduct, uploadImage, placeOrder } from './supabase';
import './styles.css';

function useShop() {
 const [products,setProducts]=useState([]);
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
    const index = current.findIndex(x => x.productId && x.productId === item.productId && x.note === item.note && x.type === item.type);
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
      <RoutesView {...shop} cart={cart} setCart={setCart} addToCart={addToCart}
        removeFromCart={removeFromCart} changeQuantity={changeQuantity} />
    </main>
    {!window.location.pathname.startsWith("/admin") && <Footer />}
    {count > 0 && <button className="cart-float" onClick={() => setDrawer(true)} aria-label="פתיחת המארז">
      <ShoppingBag size={20} /><span>המארז שלי</span><b>{count}</b>
    </button>}
    <CartDrawer open={drawer} close={() => setDrawer(false)} cart={cart}
      removeFromCart={removeFromCart} changeQuantity={changeQuantity} />
  </>;
}

function Header() {
  return <header className="header"><div className="header-inner">
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
  return <section className="section categories-section home-categories" id="shop">
    {error && <div className="shop-error">{error}</div>}
    <div className="category-grid">{categories.map(category => <Link
      to={category.id === 'custom' ? '/custom' : `/category/${category.id}`}
      className="category-card" key={category.id}>
      <img src={category.image} alt={category.name} loading="lazy" />
      <div className="category-shade" />
      <div className="category-copy"><h2>{category.name}</h2></div>
    </Link>)}</div>
  </section>;
}

function ProductCard({ product, index = 0 }) {
  return <Link to={`/product/${product.id}`} className="product-card">
    <div className="product-img"><img src={product.image} loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = categories.find(c => c.id === product.categoryId)?.image || ""; }} />
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
    <div className="detail-grid"><div className="detail-photo"><img src={product.image} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = categories.find(c => c.id === product.categoryId)?.image || ""; }} /><span className="product-tag">נאפה טרי</span></div>
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
    if (!items.length) return setError('אין פריטים להזמנה.');
    if (!name.trim() || phone.replace(/\\D/g, '').length < 9) return setError('נא למלא שם וטלפון תקין.');
    setBusy(true);
    try {
      await placeOrder({name:name.trim(),phone:phone.trim(),date,items});
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

function Admin({ reload }) {
 const [user,setUser]=useState(null),[checking,setChecking]=useState(true);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [error,setError]=useState(''),[orders,setOrders]=useState([]),[products,setProducts]=useState([]);
 const [screen,setScreen]=useState('home'),[busy,setBusy]=useState(false),[category,setCategory]=useState('yeast');
 const [form,setForm]=useState({name:'',categoryId:'yeast',price:'',image:''}),[file,setFile]=useState(null);
 const refresh=async()=>{const [o,p]=await Promise.all([getOrders(),getProducts()]);setOrders(o);setProducts(p);await reload()};
 useEffect(()=>{isAdmin().then(ok=>{if(ok){setUser(authUser());refresh().catch(e=>setError(e.message))}}).finally(()=>setChecking(false))},[]);
 const login=async e=>{e.preventDefault();setBusy(true);setError('');try{setUser(await signIn(email,password));await refresh()}catch(err){setError(err.message)}finally{setBusy(false)}};
 const change=async(id,status)=>{try{await changeOrder(id,status);await refresh()}catch(err){setError(err.message)}};
 const save=async e=>{e.preventDefault();setBusy(true);setError('');try{if(!file)throw Error('יש לבחור תמונה למוצר');const image=await uploadImage(file);await saveProduct({...form,description:'',image});setForm({name:'',categoryId:'yeast',price:'',image:''});setFile(null);await refresh();setScreen('home')}catch(err){setError(err.message)}finally{setBusy(false)}};
 const remove=async id=>{if(!window.confirm('למחוק את המוצר?'))return;try{await disableProduct(id);await refresh()}catch(err){setError(err.message)}};
 if(checking)return <section className="admin-page">בודקים הרשאות…</section>;
 if(!user)return <section className="admin-page admin-login-page"><div className="admin-login"><h1>ניהול</h1><p>יש להפעיל הרשאת מנהלת במערכת לפני השימוש.</p></div></section>;
 return <section className="admin-page">
 {screen!=='home'&&<button className="button outline" onClick={()=>{setScreen('home');setError('')}}>חזרה</button>}
 {error&&<p className="error-msg">{error}</p>}
 {screen==='home'&&<div className="admin-three-actions">
 <button onClick={()=>setScreen('orders')}>הזמנות</button>
 <button onClick={()=>setScreen('add')}>הוספת מוצר</button>
 <button onClick={()=>setScreen('delete')}>מחיקת מוצר</button>
 </div>}
 {screen==='orders'&&<div><h2>הזמנות</h2>{orders.length===0?<p>אין הזמנות עדיין</p>:orders.map(o=><article key={o.id} className="admin-order"><h3>{o.customer_name} — {o.phone}</h3><small>{new Date(o.created_at).toLocaleDateString('he-IL')} · {o.requested_date||'ללא תאריך מבוקש'}</small><div>{(o.items||[]).map((item,i)=><p key={i}>{item.name} × {item.quantity}{item.note&&' — '+item.note}{item.description&&' — '+item.description}</p>)}</div><b>{money(o.total)}</b><select value={o.status} onChange={e=>change(o.id,e.target.value)}><option value="new">חדשה</option><option value="confirmed">אושרה</option><option value="preparing">בהכנה</option><option value="completed">הושלמה</option><option value="cancelled">בוטלה</option></select></article>)}</div>}
 {screen==='add'&&<form className="admin-product-form" onSubmit={save}><h2>הוספת מוצר</h2>
 <label className="field-label">שם מוצר</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
 <label className="field-label">קטגוריה</label><select value={form.categoryId} onChange={e=>setForm({...form,categoryId:e.target.value})}>{categories.filter(c=>c.id!=='custom').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
 <label className="field-label">מחיר</label><input type="number" min="0" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/>
 <label className="field-label">תמונה</label><input type="file" accept="image/jpeg,image/png,image/webp" required onChange={e=>setFile(e.target.files?.[0]||null)}/>
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
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error); }, []);
  return <BrowserRouter><App /></BrowserRouter>;
}

createRoot(document.getElementById('root')).render(<Mount />);
