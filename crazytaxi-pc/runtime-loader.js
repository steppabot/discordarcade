/* Generated bundle identities; older browsers keep the Asyncify build. */
'use strict';
{
 const builds={"asyncify": {"loader": "game.js", "suspension": "asyncify", "wasmSHA256": "49e257a6d0e93ab11bcb3c44d121b60d0ca34fced0503dad0b439c50968cb459", "wasmFile": "game-49e257a6d0e93ab1.wasm.gz", "yieldFrames": [1464,1465,1468,1469,1480,1487,1492,1493,1678,1689,1690,1824,1825,3171,3296,3305,3409,3612,4904,6308,6309,6479,6481,6658,7827,7962,8110,16003,50692,51305,52113,52192,52193,52708,57228,57230,57233,57253]}, "jspi": {"loader": "game-jspi.js", "suspension": "jspi", "wasmSHA256": "08507cb172c4503b7e1fce12437c476b6e859d8f0534e1bf232ec8a566f5dac0", "wasmFile": "game-jspi-08507cb172c4503b.wasm.gz"}};
 const nativeStack=typeof WebAssembly.Suspending==='function'&&typeof WebAssembly.promising==='function';
 self.portSelectedBuild=nativeStack&&builds.jspi?builds.jspi:builds.asyncify;
 if(!self.portSelectedBuild)throw new Error('Missing browser build configuration. Rebuild this project.');
 Module.print('[RUNTIME] suspension='+self.portSelectedBuild.suspension+' wasm='+self.portSelectedBuild.wasmSHA256);
 importScripts(self.portSelectedBuild.loader+self.location.search);
}
