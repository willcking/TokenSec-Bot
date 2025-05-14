# TokenSec-Bot

## 支持的代币格式

- **EVM地址**: 0x开头，42个字符（如：0x408e41876cccdc0f92210600ef50372656052a38）
- **Sol地址**: Base58编码，32-44个字符

## 安装配置

### 1. 克隆项目

```bash
git clone https://github.com/your-username/TokenSec-Bot.git
cd TokenSec-Bot/robot
```

### 2. 安装依赖

```bash
npm install
# 或使用 yarn
yarn install
```

### 3. 配置环境

在 `robot` 目录下的`config.js` 文件：

```javascript
module.exports = {
    APP_ID: 'your_app_id',
    APP_SECRET: 'your_app_secret',
    VERIFICATION_TOKEN: 'your_verification_token',
    PORT: 
};
```

### 4. 启动服务

```bash
yarn start
```

