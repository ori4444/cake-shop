const CACHE='pirurim-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/manifest.webmanifest','/icon.svg']))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&new URL(e.request.url).origin===location.origin)e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>caches.match('/'))));});
self.addEventListener('push',e=>{let d={title:'התקבלה הזמנה חדשה',body:'יש הזמנה חדשה שממתינה לך',url:'/admin'};try{d={...d,...e.data.json()}}catch{}e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'/icon.svg',badge:'/icon.svg',data:{url:d.url||'/admin'},dir:'rtl',lang:'he',tag:d.tag||'order'}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{const c=cs.find(x=>new URL(x.url).origin===location.origin);return c?c.navigate(e.notification.data.url).then(x=>x.focus()):clients.openWindow(e.notification.data.url)}));});
