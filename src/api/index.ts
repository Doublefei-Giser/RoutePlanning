// Coze API 接口定义
interface ConversationRequest {
  threadId?: string;
  message: {
    content: {
      type: 'text';
      value: {
        showText: string;
      };
    };
  };
  openId: string;
  signal?: AbortSignal;
}

interface ConversationEvent {
  event: string;
  data: {
    id: string;
    conversation_id: string;
    bot_id: string;
    role?: string;
    type?: string;
    content?: string;
    content_type?: string;
    chat_id?: string;
    section_id: string;
    status?: string;
    created_at?: number;
    completed_at?: number;
    last_error?: {
      code: number;
      msg: string;
    };
    usage?: {
      token_count: number;
      output_count: number;
      input_count: number;
    };
  };
}

class CozeClient {
  private readonly baseUrl: string = 'http://localhost:3000';

  constructor() {}

  /**
   * 创建会话流
   * @param request 会话请求参数
   * @returns 异步生成器，用于获取流式响应
   */
  async *conversationStream(request: ConversationRequest): AsyncGenerator<ConversationEvent, void, unknown> {
    const url = `${this.baseUrl}/api/conversation`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(request),
        signal: request.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      try {
        while (true) {
          if (request.signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            if (event.trim() === '') continue;
            
            const lines = event.split('\n');
            const eventType = lines[0]?.replace('event:', '')?.trim();
            const dataLine = lines[1];

            if (!eventType || !dataLine?.startsWith('data:')) continue;

            try {
              if (eventType === 'done' && dataLine.includes('[DONE]')) {
                return;
              }

              const data = JSON.parse(dataLine.slice(5));
              yield { event: eventType, data };
            } catch (e) {
              console.error('Failed to parse response data:', e);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('Stream aborted by user');
        return;
      }
      console.error('Error in conversation stream:', error);
      throw error;
    }
  }
}

// 创建实例
export const normalClient = new CozeClient();

// 导出类型定义
export type {
  ConversationRequest,
  ConversationEvent
};

