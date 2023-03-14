# flash-loan tool
A tool for trader to quickly increase their defi positions through flash loans


## AAVE
```
npx hardhat run .\scripts\deploy.ts --network hardhat
```

```
npx hardhat run .\scripts\deployAndLSD.ts --network hardhat
```

目前AAVE的价格是使用USD作为单位的，chainlink传输的价格保留8位小数的X/USD价格。

## References

[Furucombo Flash Loan](https://docs.furucombo.app/using-furucombo-1/tutorials/flashloan-combo)

[AAVE Flash Loan](https://docs.aave.com/developers/guides/flash-loans)

[Sneak peek at Flash Loans](https://medium.com/aave/sneak-peek-at-flash-loans-f2b28a394d62)

[Uniswap V3 Flash](https://docs.uniswap.org/contracts/v3/guides/flash-integrations/calling-flash)

