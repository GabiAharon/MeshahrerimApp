# פתרון בעיית IndexedDB להתראות Push

## הבעיה
השגיאה `Internal error opening backing store for indexedDB.open` מונעת מ-OneSignal לעבוד כראוי.

## הסיבות האפשריות

### 1. **מצב גלישה פרטית / Incognito**
IndexedDB לא זמין במצב גלישה פרטית ברוב הדפדפנים.

**פתרון:** פתח את האתר בחלון רגיל (לא פרטי).

---

### 2. **אחסון דפדפן מלא**
הדפדפן אזל מזיכרון או שה-quota של IndexedDB מלא.

**פתרון Chrome/Edge:**
1. פתח `chrome://settings/content/all`
2. חפש את הדומיין שלך
3. לחץ על "Clear data"
4. רענן את הדף

**פתרון Firefox:**
1. פתח `about:preferences#privacy`
2. לחץ "Clear Data..."
3. סמן "Site Data"
4. לחץ "Clear"

---

### 3. **הגדרות דפדפן חוסמות IndexedDB**

**Chrome/Edge:**
1. `chrome://settings/content/cookies`
2. וודא ש-"Allow sites to save and read cookie data" מסומן
3. בדוק ב-"Not allowed to save data" שהדומיין שלך לא רשום

**Firefox:**
1. `about:preferences#privacy`
2. תחת "Cookies and Site Data"
3. וודא שלא מסומן "Delete cookies and site data when Firefox is closed"

---

### 4. **תוסף דפדפן חוסם**
תוספים כמו Privacy Badger, uBlock Origin, או NoScript עלולים לחסום IndexedDB.

**פתרון:**
1. נסה להשבית זמנית את כל התוספים
2. רענן את הדף
3. אם זה עובד - הפעל תוסף אחד אחד כדי לזהות את החוסם
4. הוסף את הדומיין שלך לרשימה הלבנה בתוסף

---

### 5. **בעיית הרשאות ב-Windows**
לפעמים בעיות הרשאות בתיקיית הפרופיל של הדפדפן.

**פתרון:**
1. סגור לגמרי את הדפדפן
2. נקה את Cache והיסטוריה
3. פתח מחדש
4. אם עדיין לא עובד - נסה ליצור פרופיל דפדפן חדש

---

### 6. **נסה דפדפן אחר**
אם שום דבר לא עוזר, נסה דפדפן אחר:
- Chrome
- Firefox
- Edge
- Brave

---

## בדיקת תקינות

פתח את Console בדפדפן (`F12`) והרץ:

```javascript
// Test IndexedDB
const testDB = indexedDB.open('test', 1);
testDB.onsuccess = () => {
  console.log('✅ IndexedDB works!');
  testDB.result.close();
  indexedDB.deleteDatabase('test');
};
testDB.onerror = (e) => {
  console.error('❌ IndexedDB failed:', e);
};
```

אם אתה רואה ✅ - IndexedDB עובד!
אם אתה רואה ❌ - יש בעיה בהגדרות הדפדפן.

---

## מה השתנה בקוד?

עכשיו [push.js](public/push.js) בודק אוטומטית את זמינות IndexedDB לפני ניסיון אתחול OneSignal.

אם IndexedDB לא זמין, תקבל הודעת שגיאה ברורה במקום קריסה שקטה.

---

## תמיכה נוספת

אם אף אחד מהפתרונות לא עזר, צור issue ב-GitHub עם:
1. דפדפן וגרסה
2. מערכת הפעלה
3. צילום מסך של Console errors
