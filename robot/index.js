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

// 验证地址格式
function isValidAddress(address) {
    // 支持以太坊地址格式（0x开头，42个字符）
    const ethPattern = /^0x[a-fA-F0-9]{40}$/;
    // 支持 Solana 地址格式（base58编码，32-44个字符）
    const solPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    return ethPattern.test(address) || solPattern.test(address);
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
        // 1. 代币基本信息
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: `**合约地址**: ${address}`
            }
        });

        // 2. 代币信息
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**代币信息**"
            }
        });

        const tokenInfo = [
            [`名称`, data.metadata?.name || data.token_name],
            [`符号`, data.metadata?.symbol || data.token_symbol],
            [`描述`, data.metadata?.description],
            [`持有人数量`, data.holder_count ? data.holder_count.toLocaleString() : null],
            [`总供应量`, data.total_supply ? parseFloat(data.total_supply).toLocaleString() : null]
        ].filter(([k, v]) => v !== null && v !== undefined && v !== '未知')
         .map(([k, v]) => `${k}: ${v}`);

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: tokenInfo.join('\n')
            }
        });

        // 3. 合约安全
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**合约安全**"
            }
        });

        const contractSecurity = [
            [`是否开源`, boolToEmoji(data.is_open_source)],
            [`是否代理`, boolToEmoji(data.is_proxy)],
            [`是否可铸造`, boolToEmoji(data.is_mintable || data.mintable?.status === '1')],
            [`是否可冻结`, boolToEmoji(data.freezable?.status === '1')],
            [`是否可关闭`, boolToEmoji(data.closable?.status === '1')],
            [`是否可转账`, boolToEmoji(data.non_transferable === '0')],
            [`是否可信代币`, boolToEmoji(data.trusted_token === 1)],
            [`是否可暂停转账`, boolToEmoji(data.transfer_pausable === '1')],
            [`是否可自毁`, boolToEmoji(data.selfdestruct === '1')],
            [`是否可外部调用`, boolToEmoji(data.external_call === '1')]
        ].filter(([k, v]) => v !== '未知')
         .map(([k, v]) => `${k}: ${v}`);

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: contractSecurity.join('\n')
            }
        });

        // 4. 交易安全
        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: "**交易安全**"
            }
        });

        const tradingSecurity = [
            [`是否在DEX中`, boolToEmoji(data.is_in_dex)],
            [`是否在CEX中`, boolToEmoji(data.is_in_cex?.listed === '1')],
            [`买入税`, data.buy_tax ? `${data.buy_tax}%` : '0%'],
            [`卖出税`, data.sell_tax ? `${data.sell_tax}%` : '0%'],
            [`转账税`, data.transfer_tax ? `${data.transfer_tax}%` : '0%'],
            [`是否黑名单`, boolToEmoji(data.is_blacklisted === '1')],
            [`是否白名单`, boolToEmoji(data.is_whitelisted === '1')],
            [`是否反鲸鱼`, boolToEmoji(data.is_anti_whale === '1')],
            [`是否蜜罐`, boolToEmoji(data.is_honeypot === '1')]
        ].filter(([k, v]) => v !== '未知')
         .map(([k, v]) => `${k}: ${v}`);

        elements.push({
            tag: "div",
            text: {
                tag: "lark_md",
                content: tradingSecurity.join('\n')
            }
        });

        // 5. DEX 信息
        if (data.dex && data.dex.length > 0) {
            elements.push({
                tag: "div",
                text: {
                    tag: "lark_md",
                    content: "**DEX 信息**"
                }
            });

            const mainDex = data.dex[0];
            const dexInfo = [
                [`DEX名称`, mainDex.dex_name || mainDex.name],
                [`流动性类型`, mainDex.liquidity_type],
                [`流动性`, mainDex.liquidity ? `$${parseFloat(mainDex.liquidity).toLocaleString()}` : null],
                [`价格`, mainDex.price ? `$${parseFloat(mainDex.price).toLocaleString()}` : null],
                [`TVL`, mainDex.tvl ? `$${parseFloat(mainDex.tvl).toLocaleString()}` : null]
            ].filter(([k, v]) => v !== null && v !== undefined && v !== '未知')
             .map(([k, v]) => `${k}: ${v}`);

            elements.push({
                tag: "div",
                text: {
                    tag: "lark_md",
                    content: dexInfo.join('\n')
                }
            });
        }

        // 6. 持有者分布
        if (data.holders && data.holders.length > 0) {
            elements.push({
                tag: "div",
                text: {
                    tag: "lark_md",
                    content: "**前10大持有者**"
                }
            });

            const holdersInfo = data.holders.slice(0, 10).map((holder, index) => {
                const addr = holder.address || holder.account;
                if (!addr) return null;
                const shortAddr = addr.length > 16 ? `${addr.slice(0, 8)}...${addr.slice(-8)}` : addr;
                const balance = parseFloat(holder.balance).toLocaleString();
                const percent = parseFloat(holder.percent).toFixed(4);
                return `${index + 1}. ${shortAddr}: ${balance} (${percent}%)`;
            }).filter(Boolean);

            elements.push({
                tag: "div",
                text: {
                    tag: "lark_md",
                    content: holdersInfo.join('\n')
                }
            });
        }

        // 7. 元数据权限
        if (data.metadata_mutable) {
            elements.push({
                tag: "div",
                text: {
                    tag: "lark_md",
                    content: "**元数据权限**"
                }
            });

            const metadataInfo = [
                [`可升级`, boolToEmoji(data.metadata_mutable.status === '1')]
            ];

            if (data.metadata_mutable.metadata_upgrade_authority) {
                const authority = data.metadata_mutable.metadata_upgrade_authority[0];
                if (authority) {
                    metadataInfo.push(
                        [`升级权限地址`, authority.address],
                        [`是否恶意地址`, boolToEmoji(authority.malicious_address === 1)]
                    );
                }
            }

            elements.push({
                tag: "div",
                text: {
                    tag: "lark_md",
                    content: metadataInfo.map(([k, v]) => `${k}: ${v}`).join('\n')
                }
            });
        }
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
        let open_chat_id;  // 将变量声明移到函数开头
        try {
            console.log('开始处理消息事件');
            console.log('事件数据:', JSON.stringify(data, null, 2));
            
            // 检查事件数据结构
            if (!data.message) {
                console.error('无效的事件数据结构:', data);
                return { code: 1, msg: '无效的事件数据结构' };
            }

            open_chat_id = data.message.chat_id;  // 在这里赋值
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
                            text: "无效的代币地址格式，请确保地址符合以下格式之一：\n1. 以太坊地址：以0x开头，长度为42个字符\n2. Solana地址：Base58编码，长度为32-44个字符"
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