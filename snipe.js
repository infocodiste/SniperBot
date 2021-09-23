const ethers = require('ethers')
const chalk = require('chalk')
require('dotenv').config();

const TokenContract = process.env.TokenContract  
const tokenDecimals = process.env.tokenDecimals 
const amountIn = ethers.utils.parseUnits(process.env.amount_WBNB_buy, 'ether')
const amountOutMin = ethers.utils.parseUnits(process.env.slippage, 'ether')
const gasPrice = ethers.utils.parseUnits(process.env.Gwei, 'gwei')
const gasLimit = process.env.Gas
const txNumberForAntibot = process.env.nrOfTransactionsToDo 
const WSS = process.env.QuickNodeMainNet 
const privateKey = process.env.privateKey
let expected = parseInt(process.env.liquidityBNB).toFixed(0)

let needApproval = false
if(process.env.needApproval == 'true'){
    needApproval = true 
}

let priceProttection = false
if(process.env.priceProttection == 'true'){
  priceProttection = true 
}

let buyOnly = false
if(process.env.buyOrSnipe == '2'){
    buyOnly = true
}

let dxsalePresale = 1
if(process.env.listingType == '2'){
  dxsalePresale = 2
}

let instantSell = false
if(process.env.instantSell == 'true'){
    instantSell = true
}

let antiRug = false
if (process.env.antiRug == 'true') {
  antiRug = true
}

const delaySell = process.env.sellDelay
const multiply = parseInt(process.env.multiplyX)
let delayOnSellMs = delaySell * 1000
let currentNonce = 0

let antiBotMultiTx = false
if(process.env.antiBotActive == 'true'){
    antiBotMultiTx = true
}

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
const BUSD = '0xe9e7cea3dedca5984780bafc599bd69add087d56'
const pcsRouterV2Addr = '0x10ED43C718714eb63d5aA57B78B54704E256024E'
const factoryRouter = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'
const addLiquidityETH = "0xf305d719"
const addLiquidity = "0xe8e33700"
const removeLiquidity = "0xbaa2abde";
const removeLiquidityETH = "0x02751cec";
const removeLiquidityETHSupportingFeeOnTransferTokens = "0xaf2979eb";
const removeLiquidityETHWithPermit = "0xded9382a";
const removeLiquidityETHWithPermitSupportingFeeOnTransferTokens = "0x5b0d5984";
const removeLiquidityWithPermit = "0x2195995c";

const token = TokenContract.toLowerCase().substring(2)
const tokenAddress = '0x'+ token

async function getNonce(addr) {
  const nonce = await provider.getTransactionCount(addr)
  return nonce
}


const isLiqudityInRange = function(tx, expected){
  expected = parseFloat(expected);
  const errorMarginn = parseInt(expected).toString();
  const result = ethers.utils.parseUnits(errorMarginn, "ether");
 return tx.value.gte(result);
}

async function getTokenBalance(tokenAddress, address, provider) {
  const abi = [
    {
      name: 'balanceOf',
      type: 'function',
      inputs: [
        {
          name: '_owner',
          type: 'address',
        },
      ],
      outputs: [
        {
          name: 'balance',
          type: 'uint256',
        },
      ],
      constant: true,
      payable: false,
    },
  ];

  const contract = new ethers.Contract(tokenAddress, abi, provider)
  const balance = await contract.balanceOf(address)
  return balance
}

async function getWBNBTokenBalance(WBNB, address, provider) {
  const abi = [
    {
      name: 'balanceOf',
      type: 'function',
      inputs: [
        {
          name: '_owner',
          type: 'address',
        },
      ],
      outputs: [
        {
          name: 'balance',
          type: 'uint256',
        },
      ],
      constant: true,
      payable: false,
    },
  ];

  const contract = new ethers.Contract(WBNB, abi, provider)
  const balanceWBNB = await contract.balanceOf(address)
  return balanceWBNB
}

const provider = new ethers.providers.WebSocketProvider(WSS)
const wallet = new ethers.Wallet(privateKey)
const myAddress = wallet.address
const account = wallet.connect(provider)
provider.removeAllListeners()

const pcsRouterV2B = new ethers.Contract(
  pcsRouterV2Addr,
  ['function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'],
  account
);

const pcsRouterV2 = new ethers.Contract(
  pcsRouterV2Addr,
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
  ],
  account
);

const tokenContract = new ethers.Contract(
  tokenAddress,
  ['function approve(address spender, uint256 amount) external returns (bool)'],
  account
);


const monitorRugPull = async function (balance, currentNonce) {
  console.log(chalk.red(`Monitoring for rug pull in progress ....\n`));
  provider.on("pending", async (tx) => {
    const transaction = await provider.getTransaction(tx)
    if ((transaction != null && transaction['data'].includes(token)) &&  (transaction['data'].includes(removeLiquidity) || transaction['data'].includes(removeLiquidityETH) || transaction['data'].includes(removeLiquidityETHSupportingFeeOnTransferTokens) || transaction['data'].includes(removeLiquidityETHWithPermit) || transaction['data'].includes(removeLiquidityETHWithPermitSupportingFeeOnTransferTokens) || transaction['data'].includes(removeLiquidityWithPermit))) {
      console.log(chalk.red(`Rug pull detected\n`))
      const frontrunGas = transaction.gasLimit.mul(2);
      const frontrunPrice = transaction.gasPrice.mul(2);
      console.log(chalk.red(`Start selling all tokens`))
      const selltx = await pcsRouterV2.swapExactTokensForETHSupportingFeeOnTransferTokens(
        balance,
        amountOutMin,
        [tokenAddress, WBNB],
        myAddress,
        Date.now() + 1000 * 60 * 10,
        { gasLimit: frontrunGas, gasPrice: frontrunPrice, nonce: currentNonce++ }
      )

      await selltx.wait();
      console.log(chalk.green(`Sucessfully sold all the tokens before rug pull !\n`));
      console.log(`You can check the transaction here:`);
      console.log(`https://bscscan.com/address/${myAddress}`);
      process.exit(0);
    }
  })
}


if(dxsalePresale == 1){

 
  (async () => {
    const factory = new ethers[('Contract')](factoryRouter, ['event PairCreated(address indexed token0, address indexed token1, address pair, uint)', 'function getPair(address tokenA, address tokenB) external view returns (address pair)'], account)
    currentNonce = await getNonce(myAddress)
    let balanceWBNB = await getWBNBTokenBalance(WBNB, myAddress, provider)
    console.log(chalk.red(`WARNING: This Sniper mode detects only listings with presale (DxSale).`))
    console.log(chalk.magenta(`For Support contact developer on https://t.me/multisniperbots.`))
    console.log(chalk.green(`Connected to blockchain... \n`))
    console.log(chalk.red(`Sniper started with current settings:`))
    console.log(chalk.green('Buy token for '+chalk.yellow(amountIn/1000000000000000000)+' WBNB using '+chalk.yellow(gasLimit)+' Gas and '+chalk.yellow(gasPrice/1000000000)+' Gwei'))
    console.log(chalk.green(`Total WBNB balance is ${chalk.yellow(parseFloat(ethers.utils.formatUnits(balanceWBNB, 18)).toFixed(6))}\n`))
       
        if(needApproval){
          console.log(`Approve token: `+chalk.green('YES'))
        }else{
          console.log(`Approve token: `+chalk.red('NO'))
        }
  
        if(buyOnly){
          console.log(`Buy only token: `+chalk.green('YES'))
        }else{
          if(dxsalePresale == 2){
            console.log('Snipe token: '+chalk.green('YES')+' // Fees Multiplication X '+chalk.green(multiply))
          }else{
            console.log('Snipe token: '+chalk.green('YES')+' // Listing from '+chalk.green('DxSale'))
          }
        }
  
        if(antiBotMultiTx){
          console.log(`Antibot active: `+chalk.green('YES'))
          console.log(`Multiple transactions set to: `+chalk.green(txNumberForAntibot))
        }else{
          console.log(`Antibot active: `+chalk.red('NO'))
          console.log('Multiple transactions forced to: '+chalk.green('YES'))
        }
  
        if(instantSell){
          console.log(`Instant Sell token: `+chalk.green('YES'))
          console.log('Selling will be done after '+chalk.yellow(delaySell)+' second(s) from buy confirmation!')
        }else{
          console.log(`Instant Sell token: `+chalk.red('NO'))
        }
   
    console.log(`Your current nounce is: ${chalk.yellow(currentNonce)}\n`)
    console.log(chalk.red(`Please press CTRL + C to stop the bot if the settings are incorect! \n`))

      if (needApproval) {
        console.log(chalk.green('Start approving token...'))
        try {
          const tx = await tokenContract.approve(
            pcsRouterV2Addr,
            ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
            { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
          )
          await tx.wait()
          console.log(chalk.green('Token spending approved. \n'))
        } catch (e) {
          console.log(e)
          console.log(chalk.red(`Unexpected error on approving, token is not approved !!! \n`))
        }
      }

      if(buyOnly){   
        if(antiBotMultiTx){
          
            for (i = 0; i < (txNumberForAntibot-1); i++) {
              console.log(chalk.green(`Start buying token...`+chalk.yellow((i+1))))
              const buytx = await pcsRouterV2B.swapExactTokensForTokens(
              amountIn,
              amountOutMin,
              [WBNB, tokenAddress],
              myAddress,
              Date.now() + 1000 * 60 * 10,
              { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
              ) 
            } 
              console.log(chalk.green(`Start buying token...`)+chalk.yellow(txNumberForAntibot))
              const buytx = await pcsRouterV2B.swapExactTokensForTokens(
              amountIn,
              amountOutMin,
              [WBNB, tokenAddress],
              myAddress,
              Date.now() + 1000 * 60 * 10,
              { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
              ) 
            await buytx.wait() 
        }else{
    
          console.log(chalk.green(`Start buying token...`))
          const buytx = await pcsRouterV2B.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          [WBNB, tokenAddress],
          myAddress,
          Date.now() + 1000 * 60 * 10,
          { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
        ) 
        await buytx.wait() 
        }
     
        console.log(chalk.green('Sucessfully bought the token!\n'))
      
        let balance = await getTokenBalance(tokenAddress, myAddress, provider)
        console.log(chalk.green(`Total Token balance is ${chalk.yellow(parseFloat(ethers.utils.formatUnits(balance, tokenDecimals)).toFixed(6))}\n`))
        if(instantSell){
          console.log(chalk.green(`Start selling all tokens in `+chalk.yellow(delaySell)+' second(s)'))
          await new Promise(r => setTimeout(r, delayOnSellMs))
              const selltx = await pcsRouterV2.swapExactTokensForETHSupportingFeeOnTransferTokens(
                balance,
                amountOutMin,
                [tokenAddress, WBNB],
                myAddress,
                Date.now() + 1000 * 60 * 10,
                { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
              )
              await selltx.wait()
              console.log(chalk.green(`Sucessfully sold all the tokens !\n`))
              console.log(`You can check the transaction here:`)
              console.log(`https://bscscan.com/address/${myAddress}`)
              process.exit(0)
        }else{
          console.log(`You can check the transaction here:`)
          console.log(`https://bscscan.com/address/${myAddress}`)
          process.exit(0)
        }
        
      }else{

    pairDetect = await factory.getPair(WBNB, tokenAddress);
    console.log('Scaning pair Address :' + chalk.yellow(pairDetect));
    console.log( chalk.green('Waiting for liquidity to be added! '));
    const dxsaleDetect = new ethers[('Contract')](pairDetect, ['event Mint(address indexed sender, uint amount0, uint amount1)'], account);
    dxsaleDetect.on('Mint', async (_0x862d5, _0x4bc59b, _0x4335ba) => {
       console.log( chalk.green('Liquidity detected, starting snipe! '));

      if(antiBotMultiTx){  
            for (i = 0; i < (txNumberForAntibot-1); i++) {
              console.log(chalk.green(`Start buying token...`+chalk.yellow((i+1))))
              const buytx = await pcsRouterV2B.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [WBNB, tokenAddress],
                myAddress,
                Date.now() + 1000 * 60 * 10,
                { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
               ) 
            } 
              console.log(chalk.green(`Start buying token...`+chalk.yellow(txNumberForAntibot)))
              const buytx = await pcsRouterV2B.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [WBNB, tokenAddress],
                myAddress,
                Date.now() + 1000 * 60 * 10,
                { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
               ) 
              await buytx.wait() 
      }else{

              console.log(chalk.green(`Start buying token...`))
              const buytx = await pcsRouterV2B.swapExactTokensForTokens(
              amountIn,
              amountOutMin,
              [WBNB, tokenAddress],
              myAddress,
              Date.now() + 1000 * 60 * 10,
              { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
              ) 
              await buytx.wait() 
      }

   console.log(chalk.green('Sucessfully bought the token!\n'))
   const balance = await getTokenBalance(tokenAddress, myAddress, provider)

   console.log(chalk.green(`Total Token balance is ${chalk.yellow(parseFloat(ethers.utils.formatUnits(balance, tokenDecimals)).toFixed(6))}\n`))

   if(instantSell){
          console.log(chalk.green(`Start selling all tokens in `+chalk.yellow(delaySell)+' second(s)'))
          await new Promise(r => setTimeout(r, delayOnSellMs))
          const selltx = await pcsRouterV2.swapExactTokensForETHSupportingFeeOnTransferTokens(
            balance,
            amountOutMin,
            [tokenAddress, WBNB],
            myAddress,
            Date.now() + 1000 * 60 * 10,
            { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
          )
      
          await selltx.wait()
          console.log(chalk.green(`Sucessfully sold all the tokens !\n`))
          console.log(`You can check the transaction here:`)
          console.log(`https://bscscan.com/address/${myAddress}`)
          process.exit(0)
      
              }else{
                    console.log(`You can check the transaction here:`)
                    console.log(`https://bscscan.com/address/${myAddress}`)
                    process.exit(0)
                  }
                  
    })
  }
  })()
  

}else{

  (async () => {
    currentNonce = await getNonce(myAddress)
    let balanceWBNB = await getWBNBTokenBalance(WBNB, myAddress, provider)
    console.log(chalk.red(`WARNING: This Sniper mode detects only Fair Launch.`))
    console.log(chalk.magenta(`For Support contact developer on https://t.me/multisniperbots.`))
    console.log(chalk.green(`Connected to blockchain... \n`))
    console.log(chalk.green(`Sniper started with current settings:`))
    console.log(chalk.green('Buy token for '+chalk.yellow(amountIn/1000000000000000000)+' WBNB using '+chalk.yellow(gasLimit)+' Gas and '+chalk.yellow(gasPrice/1000000000)+' Gwei'))
    console.log(chalk.green(`Total WBNB balance is ${chalk.yellow(parseFloat(ethers.utils.formatUnits(balanceWBNB, 18)).toFixed(6))}\n`))
    if(needApproval){
      console.log(`Approve token: `+chalk.green('YES'))
    }else{
      console.log(`Approve token: `+chalk.red('NO'))
    }
  
    if(buyOnly){
      console.log(`Buy only token: `+chalk.green('YES'))
    }else{
      console.log('Snipe token: '+chalk.green('YES')+' // Fees Multiplication X '+chalk.yellow(multiply))
    }
    
    if(antiBotMultiTx){
      console.log(`Antibot active: `+chalk.green('YES'))
      console.log(`Multiple transactions set to: `+chalk.yellow(txNumberForAntibot))
    }else{
      console.log(`Antibot active: `+chalk.red('NO'))
      console.log(`Multiple transactions forced to: `+chalk.yellow('1'))
    }

    if(priceProttection){
      console.log(`Price Protection active: `+chalk.green('YES'))
      console.log(`Expected Liquidity : `+chalk.yellow(expected))
    }else{
      console.log(`Price Protection active: `+chalk.red('NO'))
    }

    if(antiRug == true  && instantSell == false){
      console.log(`Rug Pull Protection active: `+chalk.green('YES'))
    }else{
      console.log(`Rug Pull Protection active: `+chalk.red('NO'))
    }
  
    if(instantSell){
      console.log(`Instant Sell token: `+chalk.green('YES'))
      console.log('Selling will be done after '+chalk.yellow(delaySell)+' second(s) from buy confirmation!')
    }else{
      console.log(`Instant Sell token: `+chalk.red('NO'))
    }
   
    console.log(`Your current nounce is: ${chalk.yellow(currentNonce)}\n`)
    console.log(chalk.red(`Please press CTRL + C to stop the bot if the settings are incorect! \n`))
 
    if (needApproval) {
      console.log(chalk.green('Start approving token...'))
      try {
        const tx = await tokenContract.approve(
          pcsRouterV2Addr,
          ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
          { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
        )
        await tx.wait()
        console.log(chalk.green('Token spending approved. \n'))
      } catch (e) {
        console.log(e)
        console.log(chalk.red(`Unexpected error on approving, token is not approved !!! \n`))
      }
    }
  
    if(buyOnly){   
      if(antiBotMultiTx){
        
          for (i = 0; i < (txNumberForAntibot-1); i++) {
            console.log(chalk.green(`Start buying token...`+chalk.yellow((i+1))))
            const buytx = await pcsRouterV2B.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            [WBNB, tokenAddress],
            myAddress,
            Date.now() + 1000 * 60 * 10,
            { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
            ) 
          } 
            console.log(chalk.green(`Start buying token...`)+chalk.yellow(txNumberForAntibot))
            const buytx = await pcsRouterV2B.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            [WBNB, tokenAddress],
            myAddress,
            Date.now() + 1000 * 60 * 10,
            { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
            ) 
          await buytx.wait() 
      }else{
  
        console.log(chalk.green(`Start buying token...`))
        const buytx = await pcsRouterV2B.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        [WBNB, tokenAddress],
        myAddress,
        Date.now() + 1000 * 60 * 10,
        { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
      ) 
      await buytx.wait() 
      }
      
      console.log(chalk.green('Sucessfully bought the token!\n'))
    
      let balance = await getTokenBalance(tokenAddress, myAddress, provider)
      console.log(chalk.green(`Total Token balance is ${chalk.yellow(parseFloat(ethers.utils.formatUnits(balance, tokenDecimals)).toFixed(6))}\n`))
      if(instantSell){
        console.log(chalk.green(`Start selling all tokens in `+chalk.yellow(delaySell)+' second(s)'))
        await new Promise(r => setTimeout(r, delayOnSellMs))
            const selltx = await pcsRouterV2.swapExactTokensForETHSupportingFeeOnTransferTokens(
              balance,
              amountOutMin,
              [tokenAddress, WBNB],
              myAddress,
              Date.now() + 1000 * 60 * 10,
              { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
            )
            await selltx.wait()
            console.log(chalk.green(`Sucessfully sold all the tokens !\n`))
            console.log(`You can check the transaction here:`)
            console.log(`https://bscscan.com/address/${myAddress}`)
            process.exit(0)
      }else{
        console.log(`You can check the transaction here:`)
        console.log(`https://bscscan.com/address/${myAddress}`)
        if (antiRug == true && instantSell == false) {
          await monitorRugPull(balance, currentNonce);
        }
        if(antiRug == false){
          process.exit(0);
        } 
      }
      
    }else{
   
    console.log(`Listening on mempool...`)
    console.log(`Waiting for liquidity to be added!`)
    provider.on("pending", async (tx) => {
      const transaction = await provider.getTransaction(tx)
     
      
      if (transaction != null && transaction['data'].includes(addLiquidity) && transaction['data'].includes(token) || transaction != null && transaction['data'].includes(addLiquidityETH) && transaction['data'].includes(token)) {
        console.log(chalk.green(`Matching liquidity added! Start sniping!\n`))
        
        if(priceProttection){
          const validateLiquidity = isLiqudityInRange(transaction,expected)
          if(validateLiquidity){
            console.log(chalk.green(`Liquidity check passed, sniping!\n`))
            const frontrunGas = transaction.gasLimit.mul(multiply)
            const frontrunPrice = transaction.gasPrice.mul(multiply)
       
            if(antiBotMultiTx){  
             for (i = 0; i < (txNumberForAntibot-1); i++) {
               console.log(chalk.green(`Start buying token...`+chalk.yellow((i+1))))
               const buytx = await pcsRouterV2B.swapExactTokensForTokens(
               amountIn,
               amountOutMin,
               [WBNB, tokenAddress],
               myAddress,
               Date.now() + 1000 * 60 * 10,
               { gasLimit: frontrunGas, gasPrice: frontrunPrice, nonce: currentNonce++ }
             ) 
             } 
               console.log(chalk.green(`Start buying token...`)+chalk.yellow(txNumberForAntibot))
               const buytx = await pcsRouterV2B.swapExactTokensForTokens(
               amountIn,
               amountOutMin,
               [WBNB, tokenAddress],
               myAddress,
               Date.now() + 1000 * 60 * 10,
               { gasLimit: frontrunGas, gasPrice: frontrunPrice, nonce: currentNonce++ }
             ) 
               await buytx.wait() 
           }else{
         
             console.log(chalk.green(`Start buying token...`))
             const buytx = await pcsRouterV2B.swapExactTokensForTokens(
             amountIn,
             amountOutMin,
             [WBNB, tokenAddress],
             myAddress,
             Date.now() + 1000 * 60 * 10,
             { gasLimit: frontrunGas, gasPrice: frontrunPrice, nonce: currentNonce++ }
           ) 
           await buytx.wait() 
           }
         
               console.log(chalk.green('Sucessfully bought the token!\n'))
               const balance = await getTokenBalance(tokenAddress, myAddress, provider)
         
               console.log(chalk.green(`Total Token balance is ${chalk.yellow(parseFloat(ethers.utils.formatUnits(balance, tokenDecimals)).toFixed(6))}\n`))
         
               if(instantSell){
                 console.log(chalk.green(`Start selling all tokens in `+chalk.yellow(delaySell)+' second(s)'))
                 await new Promise(r => setTimeout(r, delayOnSellMs))
                 const selltx = await pcsRouterV2.swapExactTokensForETHSupportingFeeOnTransferTokens(
                   balance,
                   amountOutMin,
                   [tokenAddress, WBNB],
                   myAddress,
                   Date.now() + 1000 * 60 * 10,
                   { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
                 )
             
                 await selltx.wait()
                 console.log(chalk.green(`Sucessfully sold all the tokens !\n`))
                 console.log(`You can check the transaction here:`)
                 console.log(`https://bscscan.com/address/${myAddress}`)
                 process.exit(0)
             
               }else{
                 console.log(`You can check the transaction here:`)
                 console.log(`https://bscscan.com/address/${myAddress}`)
                 if (antiRug == true && instantSell == false) {
                   await monitorRugPull(balance, currentNonce);
                 }
                 if(antiRug == false){
                   process.exit(0);
                 } 
               }


          }else{
            console.log(chalk.red(`Liquidity is not in expected range! Waiting...!`))
            console.log(chalk.red(`Please check PooCoin and see if liquidity was added!`))
            console.log(chalk.red(`https://poocoin.app/tokens/`+TokenContract))
            console.log(chalk.red(`Waiting for new liquidity, please stop the bot if you think it's a scam ! (CTRL + C)\n`))
            
          }
        }else{
          const frontrunGas = transaction.gasLimit.mul(multiply)
          const frontrunPrice = transaction.gasPrice.mul(multiply)
     
          if(antiBotMultiTx){  
           for (i = 0; i < (txNumberForAntibot-1); i++) {
             console.log(chalk.green(`Start buying token...`+chalk.yellow((i+1))))
             const buytx = await pcsRouterV2B.swapExactTokensForTokens(
             amountIn,
             amountOutMin,
             [WBNB, tokenAddress],
             myAddress,
             Date.now() + 1000 * 60 * 10,
             { gasLimit: frontrunGas, gasPrice: frontrunPrice, nonce: currentNonce++ }
           ) 
           } 
             console.log(chalk.green(`Start buying token...`)+chalk.yellow(txNumberForAntibot))
             const buytx = await pcsRouterV2B.swapExactTokensForTokens(
             amountIn,
             amountOutMin,
             [WBNB, tokenAddress],
             myAddress,
             Date.now() + 1000 * 60 * 10,
             { gasLimit: frontrunGas, gasPrice: frontrunPrice, nonce: currentNonce++ }
           ) 
             await buytx.wait() 
         }else{
       
           console.log(chalk.green(`Start buying token...`))
           const buytx = await pcsRouterV2B.swapExactTokensForTokens(
           amountIn,
           amountOutMin,
           [WBNB, tokenAddress],
           myAddress,
           Date.now() + 1000 * 60 * 10,
           { gasLimit: frontrunGas, gasPrice: frontrunPrice, nonce: currentNonce++ }
         ) 
         await buytx.wait() 
         }
       
             console.log(chalk.green('Sucessfully bought the token!\n'))
             const balance = await getTokenBalance(tokenAddress, myAddress, provider)
       
             console.log(chalk.green(`Total Token balance is ${chalk.yellow(parseFloat(ethers.utils.formatUnits(balance, tokenDecimals)).toFixed(6))}\n`))
       
             if(instantSell){
               console.log(chalk.green(`Start selling all tokens in `+chalk.yellow(delaySell)+' second(s)'))
               await new Promise(r => setTimeout(r, delayOnSellMs))
               const selltx = await pcsRouterV2.swapExactTokensForETHSupportingFeeOnTransferTokens(
                 balance,
                 amountOutMin,
                 [tokenAddress, WBNB],
                 myAddress,
                 Date.now() + 1000 * 60 * 10,
                 { gasLimit: gasLimit, gasPrice: gasPrice, nonce: currentNonce++ }
               )
           
               await selltx.wait()
               console.log(chalk.green(`Sucessfully sold all the tokens !\n`))
               console.log(`You can check the transaction here:`)
               console.log(`https://bscscan.com/address/${myAddress}`)
               process.exit(0)
           
             }else{
               console.log(`You can check the transaction here:`)
               console.log(`https://bscscan.com/address/${myAddress}`)
               if (antiRug == true && instantSell == false) {
                 await monitorRugPull(balance, currentNonce);
               }
               if(antiRug == false){
                 process.exit(0);
               } 
             }
        }
       
      
       
    
      }
    })

  }
  })()

}



