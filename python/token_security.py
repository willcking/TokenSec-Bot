from goplus.token import Token
from goplus.chain import Chain
from goplus.contract import Contract
import re
from functools import lru_cache
from typing import List, Union, Dict, Any
import time
from datetime import datetime, timedelta

class TokenSecurityAnalyzer:
    def __init__(self):
        self.token_client = Token()
        self.contract_client = Contract()
        self.chain_client = Chain()
        self._chain_cache = {}
        self._chain_cache_time = None
        self._chain_cache_duration = 3600  # 1小时缓存

    def _get_cached_chains(self) -> List[Dict[str, Any]]:
        """获取缓存的链列表"""
        current_time = time.time()
        if (self._chain_cache_time is None or 
            current_time - self._chain_cache_time > self._chain_cache_duration):
            try:
                response = self.chain_client.get_chain_list()
                if response and hasattr(response, 'result'):
                    self._chain_cache = {chain.name.lower(): chain for chain in response.result}
                    self._chain_cache_time = current_time
            except Exception as e:
                print(f"获取链列表时出错: {str(e)}")
        return self._chain_cache

    @lru_cache(maxsize=100)
    def check_token_security(self, chain_id: str, address: str, timeout: int = 30) -> Dict[str, Any]:
        """检查代币安全性（带缓存）"""
        if not self._is_valid_address(address):
            raise ValueError("无效的代币地址格式")
            
        try:
            # 获取代币安全信息
            token_result = self.token_client.token_security(
                chain_id=chain_id,
                addresses=[address],
                _request_timeout=timeout
            )
            
            # 获取合约信息
            contract_result = self.contract_client.contract_security(
                chain_id=chain_id,
                addresses=[address],
                _request_timeout=timeout
            )
            
            return {
                'token': token_result.result.get(address, {}),
                'contract': contract_result.result.get(address, {})
            }
        except Exception as e:
            print(f"安全检查过程中出错: {str(e)}")
            raise

    def _is_valid_address(self, address: str) -> bool:
        """验证以太坊地址格式"""
        return bool(re.match(r"^0x[a-fA-F0-9]{40}$", address))

    def format_security_report(self, result: Dict[str, Any]) -> str:
        """格式化安全分析报告"""
        if not result:
            return "无法获取安全分析结果"

        token_data = result.get('token', {})
        contract_data = result.get('contract', {})
        
        message = []
        
        # 基本信息
        message.append("🔍 代币安全分析报告")
        message.append("=" * 30)
        message.append(f"📝 代币名称: {getattr(token_data, 'token_name', '未知')}")
        message.append(f"🏷️ 代币符号: {getattr(token_data, 'token_symbol', '未知')}")
        message.append(f"⛓️ 链: {getattr(token_data, 'chain_id', '未知')}")
        
        # 合约安全
        message.append("\n🔒 合约安全分析")
        message.append("-" * 20)
        message.append(f"📜 是否开源: {'✅' if getattr(contract_data, 'is_open_source', False) else '❌'}")
        message.append(f"🔄 是否代理: {'⚠️' if getattr(contract_data, 'is_proxy', False) else '✅'}")
        message.append(f"💰 是否可增发: {'⚠️' if getattr(contract_data, 'is_mintable', False) else '✅'}")
        message.append(f"🕵️ 是否蜜罐: {'❌' if getattr(contract_data, 'is_honeypot', False) else '✅'}")
        
        # 交易安全
        message.append("\n💱 交易安全分析")
        message.append("-" * 20)
        message.append(f"📈 买入税: {getattr(token_data, 'buy_tax', '未知')}%")
        message.append(f"📉 卖出税: {getattr(token_data, 'sell_tax', '未知')}%")
        message.append(f"🔄 转账税: {getattr(token_data, 'transfer_tax', '未知')}%")
        
        # 持币分布
        message.append("\n👥 持币分布分析")
        message.append("-" * 20)
        message.append(f"👤 持币人数: {getattr(token_data, 'holder_count', '未知')}")
        message.append(f"💰 前10持币占比: {getattr(token_data, 'top10_holder_rate', '未知')}%")
        
        # 风险提示
        message.append("\n⚠️ 风险提示")
        message.append("-" * 20)
        if getattr(contract_data, 'is_honeypot', False):
            message.append("❌ 高风险: 该代币可能是蜜罐合约")
        if getattr(contract_data, 'is_proxy', False):
            message.append("⚠️ 注意: 该合约是代理合约")
        if not getattr(contract_data, 'is_open_source', False):
            message.append("⚠️ 注意: 该合约未开源")
        if float(getattr(token_data, 'buy_tax', 0)) > 5:
            message.append("⚠️ 注意: 买入税较高")
        if float(getattr(token_data, 'sell_tax', 0)) > 5:
            message.append("⚠️ 注意: 卖出税较高")
            
        return "\n".join(message)

    def find_chain(self, chain_name: str) -> Union[Dict[str, Any], None]:
        """查找链信息"""
        chains = self._get_cached_chains()
        chain_name = chain_name.lower()
        
        # 精确匹配
        if chain_name in chains:
            return chains[chain_name]
            
        # 模糊匹配
        for name, chain in chains.items():
            if chain_name in name or name in chain_name:
                return chain
                
        return None

    def get_chain_list(self) -> str:
        """获取链列表（格式化）"""
        chains = self._get_cached_chains()
        if not chains:
            return "无法获取链列表"
            
        message = ["📋 支持的链列表:", "=" * 20]
        for name, chain in chains.items():
            message.append(f"• {name}")
        return "\n".join(message) 