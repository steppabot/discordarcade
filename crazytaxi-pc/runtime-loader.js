/* Generated bundle identities; older browsers keep the Asyncify build. */
'use strict';
{
 const builds={"asyncify": {"loader": "game.js", "suspension": "asyncify", "wasmSHA256": "3eb84bd7efc7771f1ff855754ad6825078ab2def1fe71e803dd62be8fb7126be"}};
 const nativeStack=typeof WebAssembly.Suspending==='function'&&typeof WebAssembly.promising==='function';
 self.portSelectedBuild=nativeStack&&builds.jspi?builds.jspi:builds.asyncify;
 if(!self.portSelectedBuild)throw new Error('Missing browser build configuration. Rebuild this project.');
 Module.print('[RUNTIME] suspension='+self.portSelectedBuild.suspension+' wasm='+self.portSelectedBuild.wasmSHA256);
 importScripts(self.portSelectedBuild.loader);
}
