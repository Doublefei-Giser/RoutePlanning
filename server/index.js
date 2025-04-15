import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';
// 加载环境变量
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 环境变量
const COZE_BOT_ID = process.env.VITE_COZE_BOT_ID;
const COZE_API_KEY = process.env.VITE_COZE_API_KEY;

// 添加环境变量检查
if (!COZE_BOT_ID || !COZE_API_KEY) {
  console.error('缺少必要的环境变量配置');
}

// 修改错误处理
app.post('/api/conversation', async (req, res) => {
  console.log('收到新的对话请求:', {
    threadId: req.body.threadId
  });
  
  if (!COZE_BOT_ID || !COZE_API_KEY) {
    return res.status(500).json({ 
      error: '缺少必要的认证信息',
      details: '请检查环境变量配置'
    });
  }
  
  try {
    // 构造Coze API请求体
    const cozeRequest = {
      bot_id: COZE_BOT_ID,
      user_id: req.body.openId || 'default_user',
      stream: true,
      auto_save_history: true,
      additional_messages: [
        {
          role: 'user',
          content: req.body.message.content.value.showText,
          content_type: 'text'
        }
      ],
      conversation_id: req.body.threadId
    };

    const response = await fetch(
      'https://api.coze.cn/v3/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${COZE_API_KEY}`
        },
        body: JSON.stringify(cozeRequest)
      }
    );
    
    console.log('Coze API 响应状态:', response.status);
    if (!response.ok) {
      const errorData = await response.text();
      return res.status(response.status).json({
        error: 'Coze API 调用失败',
        status: response.status,
        details: errorData
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 添加错误处理
    response.body.on('error', (error) => {
      console.error('Stream error:', error);
      res.end();
    });

    // 添加结束处理
    response.body.on('end', () => {
      res.end();
    });

    // 转发流式响应
    response.body.pipe(res);

    // 添加客户端断开连接的处理
    req.on('close', () => {
      response.body.destroy();
      res.end();
    });

  } catch (error) {
    console.error('详细错误信息:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: error.message 
    });
  }
});

// 修改高德地图代理路由
app.use('/_AMapService', async (req, res) => {
  try {
    // 获取原始URL路径
    const originalPath = req.path.replace('/_AMapService', '');
    
    // 处理JSONP回调
    const callback = req.query.callback;
    delete req.query.callback;
    
    // 添加安全密钥
    const queryParams = new URLSearchParams({
      ...req.query,
      jscode: process.env.VITE_AMAP_SECURITY_CODE
    });
    
    // 构建目标URL
    const targetUrl = `https://restapi.amap.com${originalPath}?${queryParams.toString()}`;
    
    // 转发请求（增加超时处理和必要参数）
    const response = await fetch(targetUrl, {
      timeout: 5000,
      headers: {
        'Accept': req.headers.accept || 'application/json'
      }
    });
    
    // 统一获取响应文本内容
    const responseText = await response.text();
    
    // 处理JSONP响应
    if (callback) {
      res.set({
        'Content-Type': 'application/javascript; charset=UTF-8',
        'Cache-Control': 'no-store'
      });

      try {
        // 新增JSONP有效性检查
        if (!/^{.*}$/.test(responseText)) {
          throw new Error('Invalid JSONP response format');
        }
        return res.send(`${callback}(${responseText})`);
      } catch (e) {
        console.error('JSONP格式异常:', { responseText });
        return res.send(`${callback}({status: '0', info: 'invalid response format'})`);
      }
    }

    // 处理普通响应（新增内容类型判断）
    try {
      const data = JSON.parse(responseText);
      if (data.status !== '1') {
        res.status(400);
      }
      res.json(data);
    } catch (e) {
      console.error('JSON解析失败:', { 
        url: targetUrl,
        response: responseText 
      });
      res.status(500).json({
        status: '0',
        info: 'invalid json format'
      });
    }

  } catch (error) {
    console.error('高德地图代理错误:', {
      url: targetUrl,
      error: error.stack // 打印完整堆栈
    });
    // 返回符合高德格式的错误响应
    res.status(500).json({ 
      status: '0',
      info: error.message.includes('timeout') ? '请求超时' : '代理服务异常'
    });
  }
});

// 添加高德地图初始化代理
app.get('/api/amap/init', async (req, res) => {
  try {
    const response = await fetch(`https://webapi.amap.com/maps?v=2.0&key=${process.env.VITE_AMAP_KEY}&plugin=AMap.PlaceSearch,AMap.InfoWindow`);
    const jsContent = await response.text();
    
    // 替换掉原来的key参数，改为使用我们的代理服务
    const modifiedContent = jsContent.replace(
      /https:\/\/restapi\.amap\.com/g, 
      `${req.protocol}://${req.get('host')}/_AMapService`
    );
    
    res.set('Content-Type', 'application/javascript');
    res.send(modifiedContent);
  } catch (error) {
    console.error('高德地图初始化代理错误:', error);
    res.status(500).json({ 
      status: '0',
      info: '代理服务异常'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});