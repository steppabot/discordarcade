/* Generated bundle identities; older browsers keep the Asyncify build. */
'use strict';
{
 const builds={"asyncify": {"loader": "game.js", "suspension": "asyncify", "wasmSHA256": "23d0921f20e33ee080180c001150fe6cad79e9bdf1ce4fa2c171695ece328c20", "wasmFile": "game-23d0921f20e33ee0.wasm.gz"}, "jspi": {"loader": "game-jspi.js", "suspension": "jspi", "wasmSHA256": "6209636eec93585888865da5a17b6912135f68cb521eca39c0f601add4bc7e1e", "wasmFile": "game-jspi-6209636eec935858.wasm.gz"}};
 const nativeStack=typeof WebAssembly.Suspending==='function'&&typeof WebAssembly.promising==='function';
 self.portSelectedBuild=nativeStack&&builds.jspi?builds.jspi:builds.asyncify;
 if(!self.portSelectedBuild)throw new Error('Missing browser build configuration. Rebuild this project.');
 Module.print('[RUNTIME] suspension='+self.portSelectedBuild.suspension+' wasm='+self.portSelectedBuild.wasmSHA256);
 importScripts(self.portSelectedBuild.loader+self.location.search);
}
