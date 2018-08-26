//geth --datadir /tmp/tmpdata --dev --rpc --rpcapi debug,eth
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
//solc --combined-json abi,bin,bin-runtime,srcmap-runtime test/contracts.sol > test/contracts.json
const contract = require('./contracts.json');

(async function main () {
    const ACCOUNT = (await web3.eth.getAccounts())[0];

    const BAR = contract.contracts['test/contracts.sol:Bar'];
    var deploy = (new web3.eth.Contract(JSON.parse(BAR.abi))).deploy({data: '0x'+BAR.bin, arguments: []});
    var gas = await deploy.estimateGas();
    const bar = await deploy.send({from: ACCOUNT, gas: gas});

    console.log('bar:', bar.options.address);

    const FOO = contract.contracts['test/contracts.sol:Foo'];
    deploy = (new web3.eth.Contract(JSON.parse(FOO.abi))).deploy({data: '0x'+FOO.bin, arguments: [bar.options.address]});
    gas = await deploy.estimateGas();
    const foo = await deploy.send({from: ACCOUNT, gas: gas});

    console.log('foo:', foo.options.address);

    const FOO_FOO = foo.methods.foo("10");
    gas = await FOO_FOO.estimateGas();
    const r = await FOO_FOO.send({from: ACCOUNT, gas: gas});
    console.log(r);

})().catch(e=>console.log(e));
