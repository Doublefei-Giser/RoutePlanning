<template>
  <div class="panel" ref="panelRef" :style="panelStyle">
    <div class="handle" ref="handleRef" @mousedown="startDragging" @touchstart="startDragging">
      <div class="sidebar-toggle" @click.stop="toggleSidebar">
        <i class="fas fa-bars"></i>
      </div>
      <div class="bar"></div>
      <div 
      v-if="isSidebarOpen" 
      class="sidebar-overlay" 
      @click="toggleSidebar"
    ></div>
    <Sidebar 
      :is-open="isSidebarOpen" 
      :conversations="conversations"
      @select="loadConversation"
      @delete="deleteConversation"
    />
      <div class="handle-title">地百通</div>
    </div>
    <div class="chat-container">
      <div class="chat-body" ref="chatWindowRef">
        <div v-for="(message, index) in messages" :key="index" 
             :class="['chat-message', message.type]">
          <div class="bubble" v-if="message.type === 'right'">{{ message.content }}</div>
          <div v-else>
            <div class="bubble markdown-body" v-html="renderMarkdown(getDisplayContent(message, index))"></div>
          </div>
        </div>
      </div>
      <ChatFooter 
        :is-loading="isLoading"
        @send="sendMessage"
        @new-conversation="startNewConversation"
        @stop-response="stopResponse"
        @routePlanning="handleRoutePlanning"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { marked } from 'marked';
import { v4 as uuidv4 } from 'uuid';
import { normalClient } from '../api';
import Sidebar from './Sidebar.vue';
import ChatFooter from './ChatFooter.vue';


interface Props {
  initialMessage?: string;
  panelHeight?: number;
  minTransform?: number;
  maxTransform?: number;
}

interface Coordinate {
  lat: number;
  lng: number;
}

interface Message {
  type: 'left' | 'right';
  content: string;
  hasReasoning?: boolean;
}


const props = withDefaults(defineProps<Props>(), {
  initialMessage: '',
  panelHeight: 70,
  minTransform: 0,
  maxTransform: 66
});

// 状态管理
const messages = ref<Message[]>([]);
const inputMessage = ref('');
const isLoading = ref(false);
const transform = ref(0);
const threadId = ref<string | undefined>(undefined); // 添加 threadId 状态
const reasoningVisible = ref<Record<number, boolean>>({}); // 添加控制思考内容显示的状态
const coordinates = ref<Coordinate[]>([]); // 存储提取的经纬度数据


// DOM 引用
const panelRef = ref<HTMLElement | null>(null);
const handleRef = ref<HTMLElement | null>(null);
const chatWindowRef = ref<HTMLElement | null>(null);

// 拖拽状态
const isDragging = ref(false);
const startY = ref(0);
const startTransform = ref(0);

// 计算样式
const panelStyle = computed(() => ({
  height: `${props.panelHeight}vh`,
  transform: `translateY(${transform.value}vh)`
}));

// 监听初始消息
watch(() => props.initialMessage, (newMessage) => {
  if (newMessage) {
    messages.value.push({
      type: 'right',
      content: newMessage
    });
    handleResponse(newMessage);
  }
});

// 拖拽处理函数
const startDragging = (e: MouseEvent | TouchEvent) => {
  if (e.target !== handleRef.value) return;
  isDragging.value = true;
  startY.value = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
  startTransform.value = transform.value;
  e.preventDefault();
};

const handleDragging = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return;
  const currentY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
  const dy = currentY - startY.value;
  
  // 移除最小移动距离判断，直接计算transform值
  const windowHeight = window.innerHeight;
  const movePercent = (dy / windowHeight) * 100*1.2;
  transform.value = Math.min(
    props.maxTransform,
    Math.max(props.minTransform, startTransform.value + movePercent)
  );
};

const stopDragging = () => {
  isDragging.value = false;
};

// 消息处理
const sendMessage = async (message: string) => {
  if (!message.trim() || isLoading.value) return;
  
  messages.value.push({
    type: 'right',
    content: message
  });
  scrollToBottom();
  await handleResponse(message);
};

const client = normalClient;
// 添加侧边栏状态
const isSidebarOpen = ref(false);
const conversations = ref<Array<{
  id: string;
  messages: Message[];
  threadId?: string;
  timestamp: number;
}>>([]);

// 加载历史对话
onMounted(() => {
  // 添加现有的事件监听器
  document.addEventListener('mousemove', handleDragging);
  document.addEventListener('mouseup', stopDragging);
  document.addEventListener('touchmove', handleDragging);
  document.addEventListener('touchend', stopDragging);
  // 从本地存储加载对话
  const savedConversations = localStorage.getItem('conversations');
  if (savedConversations) {
    conversations.value = JSON.parse(savedConversations);
  }
});

// 切换侧边栏
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const saveConversation = () => {
  if (messages.value.length > 0) {
    // 如果是现有会话，更新它
    if (currentConversationId.value) {
      const index = conversations.value.findIndex(c => c.id === currentConversationId.value);
      if (index !== -1) {
        conversations.value[index].messages = [...messages.value];
        conversations.value[index].timestamp = Date.now();
        conversations.value[index].threadId = threadId.value; // 确保更新threadId
        // 将更新的会话移到顶部
        const updatedConversation = conversations.value.splice(index, 1)[0];
        conversations.value.unshift(updatedConversation);
      }
    } else {
      // 创建新会话
      const conversation = {
        id: uuidv4(),
        messages: [...messages.value],
        threadId: threadId.value, // 保存threadId
        timestamp: Date.now()
      };
      currentConversationId.value = conversation.id;
      conversations.value = [conversation, ...conversations.value];
    }
    
    localStorage.setItem('conversations', JSON.stringify(conversations.value));
  }
};
const loadConversation = (conversation: {
  id: string;
  messages: Message[];
  threadId?: string; // 添加可选的threadId
  timestamp: number;
}) => {
  messages.value = [...conversation.messages];
  threadId.value = conversation.threadId; // 恢复threadId
  currentConversationId.value = conversation.id; // 设置当前会话ID
  isSidebarOpen.value = false;
};

// 修改新建对话函数
const startNewConversation = () => {
  // 如果当前有对话且有变化，先保存
  if (currentConversationId.value && messages.value.length > 0) {
    saveConversation();
  }
  
  // 清空当前消息
  messages.value = [];
  // 重置输入框
  inputMessage.value = '';
  // 重置线程ID
  threadId.value = undefined;
  // 重置当前会话ID
  currentConversationId.value = undefined;
  // 滚动到底部
  scrollToBottom();
};

const abortController = ref<AbortController | null>(null);

// 修改停止响应的方法
const stopResponse = () => {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
    isLoading.value = false;
    
    // 添加一条消息表示响应已被中断
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].type === 'left') {
      messages.value[messages.value.length - 1].content += '\n\n*回复已被中断*';
    }
    
    // 确保保存当前对话状态
    saveConversation();
  }
};

// 修改 handleResponse 函数
const extractCoordinates = (content: string): Coordinate[] => {
  try {
    // 首先尝试解析JSON格式
    try {
      const data = JSON.parse(content);
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((item: any) => {
          if (item.location) {
            const [lng, lat] = item.location.split(',').map(parseFloat);
            return { lat, lng };
          }
          return null;
        }).filter(Boolean);
      }
    } catch (jsonError) {
      // JSON解析失败，尝试使用正则表达式提取坐标
      const coordPattern = /经度[:：]\s*([\d.]+)\s*[,，]\s*纬度[:：]\s*([\d.]+)/g;
      const coordinates: Coordinate[] = [];
      let match;

      while ((match = coordPattern.exec(content)) !== null) {
        const lng = parseFloat(match[1]);
        const lat = parseFloat(match[2]);
        if (!isNaN(lng) && !isNaN(lat)) {
          coordinates.push({ lng, lat });
        }
      }

      if (coordinates.length > 0) {
        return coordinates;
      }
    }
  } catch (e) {
    console.error('Failed to extract coordinates', e);
  }
  return [];
};

const handleResponse = async (message: string) => {
  isLoading.value = true;
  transform.value = props.minTransform;
  abortController.value = new AbortController();

  try {
    const request = {
      threadId: threadId.value,
      message: {
        content: {
          type: 'text',
          value: {
            showText: message
          }
        }
      },
      openId: 'user_123',
      signal: abortController.value.signal
    };

    let responseText = '';

    try {
      for await (const event of client.conversationStream({
        ...request,
        message: {
          content: {
            type: 'text' as const,
            value: {
              showText: message
            }
          }
        }
      })) {
        if (abortController.value === null) break;

        switch (event.event) {
          case 'conversation.chat.created':
          case 'conversation.chat.in_progress':
            if (!threadId.value && event.data.conversation_id) {
              threadId.value = event.data.conversation_id;
            }
            break;

          case 'conversation.message.delta':
            if (event.data.content) {
              responseText += event.data.content;
              updateOrAddMessage('left', responseText);
              scrollToBottom();
            }
            break;

          case 'conversation.message.completed':
            if (event.data.type === 'tool_response') {
              const coords = extractCoordinates(event.data.content || '');
              if (coords.length > 0) {
                coordinates.value = [...coordinates.value, ...coords];
              }
            }
            break;

          case 'conversation.chat.completed':
            console.log('Chat completed:', event.data);
            if (abortController.value !== null) {
              saveConversation();
            }
            break;
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('请求已被用户中断');
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Error:', error);
    messages.value.push({
      type: 'left',
      content: '抱歉，发生了一些错误，请稍后重试。'
    });
  } finally {
    isLoading.value = false;
    scrollToBottom();
    abortController.value = null;
  }
};

// 修改 updateOrAddMessage 函数
const updateOrAddMessage = (type: 'left' | 'right', content: string,  hasReasoning = false) => {
const newCoords = extractCoordinates(content);
if (newCoords.length > 0) {
  coordinates.value = [...coordinates.value, ...newCoords];
}

if (messages.value.length > 0 && messages.value[messages.value.length - 1].type === type) {
    // 使用 setTimeout 逐步显示内容
    let currentContent = messages.value[messages.value.length - 1].content;
    const newContent = content;
    const interval = 15; 
    let index = currentContent.length;

    const showNextChar = () => {
      if (index < newContent.length) {
        currentContent += newContent[index];
        messages.value[messages.value.length - 1].content = currentContent;
        index++;
        setTimeout(showNextChar, interval);
      } else {
        messages.value[messages.value.length - 1].hasReasoning = hasReasoning;
      }
    };

    showNextChar();
  } else {
    messages.value.push({
      type,
      content,
      hasReasoning
    });
  }
};
// 添加处理显示内容的方法
const getDisplayContent = (message: Message, index: number) => {
  if (!message.hasReasoning || !message.content.includes('\n\n')) {
    return message.content;
  }
  
  // 如果是推理内容且需要折叠
  if (!reasoningVisible.value[index]) {
    // 分离引用块和正常回答
    const parts = message.content.split('\n\n');
    // 只返回非引用块部分
    return parts.slice(1).join('\n\n');
  }
  
  return message.content;
};

const scrollToBottom = () => {
  if (chatWindowRef.value) {
    chatWindowRef.value.scrollTop = chatWindowRef.value.scrollHeight;
  }
};
const currentConversationId = ref<string | undefined>(undefined);

// 生命周期钩子
onMounted(() => {
  document.addEventListener('mousemove', handleDragging);
  document.addEventListener('mouseup', stopDragging);
  document.addEventListener('touchmove', handleDragging);
  document.addEventListener('touchend', stopDragging);
  const savedConversations = localStorage.getItem('conversations');
  if (savedConversations) {
    conversations.value = JSON.parse(savedConversations);
  }
  
  // 创建新会话
  startNewConversation();
});

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDragging);
  document.removeEventListener('mouseup', stopDragging);
  document.removeEventListener('touchmove', handleDragging);
  document.removeEventListener('touchend', stopDragging);
});

// 配置 marked
marked.setOptions({
  breaks: true,    // 允许换行
  gfm: true,       // 启用 GitHub 风格的 Markdown
});

// 添加 Markdown 渲染函数
const renderMarkdown = (content: string) => {
  // 处理换行符，确保正确渲染
  const processedContent = content.replace(/\\n/g, '\n').replace(/\n/g, '  \n');
  return marked.parse(processedContent, { breaks: true });
};

const deleteConversation = (conversationId: string) => {
  // 从conversations数组中删除对话
  conversations.value = conversations.value.filter(c => c.id !== conversationId);
  
  // 如果删除的是当前对话，清空当前对话
  if (currentConversationId.value === conversationId) {
    startNewConversation();
  }
  
  // 更新本地存储
  localStorage.setItem('conversations', JSON.stringify(conversations.value));
};

// 修改handleRoutePlanning方法
const handleRoutePlanning = () => {
  // 触发路径规划事件
  emit('planRoute', coordinates.value);
};

// 添加emit定义
const emit = defineEmits<{
  (e: 'planRoute', coordinates: Coordinate[]): void;
}>();
</script>

<style scoped>
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 999;
}
/* 添加新的样式 */
.sidebar-toggle {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  font-size: 0.9rem;
  color: #333;
  padding: 5px;
}

.sidebar-toggle:hover {
  color: #1773ec;
}
.handle {
  width: 100%;
  height: 4.5vh;
  background-image: linear-gradient(to bottom, rgb(178, 202, 252), white);
  border-radius: 15px 15px 0 0;
  margin: 0;
  cursor: pointer;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-shadow: 
    0 -9px 10px -2px rgba(0, 0, 0, 0.1),
    0 -4px 8px -2px rgba(0, 0, 0, 0.06);
  -webkit-tap-highlight-color: transparent; /* 添加这行，禁用移动端点击时的高亮效果 */
  user-select: none; /* 添加这行，防止文本被选中 */
}

/* 添加这些样式来处理触摸状态 */
.handle:active,
.handle:hover {
  background-image: linear-gradient(to bottom, rgb(178, 202, 252), white);
}

/* 添加媒体查询，专门处理移动端 */
@media (hover: none) and (pointer: coarse) {
  .handle {
    -webkit-touch-callout: none; /* 禁用iOS长按菜单 */
  }
}
.bar {
  width: 40px;
  height: 5px;
  background-color: #ccc;
  border-radius: 5px;
  margin: 5px auto 2px;
}
.handle-title {
  font-size: 0.9rem;
  color: #333;
  font-weight: 500;
  margin-bottom: 3px;
}
.chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  margin-top: 20px;
}

.chat-body {
  flex: 1;
  overflow-y: auto;
  padding-top: 30px;
}
.chat-message {
  margin-bottom: 10px;
  display: flex;
}
.chat-message.right {
  justify-content: flex-end;
}
.chat-message.left {
  justify-content: flex-start;
}
.chat-message .bubble {
  color: #000000;
  display: inline-block;
  padding: 8px 12px;
  border-radius: 5px;
  max-width: 100%;
  word-wrap: break-word;
  background-color: #e5e5e5;
  font-size: 0.8rem;
  text-align: left;  /* 添加这行确保文本左对齐 */
}
.chat-message.right .bubble {
  background-color: #a0e75a;
}
.markdown-body {
  text-align: left;
}
.markdown-body :deep(h1) {
  margin: 0;
  font-size: 1rem;  /* 调整 h1 的大小 */
  line-height: 1.4;
}

.markdown-body :deep(h2) {
  margin: 0;
  font-size: 0.9rem;  /* 调整 h2 的大小 */
  line-height: 1.3;
}
.markdown-body :deep(h3) {
  margin: 0;
}
.markdown-body :deep(p) {
  margin: 0;
}
.markdown-body :deep(ul) {
  margin: 0;
  padding-left: 15px;
}
.markdown-body :deep(ol) {
  margin: 0;
  padding-left: 15px;
}
.markdown-body :deep(blockquote) {
  font-size: 0.7rem;
}
.markdown-body :deep(pre) {
  margin: 8px 0;
  padding: 8px;
  background-color: #f6f8fa;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;  /* 添加这行以确保长代码可以换行 */
  word-break: break-all;  /* 添加这行以确保长单词可以换行 */
}
.markdown-body :deep(code) {
  font-family: Consolas, Monaco, 'Andale Mono', monospace;
  font-size: 0.9em;
  background-color: #f6f8fa;  /* 添加这行为内联代码提供背景色 */
  padding: 2px 4px;          /* 添加这行为内联代码提供内边距 */
  border-radius: 3px;        /* 添加这行为内联代码提供圆角 */
}
.markdown-body :deep(a) {
  color: #0366d6;
  text-decoration: none;
}
.markdown-body :deep(a:hover) {
  text-decoration: underline;
}
.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
}
.markdown-body :deep(table) {
  border-collapse: separate;  /* 改为 separate 以支持圆角 */
  border-spacing: 0;         /* 确保单元格之间没有间隔 */
  width: 100%;
  margin: 8px 0;
  border-radius: 8px;        /* 添加整体圆角 */
  overflow: hidden; 
  border: 1px solid #3c3b3b;         /* 确保内容不会超出圆角 */
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #6c6b6b;
  padding: 6px;
}
/* 处理第一行的圆角 */
.markdown-body :deep(tr:first-child th:first-child) {
  border-top-left-radius: 8px;
}
.markdown-body :deep(tr:first-child th:last-child) {
  border-top-right-radius: 8px;
}
/* 处理最后一行的圆角 */
.markdown-body :deep(tr:last-child td:first-child) {
  border-bottom-left-radius: 8px;
}
.markdown-body :deep(tr:last-child td:last-child) {
  border-bottom-right-radius: 8px;
}
.markdown-body :deep(blockquote) {
  margin: 8px 0;
  padding-left: 1em;
  border-left: 4px solid #ddd;
  color: #666;
}
.markdown-body :deep(br) {
  display: block;
  content: "";
  margin: 8px 0;
}

</style>