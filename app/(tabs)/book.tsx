import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { createReviewRequiredAvailability } from "@/lib/booking-availability";
import { useMediCare } from "@/lib/medicare-store";
import { getRemoteBookingAvailability } from "@/lib/patient-api";

const STEPS = ["الخدمة", "الموعد", "العنوان", "المراجعة"];
const SERVICES = ["طب عام", "تمريض منزلي", "متابعة مزمنة"];
const CLINICS = ["عيادة الحياة", "عيادة الرعاية الأولى"];

export default function BookingScreen() {
  const router = useRouter();
  const { addVisit, login, session } = useMediCare();
  const [step, setStep] = useState(0);
  const [service, setService] = useState(SERVICES[0]);
  const [clinic, setClinic] = useState(CLINICS[0]);
  const [address, setAddress] = useState("المنزل · حي تجريبي · الرياض");
  const [scheduledAt, setScheduledAt] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState(createReviewRequiredAvailability);

  useEffect(() => {
    if (!session) { setAvailability(createReviewRequiredAvailability()); return; }
    void getRemoteBookingAvailability(session).then(setAvailability).catch(() => setAvailability(createReviewRequiredAvailability()));
  }, [session]);

  const services = useMemo(() => availability.mode === "REMOTE" ? availability.services.map((item) => item.label) : SERVICES, [availability]);
  const clinics = useMemo(() => availability.mode === "REMOTE" ? availability.clinics.map((item) => item.label) : CLINICS, [availability]);

  const scheduledLabel = new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(scheduledAt);
  const next = () => setStep((current) => Math.min(current + 1, STEPS.length - 1));
  const back = () => step === 0 ? router.back() : setStep((current) => current - 1);
  const onPickerChange = (_event: DateTimePickerEvent, value?: Date) => {
    if (!value) { setPickerMode(null); return; }
    setScheduledAt((current) => {
      const nextDate = new Date(current);
      if (pickerMode === "date") nextDate.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      else nextDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
      return nextDate;
    });
    setPickerMode(null);
  };
  const confirm = async () => {
    if (!session) {
      try { await login(); Alert.alert("تم ربط الحساب", "راجِع تفاصيل الحجز ثم اضغط تأكيد الحجز."); } catch (error) { Alert.alert("تعذر تسجيل الدخول", error instanceof Error ? error.message : "حاول مرة أخرى."); }
      return;
    }
    setSaving(true);
    try {
      const visit = await addVisit({ clinicName: clinic, serviceName: `${service} · زيارة منزلية`, districtLabel: address, scheduledStart: scheduledAt.toISOString() });
      Alert.alert("تم إرسال طلب الزيارة", `رقم المرجع: ${visit.reference ?? visit.id}`, [{ text: "عرض الزيارة", onPress: () => router.replace(`/visit/${visit.remoteId ?? visit.id}`) }]);
    } catch (error) { Alert.alert("تعذر إنشاء الزيارة", error instanceof Error ? error.message : "حاول اختيار موعد آخر."); } finally { setSaving(false); }
  };

  return <ScreenContainer><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable onPress={back} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-forward" size={22} color="#0B776B" /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>حجز زيارة منزلية</Text><Text style={styles.subtitle}>أكمل الخطوات الأربع لإرسال طلبك للعيادة.</Text></View></View>
    <View style={styles.stepper}>{STEPS.map((label, index) => <View key={label} style={styles.stepItem}><View style={[styles.stepDot, index <= step && styles.stepDotActive]}><Text style={[styles.stepNumber, index <= step && styles.stepNumberActive]}>{index < step ? "✓" : index + 1}</Text></View><Text style={[styles.stepLabel, index === step && styles.stepLabelActive]}>{label}</Text>{index < STEPS.length - 1 ? <View style={[styles.stepLine, index < step && styles.stepLineActive]} /> : null}</View>)}</View>
    <View style={styles.card}><Text style={styles.cardTitle}>{STEPS[step]}</Text>
      {step === 0 ? <><Text style={styles.help}>اختر تفضيلات الخدمة والعيادة. يتحقق خادم MediCare Pro من الإتاحة عند إنشاء الطلب ولا يعرض الهاتف هذه الخيارات كتأكيد نهائي.</Text><View style={[styles.availabilityNotice, availability.mode === "REMOTE" && styles.remoteNotice]}><MaterialIcons name={availability.mode === "REMOTE" ? "cloud-done" : "info-outline"} size={19} color={availability.mode === "REMOTE" ? "#177A45" : "#1466A0"} /><Text style={[styles.availabilityNoticeText, availability.mode === "REMOTE" && styles.remoteNoticeText]}>{availability.notice}</Text></View><Text style={styles.label}>الخدمة المفضلة</Text><View style={styles.choices}>{services.map((item) => <Pressable key={item} onPress={() => setService(item)} style={({ pressed }) => [styles.choice, service === item && styles.choiceActive, pressed && styles.pressed]}><Text style={[styles.choiceText, service === item && styles.choiceTextActive]}>{item}</Text></Pressable>)}</View><Text style={styles.label}>العيادة المفضلة</Text><View style={styles.choices}>{clinics.map((item) => <Pressable key={item} onPress={() => setClinic(item)} style={({ pressed }) => [styles.choice, clinic === item && styles.choiceActive, pressed && styles.pressed]}><Text style={[styles.choiceText, clinic === item && styles.choiceTextActive]}>{item}</Text></Pressable>)}</View></> : null}
      {step === 1 ? <><Text style={styles.help}>اختر الوقت المفضل للطلب. لا يصبح الموعد مؤكداً إلا بعد تحقق خادم الموقع ومراجعة العيادة.</Text><View style={styles.availabilityNotice}><MaterialIcons name="info-outline" size={19} color="#1466A0" /><Text style={styles.availabilityNoticeText}>لا تتوفر واجهة فترات حجز للمريض في الموقع حالياً؛ يُرسل هذا الوقت كتفضيل آمن فقط.</Text></View><View style={styles.dateSummary}><MaterialIcons name="calendar-month" size={24} color="#0B776B" /><Text style={styles.dateSummaryText}>{scheduledLabel}</Text></View><View style={styles.dateActions}><Pressable onPress={() => setPickerMode("date")} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}><MaterialIcons name="date-range" size={19} color="#0B776B" /><Text style={styles.dateButtonText}>تاريخ مفضل</Text></Pressable><Pressable onPress={() => setPickerMode("time")} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}><MaterialIcons name="schedule" size={19} color="#0B776B" /><Text style={styles.dateButtonText}>وقت مفضل</Text></Pressable></View>{pickerMode ? <DateTimePicker value={scheduledAt} mode={pickerMode} minimumDate={new Date()} onChange={onPickerChange} /> : null}</> : null}
      {step === 2 ? <><Text style={styles.help}>اختيار العنوان في هذه النسخة تجريبي إلى أن يوفّر الموقع قائمة عناوين الحساب. لا يظهر العنوان في بطاقات الزيارة العامة.</Text><Pressable onPress={() => setAddress("المنزل · حي تجريبي · الرياض")} style={({ pressed }) => [styles.addressCard, styles.addressActive, pressed && styles.pressed]}><MaterialIcons name="home" size={22} color="#0B776B" /><View style={styles.addressCopy}><Text style={styles.addressTitle}>المنزل التجريبي</Text><Text style={styles.addressText}>حي تجريبي · الرياض</Text></View><MaterialIcons name="check-circle" size={21} color="#0B776B" /></Pressable><Pressable onPress={() => setAddress("العمل · حي تجريبي · الرياض")} style={({ pressed }) => [styles.addressCard, address.startsWith("العمل") && styles.addressActive, pressed && styles.pressed]}><MaterialIcons name="business" size={22} color="#58766F" /><View style={styles.addressCopy}><Text style={styles.addressTitle}>العمل التجريبي</Text><Text style={styles.addressText}>حي تجريبي · الرياض</Text></View>{address.startsWith("العمل") ? <MaterialIcons name="check-circle" size={21} color="#0B776B" /> : null}</Pressable></> : null}
      {step === 3 ? <><Text style={styles.help}>راجع تفضيلات الطلب قبل الإرسال. سيحمل الطلب حالة «بانتظار مراجعة العيادة» ولا يؤكد وقتاً أو عنواناً مسبقاً.</Text><View style={styles.review}><Text style={styles.reviewLabel}>الخدمة المفضلة</Text><Text style={styles.reviewValue}>{service} · زيارة منزلية</Text><Text style={styles.reviewLabel}>العيادة المفضلة</Text><Text style={styles.reviewValue}>{clinic}</Text><Text style={styles.reviewLabel}>الوقت المفضل</Text><Text style={styles.reviewValue}>{scheduledLabel}</Text><Text style={styles.reviewLabel}>العنوان التجريبي</Text><Text style={styles.reviewValue}>{address}</Text></View>{!session ? <View style={styles.loginNotice}><MaterialIcons name="lock-outline" size={19} color="#8A5A1D" /><Text style={styles.loginNoticeText}>سجّل الدخول الآمن لتأكيد الحجز وربطه بحسابك.</Text></View> : null}</> : null}
      <View style={styles.actions}><Pressable onPress={back} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>{step === 0 ? "إلغاء" : "السابق"}</Text></Pressable><Pressable disabled={saving} onPress={() => step === 3 ? void confirm() : next()} style={({ pressed }) => [styles.primary, saving && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryText}>{step === 3 ? (saving ? "جارٍ إنشاء الزيارة…" : session ? "تأكيد الحجز" : "تسجيل الدخول للتأكيد") : "متابعة"}</Text><MaterialIcons name="arrow-back" size={18} color="#FFFFFF" /></Pressable></View>
    </View>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32 }, header: { alignItems: "center", flexDirection: "row-reverse", marginBottom: 22 }, back: { alignItems: "center", backgroundColor: "#EAF6F3", borderRadius: 14, height: 44, justifyContent: "center", width: 44 }, headerCopy: { flex: 1, marginRight: 12 }, title: { color: "#183B36", fontSize: 23, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#6A827C", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" }, stepper: { alignItems: "flex-start", flexDirection: "row-reverse", marginBottom: 23 }, stepItem: { alignItems: "center", flex: 1 }, stepDot: { alignItems: "center", backgroundColor: "#E7EFEC", borderRadius: 12, height: 25, justifyContent: "center", width: 25 }, stepDotActive: { backgroundColor: "#0B776B" }, stepNumber: { color: "#6A827C", fontSize: 11, fontWeight: "800" }, stepNumberActive: { color: "#FFFFFF" }, stepLabel: { color: "#80958F", fontSize: 10, fontWeight: "700", marginTop: 6, textAlign: "center" }, stepLabelActive: { color: "#0B776B" }, stepLine: { backgroundColor: "#E2ECE8", height: 2, left: "56%", position: "absolute", top: 12, width: "88%" }, stepLineActive: { backgroundColor: "#0B776B" }, card: { backgroundColor: "#FFFFFF", borderColor: "#E0ECE8", borderRadius: 22, borderWidth: 1, padding: 17 }, cardTitle: { color: "#183B36", fontSize: 18, fontWeight: "800", textAlign: "right" }, help: { color: "#6A827C", fontSize: 12, lineHeight: 19, marginTop: 7, textAlign: "right" }, label: { color: "#41665D", fontSize: 13, fontWeight: "800", marginTop: 20, textAlign: "right" }, choices: { gap: 8, marginTop: 9 }, choice: { backgroundColor: "#F7FAF9", borderColor: "#D9E8E3", borderRadius: 13, borderWidth: 1, padding: 13 }, choiceActive: { backgroundColor: "#EAF6F3", borderColor: "#0B776B", borderWidth: 2 }, choiceText: { color: "#41665D", fontSize: 14, fontWeight: "700", textAlign: "right" }, choiceTextActive: { color: "#0B776B" }, availabilityNotice: { alignItems: "center", backgroundColor: "#EEF6FB", borderRadius: 13, flexDirection: "row-reverse", gap: 8, marginTop: 14, padding: 12 }, availabilityNoticeText: { color: "#1466A0", flex: 1, fontSize: 11, lineHeight: 17, textAlign: "right" }, remoteNotice: { backgroundColor: "#EEF8F1" }, remoteNoticeText: { color: "#177A45" }, dateSummary: { alignItems: "center", backgroundColor: "#EFF8F5", borderRadius: 15, flexDirection: "row-reverse", gap: 10, marginTop: 12, padding: 15 }, dateSummaryText: { color: "#31584F", flex: 1, fontSize: 14, fontWeight: "800", textAlign: "right" }, dateActions: { flexDirection: "row-reverse", gap: 9, marginTop: 10 }, dateButton: { alignItems: "center", backgroundColor: "#F7FAF9", borderColor: "#D9E8E3", borderRadius: 13, borderWidth: 1, flex: 1, gap: 6, minHeight: 47, justifyContent: "center" }, dateButtonText: { color: "#0B776B", fontSize: 12, fontWeight: "800" }, addressCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E8E3", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 11, marginTop: 12, padding: 14 }, addressActive: { backgroundColor: "#EFFAF6", borderColor: "#0B776B", borderWidth: 2 }, addressCopy: { flex: 1 }, addressTitle: { color: "#31584F", fontSize: 14, fontWeight: "800", textAlign: "right" }, addressText: { color: "#6A827C", fontSize: 12, marginTop: 3, textAlign: "right" }, review: { backgroundColor: "#F7FAF9", borderColor: "#E0ECE8", borderRadius: 15, borderWidth: 1, marginTop: 18, padding: 14 }, reviewLabel: { color: "#6A827C", fontSize: 11, marginTop: 8, textAlign: "right" }, reviewValue: { color: "#183B36", fontSize: 13, fontWeight: "800", marginTop: 3, textAlign: "right" }, loginNotice: { alignItems: "center", backgroundColor: "#FFF7E8", borderRadius: 13, flexDirection: "row-reverse", gap: 8, marginTop: 13, padding: 12 }, loginNoticeText: { color: "#8A5A1D", flex: 1, fontSize: 12, lineHeight: 18, textAlign: "right" }, actions: { flexDirection: "row-reverse", gap: 10, marginTop: 24 }, primary: { alignItems: "center", backgroundColor: "#0B776B", borderRadius: 13, flex: 1.3, flexDirection: "row-reverse", gap: 7, justifyContent: "center", minHeight: 49 }, primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" }, secondary: { alignItems: "center", backgroundColor: "#F0F6F4", borderRadius: 13, flex: 0.7, justifyContent: "center", minHeight: 49 }, secondaryText: { color: "#41665D", fontSize: 14, fontWeight: "800" }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
