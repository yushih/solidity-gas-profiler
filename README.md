Profiles gas consumption of a transaction line-by-line.

Uses `debug_traceTransaction`, for which geth must run with `--rpcapi debug,eth` flag. Note that ganache supports this API but the return is different from geth, which I suspect is a bug and will examine further later. Currently does not work with ganache.

Requires sourcemap, which is produced by `solc--combined-json srcmap-runtime`.

Command line:
`node profile.js <RPC endpoint> <tx hash> <.sol file path> <sourcemap file path>`

Sample output for profiling `foo(10)`:
```
Gas used by transaction: 183443
0		pragma solidity ^0.4.24;
0		
0		contract Bar {
0		    uint s;
0		    
0		    function bar (uint i) public returns (uint) {
0		        s = s + i;
0		        return s;
0		    }    
0		}
0		
84		contract Foo {
0		    uint s;
0		    Bar bar;
0		    
0		    constructor (address a) public {
0		        bar = Bar(a);
0		    }
0		
89		    function foo (uint c) public  {
598		        for (uint i=0; i<c; i++ ) {
155069		            s = bar.bar(i);
0		        }
0		
226		        if (s > 1) {
5233		            s += 1;
0		        }       
0		    }
0		}
0		
synthetic instruction gas 680
```
