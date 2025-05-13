const lark = require('@larksuiteoapi/node-sdk');
const http = require('http');
const {
    APP_ID,
    APP_SECRET,
    PORT,
    VERIFICATION_TOKEN
} = require('./config');
const { checkTokenSecurity, getSupportedChains } = require('./token_help');

if (!APP_ID || !APP_SECRET) {
    throw new Error('需在config.js中填写APP_ID和APP_SECRET');
}

if (!VERIFICATION_TOKEN) {
    throw new Error('需在config.js中填写VERIFICATION_TOKEN');
}

const pickRequestData = (req) =>
    new Promise((resolve, reject) => {
        let chunks = '';
        req.on('data', (chunk) => {
            chunks += chunk;
        });

        req.on('end', () => {
            try {
                // 检查是否为空数据
                if (!chunks || chunks.trim() === '') {
                    console.log('收到空请求体');
                    resolve({}); // 返回空对象而不是抛出错误
                    return;
                }

                // 记录原始数据用于调试
                console.log('收到请求数据:', chunks);

                // 尝试解析JSON
                const data = JSON.parse(chunks);
                resolve(data);
            } catch (error) {
                console.error('JSON解析错误:', error.message);
                console.error('原始数据:', chunks);
                reject(new Error('无效的JSON数据'));
            }
        });

        req.on('error', (error) => {
            console.error('请求错误:', error.message);
            reject(error);
        });
    });

const client = new lark.Client({
    appId: APP_ID,
    appSecret: APP_SECRET,
    appType: lark.AppType.SelfBuild,
});

// 获取支持的链列表
let SUPPORTED_CHAINS = [];
async function loadSupportedChains() {
    try {
        SUPPORTED_CHAINS = await getSupportedChains();
        console.log('已加载支持的链列表:', SUPPORTED_CHAINS);
    } catch (error) {
        console.error('加载链列表失败:', error);
        // 如果加载失败，使用默认链列表
        SUPPORTED_CHAINS = [
            { name: 'Ethereum', id: '1' },
            { name: 'BSC', id: '56' },
            { name: 'Arbitrum', id: '42161' },
            { name: 'Polygon', id: '137' },
            { name: 'Solana', id: 'solana' },
            { name: 'opBNB', id: '204' },
            { name: 'zkSync Era', id: '324' },
            { name: 'Linea Mainnet', id: '59144' },
            { name: 'Base', id: '8453' },
            { name: 'Mantle', id: '5000' },
            { name: 'Scroll', id: '534352' },
            { name: 'Optimism', id: '10' },
            { name: 'Avalanche', id: '43114' },
            { name: 'Fantom', id: '250' },
            { name: 'Cronos', id: '25' },
            { name: 'HECO', id: '128' },
            { name: 'Gnosis', id: '100' },
            { name: 'Tron', id: 'tron' },
            { name: 'KCC', id: '321' },
            { name: 'FON', id: '201022' },
            { name: 'ZKFair', id: '42766' },
            { name: 'Soneium', id: '1868' },
            { name: 'Story', id: '1514' },
            { name: 'Sonic', id: '146' },
            { name: 'Abstract', id: '2741' },
            { name: 'Hashkey', id: '177' },
            { name: 'Berachain', id: '80094' },
            { name: 'Monad', id: '10143' },
            { name: 'World Chain', id: '480' },
            { name: 'Morph', id: '2818' },
            { name: 'Gravity', id: '1625' },
            { name: 'Mint', id: '185' },
            { name: 'Zircuit', id: '48899' },
            { name: 'X Layer Mainnet', id: '196' },
            { name: 'zkLink Nova', id: '810180' },
            { name: 'Bitlayer Mainnet', id: '200901' },
            { name: 'Merlin', id: '4200' },
            { name: 'Manta Pacific', id: '169' },
            { name: 'Blast', id: '81457' }
        ];
    }
}

// 在服务器启动前加载链列表
loadSupportedChains();

// 模糊匹配链名称
function fuzzyMatchChain(name, chains) {
    name = name.toLowerCase();
    return chains.find(chain => {
        const chainName = (chain.name || '').toLowerCase();
        return chainName.includes(name) || name.includes(chainName);
    });
}

// 验证以太坊地址格式
function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// 新增：1/0转✅/❌辅助函数
function boolToEmoji(val) {
    if (val === 1 || val === '1') return '✅';
    if (val === 0 || val === '0') return '❌';
    if (val === true) return '✅';
    if (val === false) return '❌';
    if (val === undefined || val === null) return '未知';
    return val; // 保留"未知"或其他原始值
}

// 格式化安全分析结果为飞书消息卡片
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
        // 1. Contract Security
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: `**合约地址**: ${address}`
            }
        });

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**合约安全**"
            }
        });

        // 只输出非未知项
        const contractSecurity = [
            [`开源`, boolToEmoji(data.is_open_source)],
            [`代理`, boolToEmoji(data.is_proxy)],
            [`可铸造`, boolToEmoji(data.is_mintable)],
            [`所有者地址`, data.owner_address ?? '未知'],
            [`可收回所有权`, boolToEmoji(data.can_take_back_ownership)],
            [`所有者变更余额`, boolToEmoji(data.owner_change_balance)],
            [`隐藏所有者`, boolToEmoji(data.hidden_owner)],
            [`自毁`, boolToEmoji(data.selfdestruct)],
            [`外部调用`, boolToEmoji(data.external_call)],
            [`Gas滥用`, boolToEmoji(data.gas_abuse)]
        ].filter(([k, v]) => v !== '未知')
         .map(([k, v]) => `${k}: ${v}`);

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: contractSecurity.join('\n')
            }
        });

        // 2. Trading Security
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**交易安全**"
            }
        });

        const tradingSecurity = [
            [`在DEX中`, boolToEmoji(data.is_in_dex)],
            [`买入税`, boolToEmoji(data.buy_tax)],
            [`卖出税`, boolToEmoji(data.sell_tax)],
            [`转账税`, boolToEmoji(data.transfer_tax)],
            [`无法买入`, boolToEmoji(data.cannot_buy)],
            [`无法全部卖出`, boolToEmoji(data.cannot_sell_all)],
            [`滑点可修改`, boolToEmoji(data.slippage_modifiable)],
            [`蜜罐`, boolToEmoji(data.is_honeypot)],
            [`转账可暂停`, boolToEmoji(data.transfer_pausable)],
            [`黑名单`, boolToEmoji(data.is_blacklisted)],
            [`白名单`, boolToEmoji(data.is_whitelisted)],
            [`反鲸鱼`, boolToEmoji(data.is_anti_whale)],
            [`反鲸鱼可修改`, boolToEmoji(data.anti_whale_modifiable)],
            [`交易冷却`, boolToEmoji(data.trading_cooldown)],
            [`个人滑点可修改`, boolToEmoji(data.personal_slippage_modifiable)]
        ].filter(([k, v]) => v !== '未知')
         .map(([k, v]) => `${k}: ${v}`);

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: tradingSecurity.join('\n')
            }
        });

        // 3. Info Security
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**代币信息**"
            }
        });

        const tokenInfo = [
            [`代币名称`, data.token_name ?? '未知'],
            [`代币符号`, data.token_symbol ?? '未知'],
            [`持有人数量`, data.holder_count ?? '未知'],
            [`总供应量`, data.total_supply ?? '未知']
        ].filter(([k, v]) => v !== '未知')
         .map(([k, v]) => `${k}: ${v}`);

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: tokenInfo.join('\n')
            }
        });

        // Top10 LP 持币地址
        if (Array.isArray(data.lp_holders) && data.lp_holders.length > 0) {
            const top10 = data.lp_holders.slice(0, 10).map((h, idx) => {
                const addr = h.address ?? '未知';
                const bal = h.balance ?? '未知';
                const pct = h.percent ?? '未知';
                const locked = h.is_locked !== undefined && h.is_locked !== null ? (h.is_locked ? '✅' : '❌') : '';
                const tag = h.tag ? ` | Tag: ${h.tag}` : '';
                let line = `#${idx + 1} ${addr}`;
                if (bal !== '未知') line += ` | 余额: ${bal}`;
                if (pct !== '未知') line += ` | 占比: ${pct}%`;
                if (locked) line += ` | Locked: ${locked}`;
                if (tag) line += tag;
                return line;
            });
            elements.push({
                tag: "div",
                text: {
                    tag: "lark_md",
                    content: `**Top10 LP 持币地址**\n${top10.join('\n')}`
                }
            });
        }

        // 5. Advanced Info
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**高级信息**"
            }
        });

        const advancedInfo = [
            [`空投诈骗`, boolToEmoji(data.is_airdrop_scam)],
            [`信任列表`, boolToEmoji(data.trust_list)],
            [`其他潜在风险`, boolToEmoji(data.other_potential_risks)],
            [`备注`, data.note ?? '未知']
        ].filter(([k, v]) => v !== '未知')
         .map(([k, v]) => `${k}: ${v}`);

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

// 创建事件分发器
const eventDispatcher = new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
        try {
            console.log('开始处理消息事件');
            console.log('事件数据:', JSON.stringify(data, null, 2));
            
            // 检查事件数据结构
            if (!data.message) {
                console.error('无效的事件数据结构:', data);
                return { code: 1, msg: '无效的事件数据结构' };
            }

            const open_chat_id = data.message.chat_id;
            const msg = JSON.parse(data.message.content).text;
            console.log('收到消息:', msg);

            // 检查空消息
            if (!msg || !msg.trim()) {
                console.log('收到空消息');
                await client.im.message.create({
                    params: {
                        receive_id_type: 'chat_id',
                    },
                    data: {
                        receive_id: open_chat_id,
                        content: JSON.stringify({
                            text: "请输入要查询的代币信息"
                        }),
                        msg_type: 'text',
                    },
                });
                return { code: 0 };
            }

            // 解析用户输入
            const parts = msg.trim().split(/\s+/);
            if (parts.length !== 2) {
                console.log('消息格式错误');
                await client.im.message.create({
                    params: {
                        receive_id_type: 'chat_id',
                    },
                    data: {
                        receive_id: open_chat_id,
                        content: JSON.stringify({
                            text: "请按照以下格式输入：\n链名称或ID 合约地址\n例如：\nEthereum 0x408e41876cccdc0f92210600ef50372656052a38"
                        }),
                        msg_type: 'text',
                    },
                });
                return { code: 0 };
            }

            const [chainInput, address] = parts;
            console.log('解析结果:', { chainInput, address });

            // 验证地址格式
            if (!isValidAddress(address)) {
                console.log('地址格式无效');
                await client.im.message.create({
                    params: {
                        receive_id_type: 'chat_id',
                    },
                    data: {
                        receive_id: open_chat_id,
                        content: JSON.stringify({
                            text: "无效的代币地址格式，请确保地址以0x开头，长度为42个字符"
                        }),
                        msg_type: 'text',
                    },
                });
                return { code: 0 };
            }

            // 查找链
            let chainId;
            if (/^\d+$/.test(chainInput)) {
                chainId = parseInt(chainInput);
            } else {
                const chain = fuzzyMatchChain(chainInput, SUPPORTED_CHAINS);
                if (!chain) {
                    console.log('未找到匹配的链');
                    await client.im.message.create({
                        params: {
                            receive_id_type: 'chat_id',
                        },
                        data: {
                            receive_id: open_chat_id,
                            content: JSON.stringify({
                                text: "未找到匹配的链，请检查链名称或ID是否正确"
                            }),
                            msg_type: 'text',
                        },
                    });
                    return { code: 0 };
                }
                chainId = chain.id;
            }
            console.log('找到链ID:', chainId);

            // 发送处理中的消息
            console.log('发送处理中消息');
            await client.im.message.create({
                params: {
                    receive_id_type: 'chat_id',
                },
                data: {
                    receive_id: open_chat_id,
                    content: JSON.stringify({
                        text: "正在分析代币安全性，请稍候..."
                    }),
                    msg_type: 'text',
                },
            });

            // 获取安全分析结果
            console.log('开始获取安全分析结果');
            const result = await checkTokenSecurity(chainId, address);
            console.log('获取到安全分析结果');
            
            // 发送结果卡片
            console.log('发送结果卡片');
            await client.im.message.create({
                params: {
                    receive_id_type: 'chat_id',
                },
                data: {
                    receive_id: open_chat_id,
                    content: JSON.stringify(formatSecurityAnalysisToCard(result)),
                    msg_type: 'interactive',
                },
            });
            console.log('消息处理完成');
            return { code: 0 };
        } catch (error) {
            console.error('处理消息时出错:', error);
            try {
                if (open_chat_id) {
                    await client.im.message.create({
                        params: {
                            receive_id_type: 'chat_id',
                        },
                        data: {
                            receive_id: open_chat_id,
                            content: JSON.stringify({
                                text: `处理消息时出错: ${error.message}`
                            }),
                            msg_type: 'text',
                        },
                    });
                }
            } catch (sendError) {
                console.error('发送错误消息时出错:', sendError);
            }
            return { code: 1, msg: error.message };
        }
    }
});

// 用于存储已处理的事件ID
const processedEvents = new Set();

// 创建服务器
const server = http.createServer(async (req, res) => {
    console.log('收到新请求:', req.method, req.url);
    
    try {
        const data = await pickRequestData(req);
        console.log('解析后的请求数据:', JSON.stringify(data, null, 2));
        
        // 检查是否是URL验证请求
        if (data.type === 'url_verification') {
            console.log('处理URL验证请求');
            // 验证token
            if (data.token !== VERIFICATION_TOKEN) {
                console.error('验证token不匹配');
                res.statusCode = 403;
                res.end(JSON.stringify({ error: 'Invalid token' }));
                return;
            }
            res.end(JSON.stringify({ challenge: data.challenge }));
            return;
        }

        // 检查事件token
        if (data.header && data.header.token !== VERIFICATION_TOKEN) {
            console.error('事件token不匹配');
            res.statusCode = 403;
            res.end(JSON.stringify({ error: 'Invalid token' }));
            return;
        }

        // 检查事件ID是否已处理
        const eventId = data.header?.event_id;
        if (eventId) {
            if (processedEvents.has(eventId)) {
                console.log('跳过重复事件:', eventId);
                res.end(JSON.stringify({}));
                return;
            }
            console.log('处理新事件:', eventId);
            processedEvents.add(eventId);
            // 设置一个定时器，5分钟后删除事件ID
            setTimeout(() => {
                console.log('清理过期事件ID:', eventId);
                processedEvents.delete(eventId);
            }, 5 * 60 * 1000);
        }

        // 使用飞书SDK的中间件处理请求
        console.log('开始处理事件:', data.header?.event_type);
        const result = await eventDispatcher.invoke(data);
        console.log('事件处理结果:', result);
        res.end(JSON.stringify(result || {}));
    } catch (error) {
        console.error('处理请求时出错:', error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
});

server.listen(PORT, () => {
    console.log(`服务器已启动，监听端口 ${PORT}`);
    console.log('飞书机器人已准备就绪');
});