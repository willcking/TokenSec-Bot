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

    // 对于 Solana 地址，使用专门的 API 端点
    const url = chainId === 'solana' 
        ? `${BASE_URL}/solana/token_security`
        : `${BASE_URL}/token_security/${chainId}`;
    
    // 所有链都使用 contract_addresses 参数
    const params = { contract_addresses: address };

    try {
        console.log('请求URL:', url);
        console.log('请求参数:', params);
        
        const response = await axios.get(url, {
            params,
            timeout: timeout ? timeout * 1000 : undefined,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('API响应:', JSON.stringify(response.data, null, 2));
        
        // 检查 API 错误响应
        if (response.data && response.data.code && response.data.code !== 1) {
            // 对于 Solana 特定的错误处理
            if (chainId === 'solana' && response.data.code === 2007) {
                throw new Error('该 Solana 代币地址未被收录，请确认地址是否正确或稍后再试');
            }
            throw new Error(response.data.message || 'API 请求失败');
        }
        
        if (!response.data || !response.data.result) {
            throw new Error('无法获取代币安全信息，请确认代币地址是否正确');
        }

        // 处理 Solana 代币数据
        if (chainId === 'solana') {
            const solanaData = response.data.result[address];
            if (solanaData) {
                // 确保所有必要的字段都存在
                solanaData.metadata = solanaData.metadata || {};
                solanaData.metadata_mutable = solanaData.metadata_mutable || {};
                solanaData.holders = solanaData.holders || [];
                solanaData.creators = solanaData.creators || [];
                
                // 添加默认值
                solanaData.mintable = solanaData.mintable || { status: '0' };
                solanaData.freezable = solanaData.freezable || { status: '0' };
                solanaData.closable = solanaData.closable || { status: '0' };
                solanaData.non_transferable = solanaData.non_transferable || '0';
                solanaData.trusted_token = solanaData.trusted_token || 0;
                solanaData.default_account_state = solanaData.default_account_state || '0';
                solanaData.default_account_state_upgradable = solanaData.default_account_state_upgradable || { status: '0' };
                solanaData.transfer_fee_upgradable = solanaData.transfer_fee_upgradable || { status: '0' };
                solanaData.transfer_hook_upgradable = solanaData.transfer_hook_upgradable || { status: '0' };
                solanaData.balance_mutable_authority = solanaData.balance_mutable_authority || { status: '0' };
                solanaData.transfer_fee = solanaData.transfer_fee || {};
                solanaData.transfer_hook = solanaData.transfer_hook || [];

                // 打印处理后的数据
                console.log('处理后的 Solana 数据:', JSON.stringify(solanaData, null, 2));
            }
        }
        
        tokenCache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error(`安全检查过程中出错: ${error.message}`);
        if (error.response) {
            console.error('错误响应数据:', error.response.data);
            console.error('错误状态码:', error.response.status);
        }
        throw error;
    }
}

/**
 * 验证地址格式
 * @param {string} address - 待验证的地址
 * @returns {boolean}
 */
function isValidAddress(address) {
    // 支持以太坊地址格式（0x开头，42个字符）
    const ethPattern = /^0x[a-fA-F0-9]{40}$/;
    // 支持 Solana 地址格式（base58编码，32-44个字符）
    const solPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    return ethPattern.test(address) || solPattern.test(address);
}

/**
 * 打印安全分析结果
 * @param {Object} data - 安全检测结果
 * @param {string} chainId - 链ID
 * @returns {string} 安全分析结果字符串
 */
function printSecurityAnalysis(data, chainId) {
    if (!data) {
        return "❌ 无法获取安全分析结果";
    }

    const tokenData = chainId === 'solana' ? data : data[Object.keys(data)[0]];
    if (!tokenData) {
        return "❌ 无法获取代币数据";
    }

    let result = `🔍 代币安全分析结果\n\n`;

    // 代币基本信息
    if (tokenData.metadata) {
        result += `📝 代币信息\n`;
        result += `名称: ${tokenData.metadata.name || '未知'}\n`;
        result += `符号: ${tokenData.metadata.symbol || '未知'}\n`;
        result += `描述: ${tokenData.metadata.description || '未知'}\n\n`;
    }

    // 代币安全特性
    result += `🔒 安全特性\n`;
    result += `总供应量: ${tokenData.total_supply || '未知'}\n`;
    result += `持有者数量: ${tokenData.holder_count || '未知'}\n`;
    result += `是否可铸造: ${tokenData.mintable?.status === '0' ? '否' : '是'}\n`;
    result += `是否可冻结: ${tokenData.freezable?.status === '0' ? '否' : '是'}\n`;
    result += `是否可关闭: ${tokenData.closable?.status === '0' ? '否' : '是'}\n`;
    result += `是否可转账: ${tokenData.non_transferable === '0' ? '是' : '否'}\n`;
    result += `是否可信代币: ${tokenData.trusted_token === 1 ? '是' : '否'}\n\n`;

    // DEX 信息
    if (tokenData.dex && tokenData.dex.length > 0) {
        result += `💱 DEX 信息\n`;
        const mainDex = tokenData.dex[0]; // 使用第一个 DEX 作为主要信息
        result += `DEX: ${mainDex.dex_name}\n`;
        result += `价格: $${mainDex.price}\n`;
        result += `TVL: $${mainDex.tvl}\n`;
        result += `手续费率: ${(parseFloat(mainDex.fee_rate) * 100).toFixed(2)}%\n`;
        
        if (mainDex.day) {
            result += `24h 交易量: $${mainDex.day.volume}\n`;
            result += `24h 最高价: $${mainDex.day.price_max}\n`;
            result += `24h 最低价: $${mainDex.day.price_min}\n`;
        }
        result += '\n';
    }

    // 持有者分布
    if (tokenData.holders && tokenData.holders.length > 0) {
        result += `👥 前10大持有者\n`;
        tokenData.holders.slice(0, 10).forEach((holder, index) => {
            result += `${index + 1}. ${holder.account.slice(0, 8)}...${holder.account.slice(-8)}: ${holder.balance} (${holder.percent}%)\n`;
        });
        result += '\n';
    }

    // 元数据权限
    if (tokenData.metadata_mutable) {
        result += `🔑 元数据权限\n`;
        result += `可升级: ${tokenData.metadata_mutable.status === '1' ? '是' : '否'}\n`;
        if (tokenData.metadata_mutable.metadata_upgrade_authority) {
            const authority = tokenData.metadata_mutable.metadata_upgrade_authority[0];
            if (authority) {
                result += `升级权限地址: ${authority.address}\n`;
                result += `是否恶意地址: ${authority.malicious_address === 1 ? '是' : '否'}\n`;
            }
        }
    }

    return result;
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
 * 格式化安全分析结果为卡片格式
 * @param {Object} result - 安全检测结果
 * @returns {Object} 格式化后的卡片对象
 */
function formatSecurityAnalysisToCard(result) {
    if (!result || !result.result) {
        return {
            header: {
                title: {
                    tag: "plain_text",
                    content: "❌ 无法获取安全分析结果"
                }
            },
            elements: []
        };
    }

    const elements = [];
    for (const [address, data] of Object.entries(result.result)) {
        // 1. 代币基本信息
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: `**合约地址**: ${address}`
            }
        });

        // 2. 合约安全
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**合约安全**"
            }
        });

        const contractSecurity = [
            [`是否可铸造`, data.mintable?.status === '1' ? '✅' : '❌'],
            [`是否可冻结`, data.freezable?.status === '1' ? '✅' : '❌'],
            [`是否可关闭`, data.closable?.status === '1' ? '✅' : '❌'],
            [`是否可转账`, data.non_transferable === '1' ? '❌' : '✅'],
            [`是否可信代币`, data.trusted_token === 1 ? '✅' : '❌'],
            [`默认账户状态`, data.default_account_state === '1' ? '已初始化' : '未初始化'],
            [`是否可升级默认账户状态`, data.default_account_state_upgradable?.status === '1' ? '✅' : '❌'],
            [`是否可升级转账费用`, data.transfer_fee_upgradable?.status === '1' ? '✅' : '❌'],
            [`是否可升级转账钩子`, data.transfer_hook_upgradable?.status === '1' ? '✅' : '❌']
        ].filter(([k, v]) => v !== '未知')
         .map(([k, v]) => `${k}: ${v}`);

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: contractSecurity.join('\n')
            }
        });

        // 3. 交易安全
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**交易安全**"
            }
        });

        const tradingSecurity = [
            [`余额可变权限`, data.balance_mutable_authority?.status === '1' ? '✅' : '❌'],
            [`转账费用`, data.transfer_fee ? '✅' : '❌'],
            [`转账钩子`, data.transfer_hook?.length > 0 ? '✅' : '❌']
        ].filter(([k, v]) => v !== '未知')
         .map(([k, v]) => `${k}: ${v}`);

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: tradingSecurity.join('\n')
            }
        });

        // 4. 代币信息
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**代币信息**"
            }
        });

        const tokenInfo = [
            [`名称`, data.metadata?.name || '未知'],
            [`符号`, data.metadata?.symbol || '未知'],
            [`描述`, data.metadata?.description || '未知'],
            [`持有人数量`, data.holder_count || '未知'],
            [`总供应量`, data.total_supply || '未知']
        ].filter(([k, v]) => v !== '未知')
         .map(([k, v]) => `${k}: ${v}`);

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: tokenInfo.join('\n')
            }
        });

        // 5. 高级信息
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**高级信息**"
            }
        });

        const advancedInfo = [];
        
        // 添加元数据权限信息
        if (data.metadata_mutable) {
            advancedInfo.push(`元数据可升级: ${data.metadata_mutable.status === '1' ? '✅' : '❌'}`);
            if (data.metadata_mutable.metadata_upgrade_authority) {
                advancedInfo.push('升级权限地址:');
                data.metadata_mutable.metadata_upgrade_authority.forEach(auth => {
                    advancedInfo.push(`- ${auth.address} ${auth.malicious_address ? '(⚠️ 可疑地址)' : ''}`);
                });
            }
        }

        // 添加创建者信息
        if (data.creators && data.creators.length > 0) {
            advancedInfo.push('创建者地址:');
            data.creators.forEach(creator => {
                advancedInfo.push(`- ${creator.address} ${creator.verified ? '(已验证)' : ''}`);
            });
        }

        // 添加 Top10 持币地址信息
        if (data.holders && data.holders.length > 0) {
            advancedInfo.push('\nTop10 持币地址:');
            data.holders.slice(0, 10).forEach((holder, index) => {
                advancedInfo.push(`#${index + 1} ${holder.account}`);
                advancedInfo.push(`余额: ${holder.balance}`);
                advancedInfo.push(`占比: ${holder.percent}%`);
                if (holder.is_locked) advancedInfo.push('状态: 已锁定');
                if (holder.tag) advancedInfo.push(`标签: ${holder.tag}`);
                advancedInfo.push('---');
            });
        }

        // 如果没有高级信息，添加提示
        if (advancedInfo.length === 0) {
            advancedInfo.push('暂无高级信息');
        }

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: advancedInfo.join('\n')
            }
        });
    }

    return {
        header: {
            title: {
                tag: "plain_text",
                content: "🔍 代币安全分析结果"
            }
        },
        elements: elements
    };
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
            console.log(printSecurityAnalysis(result, chainId));
        } else {
            const results = await batchCheckTokens(chainId, addresses);
            console.log("\n批量检测结果:");
            for (const r of results) {
                console.log(`\n=== 代币地址: ${r.address} ===`);
                if (r.error) {
                    console.log(`检测失败: ${r.error}`);
                } else {
                    console.log(printSecurityAnalysis(r.result.result, chainId));
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
    batchCheckTokens,
    formatSecurityAnalysisToCard
}; 