export const categories=[
 {id:'yeast',name:'עוגות שמרים ובחושות',short:'ריח של בית, ביס של אושר',image:'https://images.unsplash.com/photo-1608198093002-ad4e0054841b?auto=format&fit=crop&w=1100&q=85'},
 {id:'cookies',name:'עוגיות',short:'קטנות, פריכות וממכרות',image:'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1100&q=85'},
 {id:'desserts',name:'קינוחים',short:'רגע מתוק לעצמך',image:'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1100&q=85'},
 {id:'mousse',name:'עוגות מוס',short:'שכבות של חלום',image:'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1100&q=85'},
 {id:'cheesecake',name:'עוגות גבינה',short:'רכות, עשירות ומפנקות',image:'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=1100&q=85'},
 {id:'custom',name:'עוגה בעיצוב אישי',short:'אתם חולמים, אנחנו אופים',image:'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&w=1100&q=85'}
];
export const initialProducts=[
['p1','yeast','עוגת שמרים שוקולד',55,'עוגת שמרים רכה עם מילוי שוקולד עשיר.'],['p2','yeast','עוגת שמרים קינמון',52,'שושני שמרים ריחניות עם קינמון וסוכר חום.'],['p3','yeast','עוגת תפוזים בחושה',45,'עוגה בחושה אוורירית עם תפוזים טריים.'],['p4','yeast','עוגת שיש שוקולד וניל',48,'עוגת שיש קלאסית ורכה, בדיוק ליד הקפה.'],
['p5','cookies',"עוגיות שוקולד צ׳יפס",35,'עוגיות חמימות עם שוקולד צ׳יפס, 12 יחידות.'],['p6','cookies','עוגיות אלפחורס',42,'עוגיות חמאה עדינות עם ריבת חלב וקוקוס.'],['p7','cookies','עוגיות חמאה',32,'עוגיות חמאה נימוחות, 18 יחידות.'],['p8','cookies','עוגיות בראוניז',38,'עוגיות שוקולד פאדג׳יות, 10 יחידות.'],
['p9','desserts','קינוח טירמיסו אישי',25,'קרם מסקרפונה עשיר עם קפה ובישקוטים.'],['p10','desserts','קינוח לוטוס בכוס',24,'קרם לוטוס וביסקוויטים בכוס אישית.'],['p11','desserts','בראוניז שוקולד',18,'ריבוע בראוניז עשיר עם מרכז פאדג׳י.'],['p12','desserts','קינוח אוראו אישי',24,'קרם וניל ואוראו בקינוח אישי.'],
['p13','mousse','עוגת מוס שוקולד',145,'מוס שוקולד קטיפתי על בסיס פריך.'],['p14','mousse','עוגת מוס טריקולד',155,'שלוש שכבות שוקולד, מריר, חלב ולבן.'],['p15','mousse','עוגת מוס לוטוס',150,'מוס לוטוס עשיר עם קראנץ׳ עדין.'],['p16','mousse','עוגת מוס פיסטוק',165,'מוס פיסטוק עדין עם שכבת פרלינה.'],
['p17','cheesecake','עוגת גבינה אפויה',120,'עוגת גבינה אפויה קלאסית ונימוחה.'],['p18','cheesecake','עוגת גבינה פירורים',125,'גבינה עשירה, פירורי חמאה ושכבת קצפת.'],['p19','cheesecake','עוגת גבינה לוטוס',135,'גבינה קרמית עם ציפוי וממרח לוטוס.'],['p20','cheesecake','עוגת גבינה ופירות יער',140,'עוגת גבינה עדינה עם פירות יער.']
].map(([id,categoryId,name,price,description],i)=>({id,categoryId,name,price,description,image:`https://images.unsplash.com/${[
  'photo-1608198093002-ad4e0054841b','photo-1555507036-ab1f4038808a','photo-1578985545062-69928b1d9587','photo-1559620192-032c4bc4674e',
  'photo-1499636136210-6f4ee915583e','photo-1558961363-fa8fdf82db35','photo-1590080877777-ec5a6c2bdcb5','photo-1548365328-8b849e6f15a4',
  'photo-1488477181946-6428a0291777','photo-1551024506-0bccd828d307','photo-1606313564200-e75d5e30476c','photo-1614707267537-b85aaf00c4b7',
  'photo-1588195538326-c5b1e9f80a1b','photo-1565958011703-44f9829ba187','photo-1563729784474-d77dbb933a9e','photo-1567171466295-4afa63d45416',
  'photo-1533134242443-d4fd215305ad','photo-1508737027454-e6454f45b1d4','photo-1519915028121-7d3463d20b13','photo-1562440499-64c9a111f713'
][i]}?auto=format&fit=crop&w=900&q=82`,active:true}));
export const money=n=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:0}).format(n);
