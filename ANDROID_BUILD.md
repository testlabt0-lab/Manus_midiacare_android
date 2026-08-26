# بناء تطبيق MediCare Pro Mobile لنظام Android

تطبيق الهاتف مبني بـ Expo وReact Native، ويستخدم حزمة Android `com.medicarepro.mobile` ورابط الرجوع الآمن `medicarepro://auth`. لا يحتوي التطبيق على مفاتيح خادمية أو بيانات اعتماد للقاعدة؛ إذ يتصل فقط بخدمة MediCare Pro المنشورة من خلال عنوان عام قابل للضبط.

## الإعداد والتحقق

انسخ `.env.example` إلى `.env` إذا كنت تحتاج إلى عنوان API مختلف عن النطاق المنشور الافتراضي. لا تضف مفاتيح أو رموز وصول إلى هذا الملف.

```bash
pnpm install
pnpm test
pnpm check
pnpm exec expo export --platform android
```

يتم توليد مشروع Gradle الأصلي من إعداد Expo عند الحاجة، لذلك لا يعتمد البناء على ملفات Android مولّدة قديمة:

```bash
pnpm exec expo prebuild --platform android --no-install
```

## إخراج APK محلي

يحتاج إنشاء APK إلى Android SDK محلي يتضمن Android Platform API 36 وBuild Tools 36.0.0، مع ضبط `ANDROID_HOME` أو ملف `android/local.properties` ليدل على مسار SDK. بعد ذلك نفّذ:

```bash
cd android
./gradlew assembleDebug
```

يكون APK التجريبي في `android/app/build/outputs/apk/debug/`. أما نسخة النشر فتحتاج مفتاح توقيع إصدار محفوظاً خارج المستودع، ثم يمكن بناؤها بالأمر `./gradlew assembleRelease` أو كحزمة متجر عبر `./gradlew bundleRelease`.

> لا تُرفع ملفات المفاتيح أو `local.properties` أو ملف `.env` إلى GitHub. راجع أدوات سطر الأوامر الرسمية لنظام Android لإدارة SDK: https://developer.android.com/tools
