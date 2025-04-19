<template>
  <div class="chat-footer">
    <div class="button-row">
      <div class="new-chat-container">
        <button class="new-chat-btn" @click="handleNewConversation">
          <i class="fa-regular fa-message"></i>
          <span>新建对话</span>
        </button>
      </div>
      <!-- <div class="travel-main-btn-container">
        <button 
          class="travel-main-btn" 
          :class="{ selected: currentPreference !== null }"
          @click="toggleTravelOptions"
        >
          <i :class="currentPreferenceIcon"></i>
          <span>{{ currentPreferenceText }}</span>
        </button>
        <div class="travel-preference-dropdown" v-if="showTravelOptions">
          <div class="dropdown-option" @click="handleTravelPreference('drive')">
            <i class="fa-solid fa-car"></i>
            <span>驾车</span>
          </div>
          <div class="dropdown-option" @click="handleTravelPreference('bus')">
            <i class="fa-solid fa-bus"></i>
            <span>公交</span>
          </div>
          <div class="dropdown-option" @click="handleTravelPreference('bike')">
            <i class="fa-solid fa-bicycle"></i>
            <span>骑行</span>
          </div>
          <div class="dropdown-option" @click="handleTravelPreference('walk')">
            <i class="fa-solid fa-person-walking"></i>
            <span>步行</span>
          </div>
        </div>
      </div> -->
      <div class="route-btn-container">
        <button class="route-btn" @click="handleRoutePlanning">
          <i class="fa-solid fa-route"></i>
          <span>路径规划</span>
        </button>
      </div>
    </div>
    <div class="input-container">
      <input 
        type="text" 
        class="chat-input" 
        v-model="inputMessage" 
        placeholder="输入消息..."
        @keyup.enter="handleSend"
      >
      <button 
        class="chat-send-btn" 
        :class="{ loading: isLoading }" 
        @click="isLoading ? handleStop() : handleSend()"
        :disabled="!isLoading && !inputMessage.trim()"
      >
        <span v-if="!isLoading">发送</span>
        <i v-else class="fa-regular fa-circle-stop"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// import { ref, computed } from 'vue';
import { ref } from 'vue';

interface Props {
  isLoading: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'send', message: string): void;
  (e: 'newConversation'): void;
  (e: 'stopResponse'): void;
  (e: 'travelPreference', preference: string): void;
  (e: 'routePlanning'): void;
}>();

const inputMessage = ref('');
// const showTravelOptions = ref(false);
// const currentPreference = ref<string | null>(null); // 修改为联合类型

// const currentPreferenceIcon = computed(() => {
//   return currentPreference.value === null ? 'fa-solid fa-question' : {
//     'drive': 'fa-solid fa-car',
//     'bus': 'fa-solid fa-bus',
//     'bike': 'fa-solid fa-bicycle',
//     'walk': 'fa-solid fa-person-walking'
//   }[currentPreference.value];
// });

// const currentPreferenceText = computed(() => {
//   return currentPreference.value === null ? '出行偏好' : {
//     'drive': '出行：驾车',
//     'bus': '出行：公交', 
//     'bike': '出行：骑行',
//     'walk': '出行：步行'
//   }[currentPreference.value];
// });

// const handleTravelPreference = (preference: string) => {
//   currentPreference.value = preference;
//   showTravelOptions.value = false;
//   emit('travelPreference', preference);
// };

// const toggleTravelOptions = () => {
//   showTravelOptions.value = !showTravelOptions.value;
// };

const handleSend = () => {
  if (!inputMessage.value.trim() || props.isLoading) return;
  emit('send', inputMessage.value);
  inputMessage.value = '';
};

const handleNewConversation = () => {
  emit('newConversation');
};

const handleStop = () => {
  emit('stopResponse');
};
const handleRoutePlanning = () => {
  console.log('路径规划按钮被点击');
  emit('routePlanning');
};
</script>

<style scoped>
.chat-footer {
  border-top: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.button-row {
  display: flex;
  gap: 12px; /* 增加按钮之间的间距 */
  padding: 0 6px; /* 添加左右内边距 */
}

.new-chat-container {
  position: relative;
  display: flex;
  /* 移除原有的gap: 8px; 因为现在由.button-row控制间距 */
}

.travel-main-btn-container {
  position: relative;
  display: flex;
  /* 移除原有的gap: 8px; 因为现在由.button-row控制间距 */
}

.input-container {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}

.new-chat-container {
  position: relative;
  display: flex;
  gap: 8px;
}

.travel-main-btn-container {
  position: relative;
  display: flex;
  gap: 8px;
}

.new-chat-btn, .travel-main-btn, .dropdown-option, .route-btn{
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 1px 4px;
  border: 1px solid #cbcbcb;
  border-radius: 5px;
  background-color: #ffffff;
  color: #000000;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.7rem;
  height: 25px;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.new-chat-btn:active, .travel-preference-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  color: #1773ec;
}

.travel-preference-dropdown {
  position: absolute;
  bottom: 100%; /* 修改为在按钮上方显示 */
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  border: 1px solid #cbcbcb;
  border-radius: 5px;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 10;
  width: 100%;
  margin-bottom: 4px; /* 添加与按钮的间距 */
}

.travel-main-btn-container {
  position: relative;
  display: flex;
  gap: 8px;
}

.new-chat-btn, .travel-main-btn, .dropdown-option, .route-btn{
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 1px 4px;
  border: 1px solid #cbcbcb;
  border-radius: 5px;
  background-color: #ffffff;
  color: #000000;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.7rem;
  height: 25px;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  &.selected {
    background-color: #67b3f6;
    color: #ffffff;
    border-color: #1773ec;
  }
}

.new-chat-btn:active, .travel-main-btn:active, .route-btn:active {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  color: #1773ec;
  border-color: #1773ec;
  background-color: #67b3f6; /* 新增：与下拉选项悬停效果一致 */
}

.travel-main-btn:hover {
  background-color: #6ba4f0;
}

.dropdown-option:hover {
  background-color: #67b3f6;
}

.dropdown-option i {
  font-size: 0.9rem;
  color: #373737;
}

.new-chat-btn i {
  font-size: 0.9rem;
  color: #373737;
}

/* .route-btn {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  padding: 0;
  &:active {
    background-color: #67b3f6;
    color: white;
    border-color: #1773ec;
  }
} */

/* 
.route-btn i {
  font-size: 0.9rem;
  color: #373737;
} */

.chat-input {
  background: #ffffff;
  -webkit-appearance: none;
  appearance: none;
  color: #000000;
  flex: 1;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 5px;
  outline: none;
  font-size: 0.9rem;
}

.chat-send-btn {
  padding: 4px 8px;
  border: none;
  background-color: #1773ec;
  color: #fff;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.9rem;
}

.chat-send-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.chat-send-btn.loading {
  position: relative;
  color: #fff;
  background-color: #dc3545;
  padding: 4px 8px;  /* 新增：确保与普通状态按钮padding一致 */
  min-width: 48px;   /* 新增：设置最小宽度，确保大小一致 */
}

.chat-send-btn.loading i {
  position: relative;
  z-index: 2;
  font-size: 0.9rem;  /* 修改：与普通按钮字体大小保持一致 */
}
</style>