from goplus.token import Token
from goplus.chain import Chain
from requests.exceptions import HTTPError, RequestException
import re
from functools import lru_cache
from typing import List, Union

def get_supported_chains():
    """
    获取支持的链列表
    :return: 支持的链列表
    """
    try:
        response = Chain.get_chain_list()
        if response and hasattr(response, 'result'):
            return response.result
        return []
    except Exception as e:
        print(f"获取链列表时出错: {str(e)}")
        return []

@lru_cache(maxsize=12)
def check_token_security(chain_id, address, timeout=None):
    """
    检查代币安全性的函数（带缓存）
    :param chain_id: 链ID
    :param address: 代币合约地址
    :param timeout: 请求超时时间（秒）
    :return: 安全检测结果
    """
    if not is_valid_address(address):
        raise ValueError("无效的代币地址格式")
        
    params = {
        "chain_id": chain_id,
        "addresses": [address]
    }
    
    if timeout:
        params["_request_timeout"] = timeout
        
    try:
        return Token().token_security(**params)
    except Exception as e:
        print(f"安全检查过程中出错: {str(e)}")
        raise

def is_valid_address(address):
    """
    验证以太坊地址格式
    :param address: 待验证的地址
    :return: bool
    """
    return bool(re.match(r"^0x[a-fA-F0-9]{40}$", address))

def print_security_analysis(result):
    """
    按照 GoPlus Response Details 文档打印全部安全与风险信息
    文档链接： https://docs.gopluslabs.io/reference/response-details :contentReference[oaicite:0]{index=0}
    """
    if not result or not hasattr(result, 'result') or not result.result:
        print("无法获取安全分析结果")
        return

    for address, d in result.result.items():
        print(f"\n=== 合约地址: {address} ===")

        # 1. Contract Security
        print("\n--- Contract Security ---")
        print(f"is_open_source: {getattr(d, 'is_open_source', '未知')}")
        print(f"is_proxy: {getattr(d, 'is_proxy', '未知')}")
        print(f"is_mintable: {getattr(d, 'is_mintable', '未知')}")
        print(f"owner_address: {getattr(d, 'owner_address', '未知')}")
        print(f"can_take_back_ownership: {getattr(d, 'can_take_back_ownership', '未知')}")
        print(f"owner_change_balance: {getattr(d, 'owner_change_balance', '未知')}")
        print(f"hidden_owner: {getattr(d, 'hidden_owner', '未知')}")
        print(f"selfdestruct: {getattr(d, 'selfdestruct', '未知')}")
        print(f"external_call: {getattr(d, 'external_call', '未知')}")
        print(f"gas_abuse: {getattr(d, 'gas_abuse', '未知')}")

        # 2. Trading Security
        print("\n--- Trading Security ---")
        print(f"is_in_dex: {getattr(d, 'is_in_dex', '未知')}")
        print(f"buy_tax: {getattr(d, 'buy_tax', '未知')}")
        print(f"sell_tax: {getattr(d, 'sell_tax', '未知')}")
        print(f"transfer_tax: {getattr(d, 'transfer_tax', '未知')}")
        print(f"cannot_buy: {getattr(d, 'cannot_buy', '未知')}")
        print(f"cannot_sell_all: {getattr(d, 'cannot_sell_all', '未知')}")
        print(f"slippage_modifiable: {getattr(d, 'slippage_modifiable', '未知')}")
        print(f"is_honeypot: {getattr(d, 'is_honeypot', '未知')}")
        print(f"transfer_pausable: {getattr(d, 'transfer_pausable', '未知')}")
        print(f"is_blacklisted: {getattr(d, 'is_blacklisted', '未知')}")
        print(f"is_whitelisted: {getattr(d, 'is_whitelisted', '未知')}")
        print(f"is_anti_whale: {getattr(d, 'is_anti_whale', '未知')}")
        print(f"anti_whale_modifiable: {getattr(d, 'anti_whale_modifiable', '未知')}")
        print(f"trading_cooldown: {getattr(d, 'trading_cooldown', '未知')}")
        print(f"personal_slippage_modifiable: {getattr(d, 'personal_slippage_modifiable', '未知')}")

        # Dex list
        dex_list = getattr(d, 'dex', [])
        print("\nDex 信息:")
        if dex_list:
            for e in dex_list:
                name = getattr(e, 'name', '未知')
                liquidity = getattr(e, 'liquidity', '未知')
                pair = getattr(e, 'pair', '未知')
                print(f" - {name} | 池地址: {pair} | 流动性 (USD): {liquidity}")
        else:
            print(" 无 Dex 信息")

        # 3. Info Security
        print("\n--- Info Security ---")
        print(f"token_name: {getattr(d, 'token_name', '未知')}")
        print(f"token_symbol: {getattr(d, 'token_symbol', '未知')}")
        print(f"holder_count: {getattr(d, 'holder_count', '未知')}")
        print(f"total_supply: {getattr(d, 'total_supply', '未知')}")

        holders = getattr(d, 'holders', [])
        print("\nTop10 持币地址:")
        if holders:
            for h in holders[:10]:
                addr_h = getattr(h, 'address', '未知')
                bal = getattr(h, 'balance', '未知')
                pct = getattr(h, 'percent', '未知')
                locked = getattr(h, 'is_locked', None)
                tag = getattr(h, 'tag', '')
                print(f" - {addr_h} | 余额: {bal} | 占比: {pct}% | Locked: {locked} | Tag: {tag}")
        else:
            print(" 无持币分布")

        # 4. Liquidity Info
        print("\n--- Liquidity Info ---")
        print(f"lp_holder_count: {getattr(d, 'lp_holder_count', '未知')}")
        print(f"lp_total_supply: {getattr(d, 'lp_total_supply', '未知')}")

        lp_holders = getattr(d, 'lp_holders', [])
        print("\nTop10 LP 持币地址:")
        if lp_holders:
            for lh in lp_holders[:10]:
                addr_l = getattr(lh, 'address', '未知')
                bal_l = getattr(lh, 'balance', '未知')
                pct_l = getattr(lh, 'percent', '未知')
                locked_l = getattr(lh, 'is_locked', None)
                tag_l = getattr(lh, 'tag', '')
                # NFT list if exists
                nft_list = getattr(lh, 'nft_list', None)
                print(f" - {addr_l} | 余额: {bal_l} | 占比: {pct_l}% | Locked: {locked_l} | Tag: {tag_l}")
                if nft_list:
                    for nft in nft_list:
                        val = getattr(nft, 'value', '未知')
                        nft_id = getattr(nft, 'nft_id', '未知')
                        amount = getattr(nft, 'amount', '未知')
                        in_eff = getattr(nft, 'in_effect', '未知')
                        pct_n = getattr(nft, 'nft_percentage', '未知')
                        print(f"    · NFT {nft_id}: 价值 {val} | 数量 {amount} | 生效: {in_eff} | 占比: {pct_n}%")
        else:
            print(" 无 LP 持币分布")

        # 5. Advanced Info
        print("\n--- Advanced Info ---")
        print(f"is_airdrop_scam: {getattr(d, 'is_airdrop_scam', '未知')}")
        print(f"trust_list: {getattr(d, 'trust_list', '未知')}")
        print(f"other_potential_risks: {getattr(d, 'other_potential_risks', '未知')}")
        print(f"note: {getattr(d, 'note', '未知')}")

        # Fake token
        fake = getattr(d, 'fake_token', None)
        if fake:
            addr_true = getattr(fake, 'true_token_address', '未知')
            val_fake = getattr(fake, 'value', '未知')
            print(f"fake_token → true_token_address: {addr_true} | value: {val_fake}")
        else:
            print("fake_token: 无")

        # CEX listing
        in_cex = getattr(d, 'is_in_cex', None)
        if in_cex:
            listed = getattr(in_cex, 'listed', '未知')
            cexs = getattr(in_cex, 'cex_list', [])
            print(f"is_in_cex → listed: {listed} | cex_list: {cexs}")
        else:
            print("is_in_cex: 无")

        # Launchpad
        lp = getattr(d, 'launchpad_token', None)
        if lp:
            is_lp = getattr(lp, 'is_launchpad_token', '未知')
            name_lp = getattr(lp, 'launchpad_name', '未知')
            print(f"launchpad_token → is_launchpad_token: {is_lp} | launchpad_name: {name_lp}")
        else:
            print("launchpad_token: 无")


def fuzzy_match_chain(name, chains):
    """
    模糊匹配链名称
    :param name: 用户输入的名称
    :param chains: 链列表
    :return: 匹配的链对象
    """
    name = name.lower()
    for chain in chains:
        chain_name = getattr(chain, 'name', '').lower()
        if name in chain_name or chain_name in name:
            return chain
    return None

def select_chain(chains):
    """
    让用户选择链
    :param chains: 链列表
    :return: 选中的链对象
    """
    print("\n可用链列表:")
    for idx, chain in enumerate(chains, 1):
        print(f"{idx}. {getattr(chain, 'name', 'Unknown')}")
    
    while True:
        try:
            choice = input("\n请选择链 (输入编号或名称): ").strip()
            
            # 尝试按编号选择
            if choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(chains):
                    return chains[idx]
            
            # 尝试模糊匹配名称
            selected_chain = fuzzy_match_chain(choice, chains)
            if selected_chain:
                return selected_chain
                
            print("无效的选择，请重新输入")
        except Exception as e:
            print(f"输入错误: {str(e)}")

def batch_check_tokens(chain_id: str, addresses: List[str], timeout: int = None) -> List[dict]:
    """
    批量检查多个代币的安全性
    :param chain_id: 链ID
    :param addresses: 代币地址列表
    :param timeout: 请求超时时间
    :return: 安全检测结果列表
    """
    results = []
    for addr in addresses:
        try:
            result = check_token_security(chain_id, addr, timeout)
            results.append({
                'address': addr,
                'result': result
            })
        except Exception as e:
            results.append({
                'address': addr,
                'error': str(e)
            })
    return results

def main():
    # 获取支持的链列表
    chains = get_supported_chains()
    if not chains:
        print("未能获取到链列表，请检查网络连接或API状态")
        return
    
    # 选择链
    selected_chain = select_chain(chains)
    chain_id = getattr(selected_chain, 'id', '')
    print(f"\n已选择链: {getattr(selected_chain, 'name', 'N/A')} (ID: {chain_id})")
    
    # 输入代币地址
    while True:
        try:
            input_str = input("\n请输入要检查的代币合约地址 (多个地址用逗号分隔): ").strip()
            addresses = [addr.strip() for addr in input_str.split(',')]
            
            # 验证所有地址
            invalid_addrs = [addr for addr in addresses if not is_valid_address(addr)]
            if invalid_addrs:
                print(f"以下地址格式无效: {', '.join(invalid_addrs)}")
                continue
            break
        except Exception as e:
            print(f"输入错误: {str(e)}")
    
    # 检查代币安全性
    try:
        if len(addresses) == 1:
            result = check_token_security(chain_id, addresses[0])
            print("\n代币安全检测结果:")
            print_security_analysis(result)
        else:
            results = batch_check_tokens(chain_id, addresses)
            print("\n批量检测结果:")
            for r in results:
                print(f"\n=== 代币地址: {r['address']} ===")
                if 'error' in r:
                    print(f"检测失败: {r['error']}")
                else:
                    print_security_analysis(r['result'])
    except Exception as e:
        print(f"检测过程中出现错误: {str(e)}")

if __name__ == "__main__":
    main()