import { useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNLOpsStore, type NLOpsMessage } from '@/stores/nlops';
import { C, Size, Spacing, Radius, alpha, Base } from '@/theme';

const SUGGESTIONS = [
  'How many deliveries are left today?',
  'Which drivers are available?',
  'Show me failed deliveries',
  'What\'s the delivery rate this week?',
];

export default function AIChatScreen() {
  const { messages, loading, send, confirm, deny, clear } = useNLOpsStore();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');
    await send(msg);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI Copilot</Text>
          <Text style={styles.subtitle}>Talk to your fleet</Text>
        </View>
        {messages.length > 0 && (
          <Pressable onPress={clear} hitSlop={12}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => <MessageBubble msg={item} onConfirm={confirm} onDeny={deny} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Ask HOMER anything</Text>
              <Text style={styles.emptyHint}>
                Use natural language to query your fleet, check stats, or take actions.
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} onPress={() => handleSend(s)} style={styles.suggestionPill}>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
        />

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask HOMER..."
            placeholderTextColor={C.muted}
            style={styles.input}
            multiline
            maxLength={2000}
            editable={!loading}
            onSubmitEditing={() => handleSend()}
            blurOnSubmit
          />
          {loading ? (
            <View style={styles.loadingBtn}>
              <ActivityIndicator size="small" color={C.accent} />
            </View>
          ) : (
            <Pressable
              onPress={() => handleSend()}
              disabled={!input.trim()}
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            >
              <Text style={styles.sendText}>{'\u2191'}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ msg, onConfirm, onDeny }: {
  msg: NLOpsMessage;
  onConfirm: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  if (msg.role === 'user') {
    return (
      <View style={[bubbleStyles.bubble, bubbleStyles.user]}>
        <Text style={bubbleStyles.userText}>{msg.content}</Text>
      </View>
    );
  }

  if (msg.confirmation) {
    return (
      <View style={[bubbleStyles.bubble, bubbleStyles.confirmation]}>
        <Text style={bubbleStyles.confirmTitle}>{msg.confirmation.toolName}</Text>
        <Text style={bubbleStyles.confirmExplain}>{msg.confirmation.explanation}</Text>
        <View style={bubbleStyles.confirmActions}>
          <Pressable onPress={() => onDeny(msg.confirmation!.actionId)} style={bubbleStyles.denyBtn}>
            <Text style={bubbleStyles.denyText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => onConfirm(msg.confirmation!.actionId)} style={bubbleStyles.approveBtn}>
            <Text style={bubbleStyles.approveText}>Confirm</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (msg.actionResult) {
    return (
      <View style={[bubbleStyles.bubble, bubbleStyles.actionResult, msg.actionResult.success ? bubbleStyles.actionSuccess : bubbleStyles.actionFail]}>
        <Text style={[bubbleStyles.actionText, { color: msg.actionResult.success ? C.green : C.red }]}>
          {msg.actionResult.success ? '✓' : '✗'} {msg.actionResult.summary}
        </Text>
      </View>
    );
  }

  // Assistant message
  return (
    <View style={[bubbleStyles.bubble, bubbleStyles.assistant]}>
      {/* Tool activity indicators */}
      {msg.toolActivities && msg.toolActivities.length > 0 && (
        <View style={bubbleStyles.tools}>
          {msg.toolActivities.map((ta) => (
            <View key={ta.toolCallId} style={bubbleStyles.toolRow}>
              <Text style={bubbleStyles.toolDot}>{ta.status === 'running' ? '⏳' : '✓'}</Text>
              <Text style={bubbleStyles.toolName}>{ta.name}</Text>
              {ta.durationMs != null && <Text style={bubbleStyles.toolTime}>{ta.durationMs}ms</Text>}
            </View>
          ))}
        </View>
      )}
      {msg.content ? (
        <Text style={bubbleStyles.assistantText}>{msg.content}</Text>
      ) : null}
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  bubble: { maxWidth: '85%', padding: 12, paddingHorizontal: 14, borderRadius: Radius.lg, marginBottom: 10 },
  user: { alignSelf: 'flex-end', backgroundColor: C.accent },
  userText: { color: '#000', fontSize: Size.md, lineHeight: 20 },
  assistant: { alignSelf: 'flex-start', backgroundColor: C.bg3 },
  assistantText: { color: C.text, fontSize: Size.md, lineHeight: 21 },
  tools: { marginBottom: 8, gap: 4 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolDot: { fontSize: 12 },
  toolName: { fontSize: Size.sm, color: C.dim, fontWeight: '500' },
  toolTime: { fontSize: 10, color: C.muted },
  confirmation: { alignSelf: 'flex-start', backgroundColor: alpha(C.accent, 0.1), borderWidth: 1, borderColor: C.accent, maxWidth: '90%' },
  confirmTitle: { fontSize: Size.md, fontWeight: '700', color: C.accent, marginBottom: 4 },
  confirmExplain: { fontSize: Size.sm, color: C.text, lineHeight: 18, marginBottom: 12 },
  confirmActions: { flexDirection: 'row', gap: 8 },
  denyBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: C.muted, alignItems: 'center' },
  denyText: { color: C.dim, fontSize: Size.sm, fontWeight: '500' },
  approveBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: C.accent, alignItems: 'center' },
  approveText: { color: '#000', fontSize: Size.sm, fontWeight: '600' },
  actionResult: { alignSelf: 'flex-start', maxWidth: '90%' },
  actionSuccess: { backgroundColor: alpha(C.green, 0.08), borderWidth: 1, borderColor: alpha(C.green, 0.19) },
  actionFail: { backgroundColor: alpha(C.red, 0.08), borderWidth: 1, borderColor: alpha(C.red, 0.19) },
  actionText: { fontSize: Size.md, fontWeight: '500' },
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  title: { fontSize: Size.xxl, fontWeight: '700', color: C.text },
  subtitle: { fontSize: Size.sm, color: C.dim, marginTop: 2 },
  clearText: { color: C.accent, fontSize: Size.sm, fontWeight: '600' },
  list: { padding: Spacing.lg, paddingBottom: 8 },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxxl },
  emptyTitle: { fontSize: Size.lg, fontWeight: '600', color: C.text, marginBottom: 8 },
  emptyHint: { fontSize: Size.md, color: C.muted, textAlign: 'center', paddingHorizontal: Spacing.xxl, lineHeight: 20, marginBottom: Spacing.xxl },
  suggestions: { gap: 8, width: '100%', paddingHorizontal: Spacing.lg },
  suggestionPill: { backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 16 },
  suggestionText: { color: C.dim, fontSize: Size.md },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg2 },
  input: { flex: 1, backgroundColor: C.bg3, borderRadius: Radius.lg, paddingVertical: 10, paddingHorizontal: 14, color: C.text, fontSize: Size.md, maxHeight: 100 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#000', fontSize: 18, fontWeight: '800' },
  loadingBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg3, alignItems: 'center', justifyContent: 'center' },
});
