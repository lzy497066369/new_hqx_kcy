<script lang="ts" setup>
import type { AiApi } from '#/api';

import { computed, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, Card, Empty, Tag } from 'antdv-next';

import { streamAiChatTest } from '#/api';

const router = useRouter();
const inputMessage = shallowRef('');
const loading = shallowRef(false);
const errorMessage = shallowRef('');
const lastTaskId = shallowRef('');
const messages = shallowRef<AiApi.AiChatMessage[]>([
  {
    content: '你好，我是 AI 对话测试入口。这里的请求和返回会完整写入 AI 请求记录。',
    role: 'assistant',
  },
]);

const canSend = computed(() => inputMessage.value.trim().length > 0 && !loading.value);

async function sendMessage() {
  const content = inputMessage.value.trim();
  if (!content || loading.value) {
    return;
  }

  const nextMessages: AiApi.AiChatMessage[] = [
    ...messages.value,
    { content, role: 'user' },
  ];
  messages.value = nextMessages;
  inputMessage.value = '';
  loading.value = true;
  errorMessage.value = '';
  const assistantIndex = nextMessages.length;
  messages.value = [
    ...nextMessages,
    {
      content: '',
      role: 'assistant',
    },
  ];

  try {
    await streamAiChatTest(
      { messages: nextMessages },
      {
        onDelta: (delta) => {
          const streamingMessages = [...messages.value];
          const assistantMessage = streamingMessages[assistantIndex];
          if (!assistantMessage) {
            return;
          }
          streamingMessages[assistantIndex] = {
            ...assistantMessage,
            content: `${assistantMessage.content}${delta}`,
          };
          messages.value = streamingMessages;
        },
        onDone: (result) => {
          lastTaskId.value = result.task.id;
        },
        onError: (message) => {
          errorMessage.value = message;
        },
      },
    );
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    const assistantMessage = messages.value[assistantIndex];
    if (errorMessage.value && assistantMessage?.content === '') {
      messages.value = messages.value.slice(0, assistantIndex);
    }
    loading.value = false;
  }
}

function clearChat() {
  messages.value = [];
  inputMessage.value = '';
  errorMessage.value = '';
  lastTaskId.value = '';
}

function navToRecord() {
  router.push('/system/ai-record').catch(() => {});
}

function roleLabel(role: AiApi.AiChatMessage['role']) {
  const labels: Record<AiApi.AiChatMessage['role'], string> = {
    assistant: 'AI',
    system: '系统',
    user: '用户',
  };
  return labels[role];
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const responseMessage = (
      error as { response?: { data?: { message?: unknown } } }
    ).response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage) {
      return responseMessage;
    }

    const payloadMessage = (error as { message?: unknown }).message;
    if (typeof payloadMessage === 'string' && payloadMessage) {
      return payloadMessage;
    }
  }

  return 'AI 对话测试请求失败';
}
</script>

<template>
  <Page auto-content-height>
    <div class="ai-chat-test p-5">
      <section class="ai-chat-test__head">
        <div>
          <div class="text-sm text-sky-700">AI 模块</div>
          <h1 class="mt-1 text-2xl font-semibold text-slate-950">
            AI 对话测试
          </h1>
          <p class="mt-1 text-sm text-slate-600">
            用于验证阿里云百炼调用链路，请求、返回、Token 和耗时会进入 AI 请求记录。
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button @click="navToRecord">
            <IconifyIcon icon="lucide:list-search" class="size-4" />
            请求记录
          </Button>
          <Button @click="clearChat">
            <IconifyIcon icon="lucide:rotate-ccw" class="size-4" />
            清空
          </Button>
        </div>
      </section>

      <Alert
        v-if="errorMessage"
        class="mt-4"
        show-icon
        type="warning"
        :message="errorMessage"
      />

      <Card class="mt-5" variant="borderless">
        <template #title>
          <div class="flex items-center gap-2">
            <IconifyIcon icon="lucide:message-circle" class="size-5 text-sky-600" />
            <span>测试对话</span>
          </div>
        </template>
        <template #extra>
          <Tag v-if="lastTaskId" color="blue">任务 #{{ lastTaskId }}</Tag>
        </template>

        <div class="ai-chat-test__messages">
          <Empty v-if="messages.length === 0" description="暂无对话内容" />
          <div
            v-for="(message, index) in messages"
            :key="`${message.role}-${index}`"
            class="ai-chat-test__message"
            :class="{ 'ai-chat-test__message--user': message.role === 'user' }"
          >
            <Tag :color="message.role === 'user' ? 'blue' : 'green'">
              {{ roleLabel(message.role) }}
            </Tag>
            <div class="ai-chat-test__bubble">
              {{ message.content }}
              <span
                v-if="loading && index === messages.length - 1 && !message.content"
                class="ai-chat-test__typing"
              >
                AI 正在联网检索并生成...
              </span>
            </div>
          </div>
        </div>

        <div class="ai-chat-test__composer">
          <textarea
            v-model="inputMessage"
            class="ai-chat-test__textarea"
            placeholder="输入测试内容，Enter 换行，点击发送调用百炼"
            rows="4"
          ></textarea>
          <Button
            :disabled="!canSend"
            :loading="loading"
            type="primary"
            @click="sendMessage"
          >
            <IconifyIcon icon="lucide:send" class="size-4" />
            发送
          </Button>
        </div>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.ai-chat-test {
  min-height: 100%;
  background: linear-gradient(180deg, rgb(248 250 252) 0%, rgb(241 245 249) 100%);
}

.ai-chat-test__head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: #fff;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.ai-chat-test__messages {
  display: grid;
  min-height: 360px;
  max-height: 52vh;
  gap: 14px;
  padding: 4px;
  overflow: auto;
}

.ai-chat-test__message {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.ai-chat-test__message--user {
  flex-direction: row-reverse;
}

.ai-chat-test__bubble {
  max-width: min(760px, 78%);
  padding: 12px 14px;
  white-space: pre-wrap;
  background: rgb(248 250 252);
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.ai-chat-test__message--user .ai-chat-test__bubble {
  color: #fff;
  background: rgb(2 132 199);
  border-color: rgb(2 132 199);
}

.ai-chat-test__typing {
  color: rgb(71 85 105);
}

.ai-chat-test__composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid rgb(226 232 240);
}

.ai-chat-test__textarea {
  width: 100%;
  min-height: 96px;
  padding: 10px 12px;
  resize: vertical;
  background: #fff;
  border: 1px solid rgb(203 213 225);
  border-radius: 8px;
  outline: none;
}

.ai-chat-test__textarea:focus {
  border-color: rgb(14 165 233);
  box-shadow: 0 0 0 3px rgb(14 165 233 / 15%);
}

@media (max-width: 640px) {
  .ai-chat-test__head,
  .ai-chat-test__composer {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .ai-chat-test__head {
    flex-direction: column;
  }

  .ai-chat-test__bubble {
    max-width: 100%;
  }
}
</style>
