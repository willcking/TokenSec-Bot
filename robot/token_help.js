const axios = require('axios');
const NodeCache = require('node-cache');

// 创建缓存实例，设置默认过期时间为 12 小时
const tokenCache = new NodeCache({ stdTTL: 43200 });

// API 基础 URL
const BASE_URL = 'https://api.gopluslabs.io/api/v1';

/**
 * 获取支持的链列表
 * @returns {Promise<Array>} 支持的链列表
 */
async function getSupportedChains() {
    try {
        const response = await axios.get('https://api.gopluslabs.io/api/v1/supported_chains');
        if (response.data && response.data.result) {
            return response.data.result;
        }
        return [];
    } catch (error) {
        console.error(`获取链列表时出错: ${error.message}`);
        return [];
    }
}

/**
 * 检查代币安全性（带缓存）
 * @param {string} chainId - 链ID
 * @param {string} address - 代币合约地址
 * @param {number} timeout - 请求超时时间（秒）
 * @returns {Promise<Object>} 安全检测结果
 */
async function checkTokenSecurity(chainId, address, timeout = null) {
    if (!isValidAddress(address)) {
        throw new Error("无效的代币地址格式");
    }
    const cacheKey = `${chainId}_${address}`;
    const cachedResult = tokenCache.get(cacheKey);
    if (cachedResult) return cachedResult;

    const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}`;
    const params = { contract_addresses: address };
    try {
        const response = await axios.get(url, {
            params,
            timeout: timeout ? timeout * 1000 : undefined
        });
        tokenCache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error(`安全检查过程中出错: ${error.message}`);
        throw error;
    }
}

/**
 * 验证以太坊地址格式
 * @param {string} address - 待验证的地址
 * @returns {boolean}
 */
function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 打印安全分析结果
 * @param {Object} result - 安全检测结果
 */
function printSecurityAnalysis(result) {
    if (!result || !result.result) {
        console.log("无法获取安全分析结果");
        return;
    }

    for (const [address, data] of Object.entries(result.result)) {
        console.log(`\n=== 合约地址: ${address} ===`);

        // 1. Contract Security
        console.log("\n--- Contract Security ---");
        console.log(`is_open_source: ${data.is_open_source ?? '未知'}`);
        console.log(`is_proxy: ${data.is_proxy ?? '未知'}`);
        console.log(`is_mintable: ${data.is_mintable ?? '未知'}`);
        console.log(`owner_address: ${data.owner_address ?? '未知'}`);
        console.log(`can_take_back_ownership: ${data.can_take_back_ownership ?? '未知'}`);
        console.log(`owner_change_balance: ${data.owner_change_balance ?? '未知'}`);
        console.log(`hidden_owner: ${data.hidden_owner ?? '未知'}`);
        console.log(`selfdestruct: ${data.selfdestruct ?? '未知'}`);
        console.log(`external_call: ${data.external_call ?? '未知'}`);
        console.log(`gas_abuse: ${data.gas_abuse ?? '未知'}`);

        // 2. Trading Security
        console.log("\n--- Trading Security ---");
        console.log(`is_in_dex: ${data.is_in_dex ?? '未知'}`);
        console.log(`buy_tax: ${data.buy_tax ?? '未知'}`);
        console.log(`sell_tax: ${data.sell_tax ?? '未知'}`);
        console.log(`transfer_tax: ${data.transfer_tax ?? '未知'}`);
        console.log(`cannot_buy: ${data.cannot_buy ?? '未知'}`);
        console.log(`cannot_sell_all: ${data.cannot_sell_all ?? '未知'}`);
        console.log(`slippage_modifiable: ${data.slippage_modifiable ?? '未知'}`);
        console.log(`is_honeypot: ${data.is_honeypot ?? '未知'}`);
        console.log(`transfer_pausable: ${data.transfer_pausable ?? '未知'}`);
        console.log(`is_blacklisted: ${data.is_blacklisted ?? '未知'}`);
        console.log(`is_whitelisted: ${data.is_whitelisted ?? '未知'}`);
        console.log(`is_anti_whale: ${data.is_anti_whale ?? '未知'}`);
        console.log(`anti_whale_modifiable: ${data.anti_whale_modifiable ?? '未知'}`);
        console.log(`trading_cooldown: ${data.trading_cooldown ?? '未知'}`);
        console.log(`personal_slippage_modifiable: ${data.personal_slippage_modifiable ?? '未知'}`);

        // Dex list
        const dexList = data.dex || [];
        console.log("\nDex 信息:");
        if (dexList.length > 0) {
            dexList.forEach(dex => {
                console.log(` - ${dex.name || '未知'} | 池地址: ${dex.pair || '未知'} | 流动性 (USD): ${dex.liquidity || '未知'}`);
            });
        } else {
            console.log(" 无 Dex 信息");
        }

        // 3. Info Security
        console.log("\n--- Info Security ---");
        console.log(`token_name: ${data.token_name ?? '未知'}`);
        console.log(`token_symbol: ${data.token_symbol ?? '未知'}`);
        console.log(`holder_count: ${data.holder_count ?? '未知'}`);
        console.log(`total_supply: ${data.total_supply ?? '未知'}`);

        const holders = data.holders || [];
        console.log("\nTop10 持币地址:");
        if (holders.length > 0) {
            holders.slice(0, 10).forEach(holder => {
                console.log(` - ${holder.address || '未知'} | 余额: ${holder.balance || '未知'} | 占比: ${holder.percent || '未知'}% | Locked: ${holder.is_locked ?? '未知'} | Tag: ${holder.tag || ''}`);
            });
        } else {
            console.log(" 无持币分布");
        }

        // 4. Liquidity Info
        console.log("\n--- Liquidity Info ---");
        console.log(`lp_holder_count: ${data.lp_holder_count ?? '未知'}`);
        console.log(`lp_total_supply: ${data.lp_total_supply ?? '未知'}`);

        const lpHolders = data.lp_holders || [];
        console.log("\nTop10 LP 持币地址:");
        if (lpHolders.length > 0) {
            lpHolders.slice(0, 10).forEach(lp => {
                console.log(` - ${lp.address || '未知'} | 余额: ${lp.balance || '未知'} | 占比: ${lp.percent || '未知'}% | Locked: ${lp.is_locked ?? '未知'} | Tag: ${lp.tag || ''}`);
                
                if (lp.nft_list) {
                    lp.nft_list.forEach(nft => {
                        console.log(`    · NFT ${nft.nft_id || '未知'}: 价值 ${nft.value || '未知'} | 数量 ${nft.amount || '未知'} | 生效: ${nft.in_effect || '未知'} | 占比: ${nft.nft_percentage || '未知'}%`);
                    });
                }
            });
        } else {
            console.log(" 无 LP 持币分布");
        }

        // 5. Advanced Info
        console.log("\n--- Advanced Info ---");
        console.log(`is_airdrop_scam: ${data.is_airdrop_scam ?? '未知'}`);
        console.log(`trust_list: ${data.trust_list ?? '未知'}`);
        console.log(`other_potential_risks: ${data.other_potential_risks ?? '未知'}`);
        console.log(`note: ${data.note ?? '未知'}`);

        // Fake token
        if (data.fake_token) {
            console.log(`fake_token → true_token_address: ${data.fake_token.true_token_address || '未知'} | value: ${data.fake_token.value || '未知'}`);
        } else {
            console.log("fake_token: 无");
        }

        // CEX listing
        if (data.is_in_cex) {
            console.log(`is_in_cex → listed: ${data.is_in_cex.listed || '未知'} | cex_list: ${data.is_in_cex.cex_list || []}`);
        } else {
            console.log("is_in_cex: 无");
        }

        // Launchpad
        if (data.launchpad_token) {
            console.log(`launchpad_token → is_launchpad_token: ${data.launchpad_token.is_launchpad_token || '未知'} | launchpad_name: ${data.launchpad_token.launchpad_name || '未知'}`);
        } else {
            console.log("launchpad_token: 无");
        }
    }
}

/**
 * 模糊匹配链名称
 * @param {string} name - 用户输入的名称
 * @param {Array} chains - 链列表
 * @returns {Object|null} 匹配的链对象
 */
function fuzzyMatchChain(name, chains) {
    name = name.toLowerCase();
    return chains.find(chain => {
        const chainName = (chain.name || '').toLowerCase();
        return chainName.includes(name) || name.includes(chainName);
    });
}

/**
 * 让用户选择链
 * @param {Array} chains - 链列表
 * @returns {Promise<Object>} 选中的链对象
 */
async function selectChain(chains) {
    console.log("\n可用链列表:");
    chains.forEach((chain, index) => {
        console.log(`${index + 1}. ${chain.name || 'Unknown'}`);
    });

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        const askChoice = () => {
            readline.question("\n请选择链 (输入编号或名称): ", (choice) => {
                choice = choice.trim();
                
                // 尝试按编号选择
                if (/^\d+$/.test(choice)) {
                    const idx = parseInt(choice) - 1;
                    if (idx >= 0 && idx < chains.length) {
                        readline.close();
                        resolve(chains[idx]);
                        return;
                    }
                }
                
                // 尝试模糊匹配名称
                const selectedChain = fuzzyMatchChain(choice, chains);
                if (selectedChain) {
                    readline.close();
                    resolve(selectedChain);
                    return;
                }
                
                console.log("无效的选择，请重新输入");
                askChoice();
            });
        };
        
        askChoice();
    });
}

/**
 * 批量检查多个代币的安全性
 * @param {string} chainId - 链ID
 * @param {Array<string>} addresses - 代币地址列表
 * @param {number} timeout - 请求超时时间
 * @returns {Promise<Array>} 安全检测结果列表
 */
async function batchCheckTokens(chainId, addresses, timeout = null) {
    const results = [];
    // 批量接口支持逗号分隔的地址
    const validAddresses = addresses.filter(isValidAddress);
    if (validAddresses.length === 0) {
        return addresses.map(addr => ({ address: addr, error: '无效的代币地址格式' }));
    }
    const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}`;
    const params = { contract_addresses: validAddresses.join(',') };
    try {
        const response = await axios.get(url, {
            params,
            timeout: timeout ? timeout * 1000 : undefined
        });
        // 拆分结果
        for (const addr of addresses) {
            if (response.data && response.data.result && response.data.result[addr]) {
                results.push({ address: addr, result: { result: { [addr]: response.data.result[addr] } } });
            } else {
                results.push({ address: addr, error: '未返回结果' });
            }
        }
    } catch (error) {
        for (const addr of addresses) {
            results.push({ address: addr, error: error.message });
        }
    }
    return results;
}

/**
 * 主函数
 */
async function main() {
    try {
        // 获取支持的链列表
        const chains = await getSupportedChains();
        if (!chains.length) {
            console.log("未能获取到链列表，请检查网络连接或API状态");
            return;
        }

        // 选择链
        const selectedChain = await selectChain(chains);
        const chainId = selectedChain.id;
        console.log(`\n已选择链: ${selectedChain.name} (ID: ${chainId})`);

        // 输入代币地址
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const addresses = await new Promise((resolve) => {
            const askAddresses = () => {
                readline.question("\n请输入要检查的代币合约地址 (多个地址用逗号分隔): ", (input) => {
                    const addresses = input.split(',').map(addr => addr.trim());
                    
                    // 验证所有地址
                    const invalidAddrs = addresses.filter(addr => !isValidAddress(addr));
                    if (invalidAddrs.length > 0) {
                        console.log(`以下地址格式无效: ${invalidAddrs.join(', ')}`);
                        askAddresses();
                        return;
                    }
                    
                    readline.close();
                    resolve(addresses);
                });
            };
            
            askAddresses();
        });

        // 检查代币安全性
        if (addresses.length === 1) {
            const result = await checkTokenSecurity(chainId, addresses[0]);
            console.log("\n代币安全检测结果:");
            printSecurityAnalysis(result);
        } else {
            const results = await batchCheckTokens(chainId, addresses);
            console.log("\n批量检测结果:");
            for (const r of results) {
                console.log(`\n=== 代币地址: ${r.address} ===`);
                if (r.error) {
                    console.log(`检测失败: ${r.error}`);
                } else {
                    printSecurityAnalysis(r.result);
                }
            }
        }
    } catch (error) {
        console.error(`检测过程中出现错误: ${error.message}`);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = {
    getSupportedChains,
    checkTokenSecurity,
    isValidAddress,
    printSecurityAnalysis,
    batchCheckTokens
}; 