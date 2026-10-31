# פירורים של אהבה — אתר קונדיטוריה

חנות עוגות בעברית עם ממשק RTL, סל והזמנות, ומסך ניהול המותאם להתקנה בטלפון (PWA).

## הפעלה מקומית

```bash
npm install
npm run dev
```

## בנייה

```bash
npm run build
```

## פריסה ב־Vercel

ייבאו את המאגר ל־Vercel. Framework: Vite, Build Command: `npm run build`, Output Directory: `dist`.

## חיבור Appwrite

הגדירו את משתני הסביבה מתוך `.env.example` בהגדרות הפרויקט ב־Vercel. נדרשים Database ID ואוספים עם שדות המתאימים למסמכים בקוד. אין להוסיף מפתח API סודי לצד לקוח.

הזמנות ומוצרים פועלים במצב הדגמה מקומי עד להגדרת Appwrite. שליחת Push דורשת בנוסף מפתח VAPID ופונקציית שרת לשליחה.
