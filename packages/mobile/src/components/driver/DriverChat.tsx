import { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useMessagesStore, type ChatMessage } from '@/stores/messages';
import { useAuthStore } from '@/stores/auth';
import { useSocket } from '@/hooks/useSocket';
import { C, Size, Spacing, Radius } from '@/theme';

interface DriverChatProps {
  routeId?: string;
  onClose: () => void;
}

export function DriverChat({ routeId, onClose }: DriverChatProps) {
  const { messages, fetchMessages, sendMessage, addMessage } = useMessagesStore();
  const { user } = useAuthStore();
  const socket = useSocket();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages(routeId);
  }, [routeId]);

  // Listen for new messages via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => addMessage(msg);
    socket.on('message:new', handler);
    return () => { socket.off('message:new', handler); };
  }, [socket]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage({ routeId, body: text });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>{'\u2715'}</Text>
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        inverted={false}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item.senderId === user?.id;
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              {!isMe && <Text style={styles.senderName}>{item.senderName || 'Dispatcher'}</Text>}
              <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.body}</Text>
              <Text style={styles.bubbleTime}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No messages yet</Text>
        }
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={C.muted}
          style={styles.input}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
          blurOnSubmit
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim()}
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
        >
          <Text style={styles.sendText}>{'\u2191'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    maxHeight: 500,
    backgroundColor: C.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: C.border,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: Size.lg, fontWeight: '700', color: C.text },
  closeText: { fontSize: 18, color: C.dim, minWidth: 44, textAlign: 'right' },
  list: { padding: Spacing.lg, paddingBottom: 8 },
  bubble: {
    maxWidth: '80%',
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    marginBottom: 8,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: C.accent,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: C.bg3,
  },
  senderName: { fontSize: 11, color: C.dim, marginBottom: 2, fontWeight: '600' },
  bubbleText: { fontSize: Size.md, color: C.text, lineHeight: 20 },
  bubbleTextMe: { color: '#000' },
  bubbleTime: { fontSize: 10, color: C.muted, marginTop: 4, textAlign: 'right' },
  emptyText: { color: C.muted, fontSize: Size.md, textAlign: 'center', paddingVertical: Spacing.xxl },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg2,
  },
  input: {
    flex: 1,
    backgroundColor: C.bg3,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: C.text,
    fontSize: Size.md,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#000', fontSize: 18, fontWeight: '800' },
});
