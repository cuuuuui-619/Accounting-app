import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { StatusBar } from "expo-status-bar";
import { CheckCircle2, Cloud, CloudOff, RefreshCw } from "lucide-react-native";

const AdminApp = React.lazy(() => import("./src/admin/AdminApp"));

import { AppHeader, BottomNav, FloatingMic, type MainTab } from "./src/components";
import { AddRecordScreen, AssistantScreen, DetailsScreen, OverviewScreen } from "./src/screens/MainScreens";
import { BudgetsScreen, LoansScreen, ProfileScreen, ProjectsScreen, type ProfileRoute } from "./src/screens/ProfileScreens";
import { LedgerProvider, useLedger } from "./src/store";
import { colors } from "./src/theme";
import { startWebSpeechRecognition, type WebSpeechController, type WebSpeechScope } from "./src/webSpeech";

const profileTitles: Record<Exclude<ProfileRoute, "profile">, string> = {
  projects: "项目账本",
  loans: "借贷垫付",
  budgets: "预算管理",
};

function isAdminRoute() {
  if (Platform.OS !== "web" || typeof globalThis.location === "undefined") return false;
  const url = new URL(globalThis.location.href);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  return pathname === "/admin" || url.searchParams.get("admin") === "1";
}

function LedgerApp() {
  const { ready, syncStatus, syncNow } = useLedger();
  const [tab, setTab] = useState<MainTab>("details");
  const [profileRoute, setProfileRoute] = useState<ProfileRoute>("profile");
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const webSpeech = useRef<WebSpeechController | null>(null);
  useSpeechRecognitionEvent("start", () => { setListening(true); setSpeechMessage("正在聆听，正常说完一句话即可。"); });
  useSpeechRecognitionEvent("end", () => { setListening(false); setSpeechMessage(""); });
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) setDraft(transcript);
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    setSpeechMessage(event.message || "语音识别暂不可用，请改用文字输入。");
  });

  useEffect(() => () => webSpeech.current?.abort(), []);

  const startOrStopSpeech = async () => {
    setTab("assistant");
    setProfileRoute("profile");
    if (listening) {
      if (Platform.OS === "web") webSpeech.current?.stop();
      else ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (Platform.OS === "web") {
      const controller = startWebSpeechRecognition(globalThis as unknown as WebSpeechScope, {
        onStart: () => { setListening(true); setSpeechMessage("正在聆听，正常说完一句话即可。"); },
        onResult: setDraft,
        onEnd: () => { webSpeech.current = null; setListening(false); setSpeechMessage(""); },
        onError: (message) => {
          webSpeech.current = null;
          setListening(false);
          setSpeechMessage(message === "not-allowed" ? "浏览器未获得麦克风权限，也可以使用 iPhone 键盘听写。" : "语音识别暂不可用，请使用 iPhone 键盘听写或直接输入。");
        },
      });
      if (!controller) {
        setSpeechMessage("当前浏览器不支持网页语音识别，请使用 iPhone 键盘听写或直接输入。");
        return;
      }
      webSpeech.current = controller;
      return;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setSpeechMessage("当前运行环境没有系统语音识别，请在 iPhone 开发版本中使用，或直接输入文字。");
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setSpeechMessage("需要麦克风与语音识别权限；也可以直接输入文字完成记账。");
      return;
    }
    const onDevice = Platform.OS === "ios" && ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    ExpoSpeechRecognitionModule.start({ lang: "zh-CN", interimResults: true, continuous: false, requiresOnDeviceRecognition: onDevice });
  };

  const changeTab = (next: MainTab) => {
    setTab(next);
    if (next !== "profile") setProfileRoute("profile");
  };

  const title = tab === "profile" && profileRoute !== "profile" ? profileTitles[profileRoute] : undefined;

  const syncAction = (
    <Pressable
      accessibilityLabel="云同步"
      onPress={() => { void syncNow().catch(() => undefined); }}
      style={({ pressed }) => [styles.syncBadge, pressed && styles.pressed]}
    >
      {syncStatus === "syncing" ? (
        <RefreshCw size={14} color={colors.primary} />
      ) : syncStatus === "synced" ? (
        <CheckCircle2 size={14} color={colors.income} />
      ) : syncStatus === "offline" || syncStatus === "error" ? (
        <CloudOff size={14} color={colors.amber} />
      ) : (
        <Cloud size={14} color={colors.primary} />
      )}
      <Text style={[styles.syncText, { color: syncStatus === "synced" ? colors.income : syncStatus === "error" || syncStatus === "offline" ? colors.amber : colors.primary }]}>
        {syncStatus === "synced" ? "已同步" : syncStatus === "syncing" ? "上传中" : syncStatus === "offline" ? "离线" : syncStatus === "error" ? "重试" : "同步云端"}
      </Text>
    </Pressable>
  );

  if (!ready) return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <AppHeader title={title} subtitle={title ? undefined : "聪明一点，也克制一点"} back={Boolean(title)} onBack={() => setProfileRoute("profile")} action={syncAction} />
        <View style={styles.flex}>
          {tab === "details" ? <DetailsScreen /> : null}
          {tab === "overview" ? <OverviewScreen /> : null}
          {tab === "add" ? <AddRecordScreen onSaved={() => setTab("details")} /> : null}
          {tab === "assistant" ? <AssistantScreen draft={draft} setDraft={setDraft} listening={listening} onListen={startOrStopSpeech} speechMessage={speechMessage} /> : null}
          {tab === "profile" && profileRoute === "profile" ? <ProfileScreen onNavigate={setProfileRoute} /> : null}
          {tab === "profile" && profileRoute === "projects" ? <ProjectsScreen /> : null}
          {tab === "profile" && profileRoute === "loans" ? <LoansScreen /> : null}
          {tab === "profile" && profileRoute === "budgets" ? <BudgetsScreen /> : null}
        </View>
        <FloatingMic listening={listening} onPress={startOrStopSpeech} />
        <BottomNav active={tab} onChange={changeTab} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  if (isAdminRoute()) {
    return <React.Suspense fallback={<View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>}><AdminApp /></React.Suspense>;
  }
  return <LedgerProvider><LedgerApp /></LedgerProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  syncBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  syncText: { fontSize: 12, fontWeight: "600" },
  pressed: { opacity: 0.8 },
});
