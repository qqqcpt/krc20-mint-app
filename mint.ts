import { RpcClient, Resolver, ScriptBuilder, Opcodes, PrivateKey, addressFromScriptPublicKey, createTransactions, kaspaToSompi } from "./wasm/kaspa"
import minimist from 'minimist';

// 解析命令行参数
const args = minimist(process.argv.slice(2));

const privateKeyArg = args.privKey;
const ticker = args.ticker || "TNACHO";
const priorityFeeValue = args.priorityFee || 0.1;
//const timeout = args.timeout || 2000;
const networkId = args.networkId || 'testnet-10';
const mintNumber = args.mintNumber || 1;

if (priorityFeeValue > 2) {
  console.error("priorityFee不能超过2kas。");
  process.exit(1);
}


function log(msg: string, level: string = 'INFO') {
  const timestamp = new Date().toLocaleString();
  if (level === 'ERROR') {
    console.error(`[${timestamp}] [${level}] ${msg}`);
  }
  else if (level === 'INFO') {
    console.log(`[${timestamp}] [${level}] ${msg}`);
  }
}


function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


const privateKey = new PrivateKey(privateKeyArg)
const publicKey = privateKey.toPublicKey()
const address = publicKey.toAddress(networkId)
console.log(`钱包地址: ${address.toString()}`);

const data = { "p": "krc-20", "op": "mint", "tick": ticker.toString().toUpperCase() };

const script = new ScriptBuilder()
  .addData(publicKey.toXOnlyPublicKey().toString())
  .addOp(Opcodes.OpCheckSig)
  .addOp(Opcodes.OpFalse)
  .addOp(Opcodes.OpIf)
  .addData(Buffer.from("kasplex"))
  .addI64(0n)
  .addData(Buffer.from(JSON.stringify(data, null, 0)))
  .addOp(Opcodes.OpEndIf)

const P2SHAddress = addressFromScriptPublicKey(script.createPayToScriptHashScript(), networkId)!


const RPC = new RpcClient({
  resolver: new Resolver(),
  networkId: networkId
});


log(`正在连接RPC...`, 'INFO');
await RPC.connect()
log(`RPC连接成功`, 'INFO');

log(`开始铸造...`, 'INFO');
let revealSuccesscount = 0;
while (revealSuccesscount < mintNumber) {
  try {
    let revealUTXOs = await RPC.getUtxosByAddresses({ addresses: [P2SHAddress.toString()] });

    if (revealUTXOs.entries.length == 0) {
      const { entries } = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
      const { transactions } = await createTransactions({
        entries,
        outputs: [{
          address: P2SHAddress.toString(),
          amount: kaspaToSompi("3.1")!
        }],
        changeAddress: address.toString(),
        priorityFee: kaspaToSompi(priorityFeeValue.toString())!,
        networkId: networkId
      });

      const transaction = transactions[0];
      transaction.sign([privateKey]);
      await transaction.submit(RPC);

      revealUTXOs = await RPC.getUtxosByAddresses({ addresses: [P2SHAddress.toString()] });
      let count = 10;
      while (revealUTXOs.entries.length == 0 && count-- > 0) {
        await delay(1000);
        revealUTXOs = await RPC.getUtxosByAddresses({ addresses: [P2SHAddress.toString()] });
      }
    }

    for (const entry of revealUTXOs.entries) {
      try {
        const { transactions } = await createTransactions({
          entries: [entry],
          outputs: [],
          changeAddress: address.toString(),
          priorityFee: kaspaToSompi((priorityFeeValue + 1).toString())!,
          networkId: networkId
        });

        const transaction = transactions[0];
        transaction.sign([privateKey], false);
        const signature = transaction.createInputSignature(0, privateKey);
        transaction.fillInput(0, script.encodePayToScriptHashSignatureScript(signature));

        await transaction.submit(RPC);

        revealSuccesscount++;
        log(`铸造进度: ${revealSuccesscount}/${mintNumber}`, 'INFO');

        if (revealSuccesscount >= mintNumber) {
          break;
        }
      }
      catch (revealError) {
        continue;
      }
    }
  }
  catch (commitError) {
    if (commitError == "Insufficient funds") {
      log(`Commit交易发送失败：钱包余额不足`, 'ERROR');
    }
    await delay(3000);
  }
}

log(`铸造完成`, 'INFO');
await RPC.disconnect();
process.exit(0);