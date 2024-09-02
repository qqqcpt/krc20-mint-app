# Krc20MintApp 使用说明

## 1、首先安装bun运行环境，具体参考以下链接
https://bun.sh/docs/installation

## 2、首次运行该工具前需要在软件根目录下先执行 `bun install`。

## 3、运行工具：在软件根目录下执行 `bun run mint.ts --privKey 钱包私钥 --ticker TNACHO --mintNumber 要铸造的次数 --priorityFee 0.01 --networkId testnet-10`

## 注意：如果铸造进度太慢或卡住不动，可以关闭当前铸造进程，在重新运行工具时上调priorityFee。



