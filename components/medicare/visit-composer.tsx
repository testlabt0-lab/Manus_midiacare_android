import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

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
  const [scheduledStart, setScheduledStart] = useState("");
  const [error, setError] = useState("");

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
      setScheduledStart("");
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
            <TextInput
              value={scheduledStart}
              onChangeText={(value) => { setScheduledStart(value); setError(""); }}
              placeholder="2026-08-26T14:30"
              placeholderTextColor="#93A7A1"
              style={styles.input}
              textAlign="right"
              returnKeyType="done"
              onSubmitEditing={() => void save()}
            />
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
  error: { color: "#AE403A", fontSize: 13, marginBottom: 14, textAlign: "right" },
  saveButton: { alignItems: "center", backgroundColor: "#0B776B", borderRadius: 15, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54, marginTop: 6 },
  saveText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
