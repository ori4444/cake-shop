# פירורים של אהבה

חנות עוגות בעברית, עם React/Vite, אחסון Supabase, ממשק ניהול מוגן והודעות Push.

## הודעות Push להזמנות חדשות (Supabase)

הקוד עבר מ־Appwrite ל־Supabase, אבל שרשרת ה־Push נשארה מחוברת ל־Appwrite הישן ולא עבדה בפועל (הזמנות נכנסו, אבל שום דבר לא שלח התראה, וגם מצד הלקוח לא היה קוד שנרשם ל־Push כלל). זה תוקן: ההרשמה ל־Push ושליחתה עוברות עכשיו דרך Supabase.

1. ב־SQL Editor של Supabase הריצו:

```sql
create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
-- בכוונה בלי policies: רק מפתח ה-service_role (בצד השרת) יכול לגשת לטבלה הזו.
```

2. יש **שני** פרויקטי Vercel נפרדים (מאותו repo) — האדמין (`/api/push-subscriptions` רץ שם) והחנות הציבורית (`/api/notify-order` רץ שם, כי שם מתבצעת ההזמנה). כל פרויקט בונה ורץ בנפרד, אז כל אחד צריך את משתני הסביבה שלו — לא מספיק להגדיר רק באחד מהם:

**בפרויקט ה־Admin** הוסיפו:

```text
VITE_VAPID_PUBLIC_KEY=<מפתח VAPID ציבורי>
SUPABASE_URL=<כתובת ה-Supabase, זהה ל-VITE_SUPABASE_URL>
SUPABASE_SERVICE_ROLE_KEY=<service_role key מתוך Settings → API ב-Supabase; מסומן Sensitive>
```

**בפרויקט החנות הציבורית** הוסיפו:

```text
SUPABASE_URL=<אותה כתובת Supabase>
SUPABASE_SERVICE_ROLE_KEY=<אותו service_role key; מסומן Sensitive>
VAPID_PUBLIC_KEY=<אותו מפתח כמו VITE_VAPID_PUBLIC_KEY>
VAPID_PRIVATE_KEY=<מפתח VAPID פרטי; מסומן Sensitive>
VAPID_SUBJECT=mailto:<אימייל קשר>
```

3. אחרי שמירת המשתנים **בשני הפרויקטים**, הפעילו Redeploy לשניהם. בכניסה ל־`/admin` ולחיצה על **אישור התראות** המכשיר נרשם אוטומטית (`/api/push-subscriptions`), וכל הזמנה חדשה בחנות שולחת Push לכל המכשירים הרשומים (`/api/notify-order`).

4. בדיקת תקינות מהירה בלי לפתוח את האפליקציה: `POST /api/push-subscriptions` בפרויקט האדמין צריך להחזיר `401` (לא `500`) כשמבקשים בלי התחברות — `500` עם ההודעה "רישום ההתראות נכשל" סימן בטוח שחסרים `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` באותו פרויקט.

> שאר התיעוד למטה מתאר את ההקמה הישנה מול Appwrite ואינו משקף את הסכימה האמיתית ב־Supabase (טבלאות `products`, `orders`, `admin_users`, `category_images`, RPC־ים `place_order` ו־`claim_initial_admin`). אם תרצו, אפשר לכתוב תיעוד מדויק למה שקיים היום ב־Supabase בנפרד.

## חיבור Appwrite ו־Vercel (ישן, לא בשימוש)

1. בפרויקט Appwrite `6ae66bb4002feda402cd` הוסיפו Web platform עם כתובת אתר ה־Vercel הקבועה (למשל `cake-shop.vercel.app`).
2. צרו מראש חשבון משתמש למנהלת ושמרו את מזהה המשתמש והאימייל שלו. כבו הרשמה ציבורית. `/admin` מאפשר כניסה רק לאימייל ולמזהה שהוגדרו.
3. צרו Database, ושלוש Collections עם IDs: `products`, `orders`, `push_subscriptions`. הפעילו **Document security** בכל Collection. הגדירו את השדות הבאים (ב־Appwrite כל שדה חייב להיות Attribute):

| Collection | Attributes |
|---|---|
| `products` | `name` string 255 required; `categoryId` string 60 required; `description` string 1000; `image` string 2048; `price` float required; `active` boolean required |
| `orders` | `customer_name` string 100 required; `phone` string 30 required; `requested_date` string 30; `items_json` string 10000 required; `total` float required; `has_custom` boolean required; `status` string 30 required; `created_at` string 40 required |
| `push_subscriptions` | `endpoint` string 2048 required; `p256dh` string 255 required; `auth` string 255 required; `created_at` string 40 required |

4. הרשאות Collection: ב־`products` אפשרו `read: any`; אפשרו create/update/delete רק ל־user של המנהלת. ב־`orders` אפשרו `read: any` ברמת Collection כדי לאפשר שאילתות, והשאירו Document security מופעלת — כל מסמך הזמנה שהשרת יוצר מקבל read/update רק למזהה המנהלת. ב־`push_subscriptions` השאירו גישה דרך השרת בלבד (API key); אין הרשאת קריאה/כתיבה ל־any.
5. אם משתמשים בתמונות שהמנהלת מעלה: צרו Storage bucket בשם `cake-images`, הפעילו File security, והרשו create ל־any. הרשאות הקובץ עצמו מוגדרות בקוד: תמונות קטלוג קריאות לציבור, ותמונת השראה לעוגה אישית קריאה רק למנהלת.
6. צרו API key ב־Appwrite עם הרשאות `databases.read`, `databases.write`, `storage.read`, `storage.write` (נדרש רק אם תמונות מועלות). הוסיפו ב־Vercel את משתני הסביבה הבאים ל־Production, Preview ו־Development:

```text
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=6ae66bb4002feda402cd
VITE_APPWRITE_DATABASE_ID=<database ID>
VITE_APPWRITE_PRODUCTS_COLLECTION=products
VITE_APPWRITE_ORDERS_COLLECTION=orders
VITE_APPWRITE_BUCKET_ID=cake-images
VITE_APPWRITE_ADMIN_USER_ID=<Appwrite admin user ID>
VITE_ADMIN_EMAIL=<admin email>
VITE_VAPID_PUBLIC_KEY=<VAPID public key>
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=6ae66bb4002feda402cd
APPWRITE_DATABASE_ID=<same database ID>
APPWRITE_PRODUCTS_COLLECTION=products
APPWRITE_ORDERS_COLLECTION=orders
APPWRITE_PUSH_COLLECTION=push_subscriptions
APPWRITE_ADMIN_USER_ID=<same admin user ID>
APPWRITE_ADMIN_EMAIL=<same admin email>
APPWRITE_API_KEY=<Appwrite API key; mark sensitive>
VAPID_PUBLIC_KEY=<same VAPID public key>
VAPID_PRIVATE_KEY=<VAPID private key; mark sensitive>
VAPID_SUBJECT=mailto:<contact email>
```

7. צרו זוג מפתחות VAPID. הוסיפו את המפתח הציבורי גם ל־`VITE_VAPID_PUBLIC_KEY` וגם ל־`VAPID_PUBLIC_KEY`; הוסיפו את הפרטי רק ל־`VAPID_PRIVATE_KEY` המסומן Sensitive. אחרי שמירת משתני Vercel, הפעילו Redeploy.
8. היכנסו ל־`/admin`, התחברו עם החשבון שנוצר, ובחרו **התראות → הפעלת התראות**. בדפדפן בטלפון התקינו דרך **הוספה למסך הבית**; האתר ומסך הניהול פועלים דרך Vercel.

אין הזמנות או ניהול מקומיים כגיבוי. הזמנה נשמרת בשרת Appwrite; במקרה כשל האתר מציג שגיאה. לאחר שמירת הזמנה השרת שולח Push למכשירים הרשומים.

## עדכון האתר החי

כל שינוי בקוד חייב להידחף (commit + push) ל־`main` כדי להתעדכן באתר ב־Vercel — Vercel בונה ומפרסם אוטומטית רק מה שנדחף ל־repo, לא מה שנשמר מקומית בלבד. כדי לראות שינוי בפועל באתר, יש לוודא שהוא נדחף ולא רק נשמר כקובץ מקומי.
