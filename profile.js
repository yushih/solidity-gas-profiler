const assert = require('assert');
const fs = require('fs');
const binarysearch = require('binarysearch');
const Web3 = require('web3');

(async function main () {
    const PROVIDER = process.argv[2]; // "http://localhost:8545"
    const TX_HASH = process.argv[3];
    const CONTRACT_FILE = process.argv[4];
    const SOURCEMAP_FILE = process.argv[5];

    const provider = new Web3.providers.HttpProvider(PROVIDER);
    const web3 = new Web3(provider);

    web3.extend({methods: [
        {
            name: 'traceTx',
            call: 'debug_traceTransaction',
            params: 2
        }
    ]});
    // https://github.com/ethereum/go-ethereum/wiki/Tracing:-Introduction
    const trace = await web3.traceTx(TX_HASH, {disableStack: true, disableMemory: true, disableStorage: true}); //FIXME: not disabled

    const sourceMap = parseSourceMap(fs.readFileSync(SOURCEMAP_FILE, 'utf8'));
    
    const addr = (await web3.eth.getTransaction(TX_HASH)).to;
    const code = await web3.eth.getCode(addr);
    const pcToIdx = buildPcToInstructionMapping(code);

    console.log('Gas used by transaction:', (await web3.eth.getTransactionReceipt(TX_HASH)).gasUsed);

    const src = fs.readFileSync(CONTRACT_FILE, 'utf8');
    const lineOffsets = buildLineOffsets(src);

    const lineGas = [];

    var synthCost = 0;

    const bottomDepth = trace.structLogs[0].depth; // should be 1

    for (let i=0; i<trace.structLogs.length; ) {
        const {depth, error, gas, gasCost, op, pc, stack} = trace.structLogs[i];
        var cost;
        if (['CALL', 'CALLCODE', 'DELEGATECALL', 'STATICCALL'].includes(op)) {
            // for call instruction, gasCost is 63/64*gas, not real gas cost
            const gasBeforeCall = gas;
            do {
                i += 1;
            } while (trace.structLogs[i].depth > bottomDepth);
            cost = gasBeforeCall - trace.structLogs[i].gas;
        } else {
            i += 1;
            cost = gasCost;
        }

        const instructionIdx = pcToIdx[pc];
        const {s, l, f, j} = sourceMap[instructionIdx];
        if (f===-1) {
            synthCost += cost;
            continue;
        }
        const line = binarysearch.closest(lineOffsets, s);
        if (lineGas[line]===undefined) {
            lineGas[line] = cost;
        } else {
            lineGas[line] += cost;
        }
    } // for 


    src.split('\n').forEach((line, i) => {
        const gas = lineGas[i] || 0;
        console.log('%s\t\t%s', gas, line);
    });
    console.log('synthetic instruction gas', synthCost);

    //showAllPointsInSourceMap (sourceMap, src, lineOffsets);
})().catch(e=>console.log(e));

function showAllPointsInSourceMap (sourceMap, src, lineOffsets) {
    const linePoints = []; //line no -> number of points in source map
    sourceMap.forEach(instruction=>{
        if (instruction.f === -1) {
            return;
        }
        const s = instruction.s;
        const line = binarysearch.closest(lineOffsets, s);
        if (line === 0) {
            console.log('>>>', instruction);
        }
        if (linePoints[line] === undefined) {
            linePoints[line] = 1;
        } else {
            linePoints[line] += 1;
        }
    });

    src.split('\n').forEach((line, i) => {
        const points = linePoints[i] || 0;
        console.log('%s\t%s\t%s\t\t%s', i, lineOffsets[i], points, line);
    });

}

function buildLineOffsets (src) {
    var accu = 0;
    return src.split('\n').map(line=>{
        const ret = accu;
        accu += line.length+1;
        return ret;
    });
}

function buildPcToInstructionMapping (code0xHexStr) {
    const mapping = {};
    const codeHexStr = code0xHexStr.slice(2);
    var instructionIndex = 0;
    for (let pc=0; pc<codeHexStr.length/2;) {
        mapping[pc] = instructionIndex;

        const byteHex = codeHexStr[pc*2]+codeHexStr[pc*2+1];
        const byte = parseInt(byteHex, 16);

        // PUSH instruction has immediates
        if (byte >= 0x60 && byte <= 0x7f) {
            const n = byte-0x60+1; // number of immediates
            pc += (n+1);
        } else {
            pc += 1;
        }

        instructionIndex += 1;
    }
    return mapping;
}

// https://solidity.readthedocs.io/en/develop/miscellaneous.html#source-mappings
function parseSourceMap (raw) {
    var prevS, prevL, prevF, prevJ;
    return raw.trim().split(';').map(section=> {
        var [s,l,f,j] = section.split(':');

        if (s==='' || s===undefined) {
            s = prevS;
        } else {
            prevS = s;
        }

        if (l==='' || l===undefined) {
            l = prevL;
        } else {
            prevL = l;
        }

        if (f==='' || f===undefined) {
            f = prevF;
        } else {
            prevF = f;
        }

        if (j==='' || j===undefined) {
            j = prevJ;
        } else {
            prevJ = j;
        }
        
        return {s:Number(s), l:Number(l), f:Number(f), j};
    });
}
