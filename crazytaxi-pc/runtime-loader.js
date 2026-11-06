/* Generated bundle identities; older browsers keep the Asyncify build. */
'use strict';
{
 const builds={"asyncify": {"loader": "game.js", "suspension": "asyncify", "wasmSHA256": "6c1fc629cc6adfa769fa7770c1203f715b78f8af6914799d447454200511e69a", "wasmFile": "game-6c1fc629cc6adfa7.wasm.gz"}, "jspi": {"loader": "game-jspi.js", "suspension": "jspi", "wasmSHA256": "799cd13902b137bba0f90a4ec134d71a088ba4c53c25075fd5015022e0ad52d3", "wasmFile": "game-jspi-799cd13902b137bb.wasm.gz"}};
 const nativeStack=typeof WebAssembly.Suspending==='function'&&typeof WebAssembly.promising==='function';
 self.portSelectedBuild=nativeStack&&builds.jspi?builds.jspi:builds.asyncify;
 if(!self.portSelectedBuild)throw new Error('Missing browser build configuration. Rebuild this project.');
 Module.print('[RUNTIME] suspension='+self.portSelectedBuild.suspension+' wasm='+self.portSelectedBuild.wasmSHA256);
 importScripts(self.portSelectedBuild.loader+self.location.search);
}
