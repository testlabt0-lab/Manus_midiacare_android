import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { useMediCare } from "@/lib/medicare-store";

type VisitComposerProps = {
  visible: boolean;
  onClose: () => void;
};

export function VisitComposer({ visible, onClose }: VisitComposerProps) {
  const { addVisit, session } = useMediCare();
  const [clinicName, setClinicName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [districtLabel, setDistrictLabel] = useState("");
  const [selectedAt, setSelectedAt] = useState(() => new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [error, setError] = useState("");

  const scheduledStart = selectedAt.toISOString();
  const dateLabel = new Intl.DateTimeFormat("ar-SA", { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(selectedAt);
  const timeLabel = new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" }).format(selectedAt);

  const setSuggestedTime = (hoursFromNow: number) => {
    setSelectedAt(new Date(Date.now() + hoursFromNow * 60 * 60 * 1000));
    setError("");
  };

  const handlePickerChange = (event: DateTimePickerEvent, value?: Date) => {
    if (event.type === "dismissed" || !value) {
      setPickerMode(null);
      return;
    }
    setSelectedAt((current) => {
      const next = new Date(current);
      if (pickerMode === "date") next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      else next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      return next;
    });
    setError("");
    setPickerMode(pickerMode === "date" && Platform.OS === "android" ? "time" : null);
  };

  const close = () => {
    setError("");
    onClose();
  };

  const save = async () => {
    try {
      await addVisit({ clinicName, serviceName, districtLabel, scheduledStart });
      setClinicName("");
      setServiceName("");
      setDistrictLabel("");
      setSelectedAt(new Date(Date.now() + 2 * 60 * 60 * 1000));
      close();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر حفظ الزيارة الآن.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="إغلاق نموذج إضافة زيارة" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable onPress={close} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]} accessibilityLabel="إغلاق">
              <MaterialIcons name="close" size={22} color="#41665D" />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>إضافة زيارة</Text>
              <Text style={styles.subtitle}>{session ? "سيُرسل الطلب إلى حسابك الصحي المتصل." : "سيُحفظ السجل محلياً على هذا الجهاز."}</Text>
            </View>
          </View>

          <Text style={styles.inputLabel}>اسم العيادة</Text>
          <TextInput
            value={clinicName}
            onChangeText={(value) => { setClinicName(value); setError(""); }}
            placeholder="مثال: عيادة الرعاية المنزلية"
            placeholderTextColor="#93A7A1"
            style={styles.input}
            textAlign="right"
            returnKeyType="next"
          />
          <Text style={styles.inputLabel}>نوع الخدمة</Text>
          <TextInput
            value={serviceName}
            onChangeText={(value) => { setServiceName(value); setError(""); }}
            placeholder="مثال: متابعة تمريضية"
            placeholderTextColor="#93A7A1"
            style={styles.input}
            textAlign="right"
            returnKeyType={session ? "next" : "done"}
            onSubmitEditing={session ? undefined : () => void save()}
          />
          {session ? <>
            <Text style={styles.inputLabel}>الحي</Text>
            <TextInput
              value={districtLabel}
              onChangeText={(value) => { setDistrictLabel(value); setError(""); }}
              placeholder="مثال: حي النخيل"
              placeholderTextColor="#93A7A1"
              style={styles.input}
              textAlign="right"
              returnKeyType="next"
            />
            <Text style={styles.inputLabel}>موعد الزيارة</Text>
            <Text style={styles.dateHelp}>اختر التاريخ والوقت من مكونات جهازك أو استخدم اقتراحاً سريعاً.</Text>
            <View style={styles.suggestionRow}>
              <Pressable onPress={() => setSuggestedTime(24)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}><Text style={styles.suggestionText}>غداً</Text></Pressable>
              <Pressable onPress={() => setSuggestedTime(2)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}><Text style={styles.suggestionText}>بعد ساعتين</Text></Pressable>
            </View>
            <View style={styles.dateRow}>
              <Pressable onPress={() => setPickerMode("time")} style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}><MaterialIcons name="schedule" size={20} color="#0B776B" /><Text style={styles.pickerValue}>{timeLabel}</Text><Text style={styles.pickerLabel}>الوقت</Text></Pressable>
              <Pressable onPress={() => setPickerMode("date")} style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}><MaterialIcons name="calendar-month" size={20} color="#0B776B" /><Text style={styles.pickerValue}>{dateLabel}</Text><Text style={styles.pickerLabel}>التاريخ</Text></Pressable>
            </View>
            {pickerMode ? <DateTimePicker value={selectedAt} mode={pickerMode} display={Platform.OS === "ios" ? "spinner" : "default"} minimumDate={new Date()} onChange={handlePickerChange} /> : null}
          </> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={() => void save()} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
            <MaterialIcons name="add-circle-outline" size={21} color="#FFFFFF" />
            <Text style={styles.saveText}>حفظ الزيارة</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(19, 45, 40, 0.36)" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingBottom: 30, paddingTop: 10 },
  handle: { alignSelf: "center", backgroundColor: "#D8E5E1", borderRadius: 99, height: 4, marginBottom: 18, width: 40 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  headerCopy: { flex: 1, marginLeft: 14 },
  closeButton: { alignItems: "center", backgroundColor: "#F0F6F4", borderRadius: 18, height: 40, justifyContent: "center", width: 40 },
  title: { color: "#183B36", fontSize: 21, fontWeight: "800", textAlign: "right" },
  subtitle: { color: "#6A827C", fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: "right" },
  inputLabel: { color: "#41665D", fontSize: 13, fontWeight: "700", marginBottom: 8, textAlign: "right" },
  input: { backgroundColor: "#F7FAF9", borderColor: "#D9E8E3", borderRadius: 14, borderWidth: 1, color: "#183B36", fontSize: 15, marginBottom: 17, minHeight: 52, paddingHorizontal: 15 },
  dateHelp: { color: "#6A827C", fontSize: 11, lineHeight: 17, marginBottom: 9, textAlign: "right" },
  suggestionRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 10 },
  suggestion: { backgroundColor: "#EAF6F3", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  suggestionText: { color: "#0B776B", fontSize: 12, fontWeight: "800" },
  dateRow: { flexDirection: "row-reverse", gap: 9 },
  pickerButton: { alignItems: "center", backgroundColor: "#F7FAF9", borderColor: "#D9E8E3", borderRadius: 14, borderWidth: 1, flex: 1, minHeight: 74, padding: 10 },
  pickerLabel: { color: "#6A827C", fontSize: 11, marginTop: 4 },
  pickerValue: { color: "#183B36", fontSize: 12, fontWeight: "800", marginTop: 5, textAlign: "center" },
  error: { color: "#AE403A", fontSize: 13, marginBottom: 14, textAlign: "right" },
  saveButton: { alignItems: "center", backgroundColor: "#0B776B", borderRadius: 15, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54, marginTop: 6 },
  saveText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
