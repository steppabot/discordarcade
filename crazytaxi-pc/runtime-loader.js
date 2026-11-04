/* Generated bundle identities; older browsers keep the Asyncify build. */
'use strict';
{
 const builds={"asyncify": {"loader": "game.js", "suspension": "asyncify", "wasmSHA256": "c08831b3420772ad8c0abf420464720c632bad48b0735566264243f51ed33b70", "wasmFile": "game-c08831b3420772ad.wasm.gz"}, "jspi": {"loader": "game-jspi.js", "suspension": "jspi", "wasmSHA256": "a7d0d22c0d0dc5b30aa1573ff64f110f641ec1fca9ccb64123c62f601ae3d8bd", "wasmFile": "game-jspi-a7d0d22c0d0dc5b3.wasm.gz"}};
 const nativeStack=typeof WebAssembly.Suspending==='function'&&typeof WebAssembly.promising==='function';
 self.portSelectedBuild=nativeStack&&builds.jspi?builds.jspi:builds.asyncify;
 if(!self.portSelectedBuild)throw new Error('Missing browser build configuration. Rebuild this project.');
 Module.print('[RUNTIME] suspension='+self.portSelectedBuild.suspension+' wasm='+self.portSelectedBuild.wasmSHA256);
 importScripts(self.portSelectedBuild.loader+self.location.search);
}
