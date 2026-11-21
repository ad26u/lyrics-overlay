# Lyrics Overlay

كلمات الأغنية على خلفية سطح المكتب، ودائرة على جنب الشاشة فيها الأغنية الحالية والجاية.
Windows 11 + macOS. Electron.

## التشغيل لأول مرة

```bash
npm install
cp .env.example .env          # اختياري: حط Spotify Client ID لقائمة الأغاني الجاية
npm test                      # الاختبارات
```

### ويندوز
يحتاج .NET 8 SDK عشان قارئ الأغنية (win-media.exe):

```powershell
powershell -File scripts/build-helper.ps1
npm run dev
```

### ماك
```bash
npm run dev
```
أول مرة بيطلب إذن التحكم بـ Spotify / Music. وافق.

## أول تجربة: الخلفية
قبل أي شي، جرب إن النص ينلصق بالخلفية:
- ويندوز: النص `SPIKE` يبين فوق الخلفية وتحت كل النوافذ.
- ماك: نفس الشي، وفي كل الـ Spaces.

## بناء ملف التثبيت
```bash
npm run dist:win   # على ويندوز
npm run dist:mac   # على ماك
```

## الستايلات بدون Electron
شوف `dev/README.md`.
