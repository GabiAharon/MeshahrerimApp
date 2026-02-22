# 🧪 Test Push Notifications

## Test 1: Manual API Call (בדוק אם ה-API עובד)

פתח Console (`F12`) בדף https://mybuilding-five.vercel.app/admin.html

הדבק את הקוד הזה:

```javascript
fetch('/api/send-push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'בדיקת פוש ידנית',
    message: 'זוהי בדיקה של push notification',
    url: '/index.html'
  })
})
.then(res => res.json())
.then(data => {
  console.log('✅ Push Response:', data);
  if (data.error) {
    console.error('❌ Error:', data.error);
  } else {
    console.log(`📨 Sent to ${data.recipients} recipients`);
  }
})
.catch(err => console.error('❌ Fetch Error:', err));
```

**אם זה עובד** → תראה בConsole: `✅ Push Response: {id: "...", recipients: X}`

**אם זה לא עובד** → תראה Error

---

## Test 2: בדוק sendPushBroadcast

```javascript
window.AppAuth.sendPushBroadcast({
  title: 'Test from Console',
  message: 'This is a test message',
  url: '/index.html'
}).then(result => {
  console.log('✅ Result:', result);
  if (result.error) {
    console.error('❌ Error:', result.error);
  }
});
```

---

## Test 3: בדוק OneSignal Status

```javascript
if (window.OneSignalDeferred) {
  window.OneSignalDeferred.push(async function(OneSignal) {
    const permission = await OneSignal.Notifications.permission;
    const userId = await OneSignal.User.PushSubscription.id;
    console.log('🔔 OneSignal Status:');
    console.log('  Permission:', permission);
    console.log('  User ID:', userId);
    console.log('  Subscribed:', await OneSignal.User.PushSubscription.optedIn);
  });
} else {
  console.error('❌ OneSignal not loaded');
}
```

---

## אם הכל עובד אבל לא מקבל Push:

1. **בדוק הרשאות Browser:**
   - Chrome: `chrome://settings/content/notifications`
   - Edge: `edge://settings/content/notifications`
   - וודא ש-mybuilding-five.vercel.app **מותר**

2. **בדוק OneSignal Dashboard:**
   - https://dashboard.onesignal.com
   - היכנס לApp שלך
   - Audience → All Users
   - **תראה כמה Users רשומים**

3. **שלח Push Manual מ-OneSignal:**
   - Messages → New Push
   - שלח ל-All Users
   - **אם זה עובד** → הבעיה בקוד
   - **אם לא** → הבעיה ב-OneSignal setup
