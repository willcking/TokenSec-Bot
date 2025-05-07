#!/usr/bin/env python3.8

import os
import logging
from flask import Flask, request, jsonify
from dotenv import load_dotenv, find_dotenv
from api import MessageApiClient
from event import EventManager
from token_security import TokenSecurityAnalyzer
import re
from typing import Optional

# 加载环境变量
load_dotenv(find_dotenv())

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 从环境变量获取配置
APP_ID = os.getenv("APP_ID")
APP_SECRET = os.getenv("APP_SECRET")
VERIFICATION_TOKEN = os.getenv("APP_VERIFICATION_TOKEN")
ENCRYPT_KEY = os.getenv("ENCRYPT_KEY", "")
LARK_HOST = "https://open.larksuite.com/open-apis"

# 初始化服务
message_api_client = MessageApiClient(APP_ID, APP_SECRET, LARK_HOST)
event_manager = EventManager()
token_analyzer = TokenSecurityAnalyzer()

class CommandHandler:
    """处理用户命令的类"""
    
    @staticmethod
    def parse_command(message: str) -> tuple[str, Optional[str], Optional[str]]:
        """解析用户命令"""
        # 检查链列表命令
        if message.strip().lower() in ['链列表', 'chains', 'list']:
            return 'list_chains', None, None
            
        # 检查代币安全命令
        pattern = r'检查\s+(\w+)\s+(0x[a-fA-F0-9]{40})'
        match = re.search(pattern, message)
        if match:
            return 'check_token', match.group(1), match.group(2)
            
        return 'help', None, None

    @staticmethod
    def handle_command(command: str, chain_name: Optional[str], address: Optional[str]) -> str:
        """处理命令并返回响应"""
        if command == 'list_chains':
            return token_analyzer.get_chain_list()
            
        elif command == 'check_token':
            if not chain_name or not address:
                return "格式错误，请使用：检查 [链名称] [代币地址]"
                
            chain = token_analyzer.find_chain(chain_name)
            if not chain:
                return f"未找到链：{chain_name}"
                
            try:
                result = token_analyzer.check_token_security(chain.id, address)
                return token_analyzer.format_security_report(result)
            except Exception as e:
                logger.error(f"检查代币时出错: {str(e)}")
                return f"检查过程中出错：{str(e)}"
                
        else:
            return (
                "欢迎使用代币安全检查机器人！\n\n"
                "可用命令：\n"
                "• 检查 [链名称] [代币地址] - 检查代币安全性\n"
                "• 链列表 - 查看支持的链\n\n"
                "示例：\n"
                "• 检查 eth 0x123...\n"
                "• 检查 bsc 0x456..."
            )

@event_manager.register("im.message.receive_v1")
def handle_message_receive(event):
    """处理接收到的消息"""
    try:
        message = event.event.message.content
        open_id = event.event.sender.sender_id.open_id
        
        # 解析命令
        command, chain_name, address = CommandHandler.parse_command(message)
        
        # 处理命令
        response = CommandHandler.handle_command(command, chain_name, address)
        
        # 发送回复
        message_api_client.send_text_with_open_id(open_id, response)
        
    except Exception as e:
        logger.error(f"处理消息时出错: {str(e)}")
        message_api_client.send_text_with_open_id(
            open_id,
            "处理消息时出错，请稍后重试"
        )

@app.route("/webhook/event", methods=["POST"])
def webhook_event():
    """处理飞书事件回调"""
    try:
        # 获取事件处理器和事件对象
        handler, event = event_manager.get_handler_with_event(VERIFICATION_TOKEN, ENCRYPT_KEY)
        
        # 处理事件
        if handler:
            handler(event)
            return jsonify()
        else:
            return jsonify({"error": "unknown event"}), 400
            
    except Exception as e:
        logger.error(f"处理事件时出错: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.errorhandler(Exception)
def handle_error(e):
    """全局错误处理"""
    logger.error(f"发生错误: {str(e)}")
    return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=False)
