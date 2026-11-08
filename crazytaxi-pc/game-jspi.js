// include: shell.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != "undefined" ? Module : {};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).
var ENVIRONMENT_IS_WEB = false;

var ENVIRONMENT_IS_WORKER = true;

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = Object.assign({}, Module);

var arguments_ = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
  throw toThrow;
};

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document != "undefined" && document.currentScript) {
    // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.startsWith("blob:")) {
    scriptDirectory = "";
  } else {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
  }
  {
    // include: web_or_worker_shell_read.js
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = url => {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response));
      };
    }
    readAsync = async url => {
      var response = await fetch(url, {
        credentials: "same-origin"
      });
      if (response.ok) {
        return response.arrayBuffer();
      }
      throw new Error(response.status + " : " + response.url);
    };
  }
} else {}

var out = Module["print"] || console.log.bind(console);

var err = Module["printErr"] || console.error.bind(console);

// Merge back in the overrides
Object.assign(Module, moduleOverrides);

// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.
if (Module["arguments"]) arguments_ = Module["arguments"];

if (Module["thisProgram"]) thisProgram = Module["thisProgram"];

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===
// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html
var wasmBinary = Module["wasmBinary"];

// Wasm globals
var wasmMemory;

//========================================
// Runtime essentials
//========================================
// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// Memory management
var /** @type {!Int8Array} */ HEAP8, /** @type {!Uint8Array} */ HEAPU8, /** @type {!Int16Array} */ HEAP16, /** @type {!Uint16Array} */ HEAPU16, /** @type {!Int32Array} */ HEAP32, /** @type {!Uint32Array} */ HEAPU32, /** @type {!Float32Array} */ HEAPF32, /* BigInt64Array type is not correctly defined in closure
/** not-@type {!BigInt64Array} */ HEAP64, /* BigUint64Array type is not correctly defined in closure
/** not-t@type {!BigUint64Array} */ HEAPU64, /** @type {!Float64Array} */ HEAPF64;

var runtimeInitialized = false;

// include: URIUtils.js
// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = "data:application/octet-stream;base64,";

/**
 * Indicates whether filename is a base64 data URI.
 * @noinline
 */ var isDataURI = filename => filename.startsWith(dataURIPrefix);

// end include: URIUtils.js
// include: runtime_shared.js
// include: runtime_stack_check.js
// end include: runtime_stack_check.js
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
// include: runtime_debug.js
// end include: runtime_debug.js
// include: memoryprofiler.js
// end include: memoryprofiler.js
function updateMemoryViews() {
  var b = wasmMemory.buffer;
  Module["HEAP8"] = HEAP8 = new Int8Array(b);
  Module["HEAP16"] = HEAP16 = new Int16Array(b);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
  Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
  Module["HEAP32"] = HEAP32 = new Int32Array(b);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
  Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
  Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
  Module["HEAP64"] = HEAP64 = new BigInt64Array(b);
  Module["HEAPU64"] = HEAPU64 = new BigUint64Array(b);
}

// end include: runtime_shared.js
var __ATPRERUN__ = [];

// functions called before the runtime is initialized
var __ATINIT__ = [];

// functions called during startup
var __ATMAIN__ = [];

// functions called during shutdown
var __ATPOSTRUN__ = [];

// functions called after the main() is called
function preRun() {
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  runtimeInitialized = true;
  if (!Module["noFSInit"] && !FS.initialized) FS.init();
  FS.ignorePermissions = false;
  TTY.init();
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function postRun() {
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;

var dependenciesFulfilled = null;

// overridden to take different actions when all run dependencies are fulfilled
function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  Module["monitorRunDependencies"]?.(runDependencies);
}

function removeRunDependency(id) {
  runDependencies--;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (runDependencies == 0) {
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
}

/** @param {string|number=} what */ function abort(what) {
  Module["onAbort"]?.(what);
  what = "Aborted(" + what + ")";
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);
  ABORT = true;
  what += ". Build with -sASSERTIONS for more info.";
  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.
  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what);
  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

var wasmBinaryFile;

function findWasmBinary() {
  var f = "game-8888570ba1e983b4.wasm";
  if (!isDataURI(f)) {
    return locateFile(f);
  }
  return f;
}

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  throw "both async and sync fetching of the wasm failed";
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {}
  }
  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(binaryFile)) {
    try {
      var response = fetch(binaryFile, {
        credentials: "same-origin"
      });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err("falling back to ArrayBuffer instantiation");
    }
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // instrumenting imports is used in asyncify in two ways: to add assertions
  // that check for proper import use, and for ASYNCIFY=2 we use them to set up
  // the Promise API on the import side.
  Asyncify.instrumentWasmImports(wasmImports);
  // prepare imports
  return {
    "env": wasmImports,
    "wasi_snapshot_preview1": wasmImports
  };
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/ function receiveInstance(instance, module) {
    wasmExports = instance.exports;
    wasmExports = Asyncify.instrumentWasmExports(wasmExports);
    wasmMemory = wasmExports["memory"];
    updateMemoryViews();
    addOnInit(wasmExports["__wasm_call_ctors"]);
    removeRunDependency("wasm-instantiate");
    return wasmExports;
  }
  // wait for the pthread pool (if any)
  addRunDependency("wasm-instantiate");
  // Prefer streaming instantiation if available.
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    return receiveInstance(result["instance"]);
  }
  var info = getWasmImports();
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module["instantiateWasm"]) {
    try {
      return Module["instantiateWasm"](info, receiveInstance);
    } catch (e) {
      err(`Module.instantiateWasm callback failed with error: ${e}`);
      return false;
    }
  }
  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

// === Body ===
function __asyncjs__port_browser_yield() {
  return Asyncify.handleAsync(async () => {
    await Module.portBrowserYield();
  });
}

__asyncjs__port_browser_yield.sig = "v";

function __asyncjs__port_browser_idle_yield() {
  return Asyncify.handleAsync(async () => {
    await Module.portBrowserYield(1);
  });
}

__asyncjs__port_browser_idle_yield.sig = "v";

function port_yield_allowed() {
  return Module.portYieldAllowed ? Module.portYieldAllowed() : 1;
}

port_yield_allowed.sig = "i";

function __asyncjs__load_image_async(destination) {
  return Asyncify.handleAsync(async () => {
    try {
      const bytes = await portVmu.load();
      HEAPU8.set(bytes, destination);
      return 1;
    } catch (error) {
      postMessage({
        kind: "vmu-status",
        error: error.message
      });
      return 0;
    }
  });
}

__asyncjs__load_image_async.sig = "ii";

function __asyncjs__save_phase_async(block, phase, data) {
  return Asyncify.handleAsync(async () => {
    try {
      await portVmu.write(block, phase, HEAPU8.slice(data, data + 128));
      return 1;
    } catch (error) {
      postMessage({
        kind: "vmu-status",
        error: error.message
      });
      return 0;
    }
  });
}

__asyncjs__save_phase_async.sig = "iiii";

function load_image_ready(destination) {
  if (Module.portVmuImage === undefined) return -1;
  if (!Module.portVmuImage) return 0;
  HEAPU8.set(Module.portVmuImage, destination);
  return 1;
}

load_image_ready.sig = "ii";

function save_phase_queued(block, phase, data) {
  if (!Module.portVmuWrite) return -1;
  Module.portVmuWrite(block, phase, HEAPU8.slice(data, data + 128));
  return 1;
}

save_phase_queued.sig = "iiii";

function show_lcd(data) {
  postMessage({
    kind: "vmu-lcd",
    bytes: HEAPU8.slice(data, data + 192)
  });
}

show_lcd.sig = "vi";

function port_save_snapshot(ram, ram_bytes, vram, opaque, opaque_count, punch, punch_count, trans, trans_count, stride) {
  const parts = [ HEAPU8.slice(ram, ram + ram_bytes), HEAPU8.slice(vram, vram + 8388608), HEAPU8.slice(opaque, opaque + opaque_count * stride), HEAPU8.slice(punch, punch + punch_count * stride), HEAPU8.slice(trans, trans + trans_count * stride) ];
  const header = (new TextEncoder).encode(JSON.stringify({
    version: 1,
    ramBytes: ram_bytes,
    vramBytes: 8388608,
    stride,
    counts: [ opaque_count, punch_count, trans_count ],
    fields: [ "x", "y", "z", "u", "v", "r", "g", "b", "a", "pcw", "tsp", "tcw", "isp" ]
  }));
  const bytes = new Uint8Array(4 + header.length + parts.reduce((n, p) => n + p.length, 0));
  new DataView(bytes.buffer).setUint32(0, header.length, true);
  bytes.set(header, 4);
  let at = 4 + header.length;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  postMessage({
    kind: "snapshot",
    bytes: bytes.buffer
  }, [ bytes.buffer ]);
}

port_save_snapshot.sig = "viiiiiiiiii";

function port_gpu_begin() {
  let s = Module.portGpuTrace;
  if (!s) {
    const ext = GLctx.getExtension("EXT_disjoint_timer_query_webgl2");
    s = Module.portGpuTrace = {
      ext,
      frame: 0,
      pending: [],
      active: null,
      total: 0,
      max: 0,
      count: 0,
      reported: performance.now(),
      discarded: 0
    };
    Module.print("[GPU] asynchronous_timer_queries=" + (ext ? "enabled" : "unavailable"));
  }
  if (!s.ext || (++s.frame % 30) !== 0 || GLctx.isContextLost()) return;
  const disjoint = s.pending.length && GLctx.getParameter(s.ext.GPU_DISJOINT_EXT);
  for (let i = 0; i < s.pending.length; ) {
    const q = s.pending[i];
    if (!disjoint && !GLctx.getQueryParameter(q, GLctx.QUERY_RESULT_AVAILABLE)) {
      i++;
      continue;
    }
    if (disjoint) s.discarded++; else {
      const ms = GLctx.getQueryParameter(q, GLctx.QUERY_RESULT) / 1e6;
      s.total += ms;
      s.max = Math.max(s.max, ms);
      s.count++;
    }
    GLctx.deleteQuery(q);
    s.pending.splice(i, 1);
  }
  const now = performance.now();
  if (now - s.reported >= 5e3) {
    Module.print("[GPU] samples=" + s.count + " avg_ms=" + (s.count ? s.total / s.count : 0).toFixed(3) + " max_ms=" + s.max.toFixed(3) + " disjoint_discarded=" + s.discarded);
    s.total = s.max = s.count = s.discarded = 0;
    s.reported = now;
  }
  if (s.pending.length < 4) {
    const q = GLctx.createQuery();
    if (q) {
      s.active = q;
      GLctx.beginQuery(s.ext.TIME_ELAPSED_EXT, q);
    }
  }
}

port_gpu_begin.sig = "v";

function port_gpu_end() {
  const s = Module.portGpuTrace;
  if (s?.active) {
    GLctx.endQuery(s.ext.TIME_ELAPSED_EXT);
    s.pending.push(s.active);
    s.active = null;
  }
}

port_gpu_end.sig = "v";

function port_save_vram(ptr) {
  const bytes = HEAPU8.slice(ptr, ptr + 8388608).buffer;
  postMessage({
    kind: "vram",
    bytes
  }, [ bytes ]);
}

port_save_vram.sig = "vi";

function port_save_frame() {
  const w = Module.canvas.width, h = Module.canvas.height, pixels = new Uint8Array(w * h * 4);
  GLctx.readPixels(0, 0, w, h, GLctx.RGBA, GLctx.UNSIGNED_BYTE, pixels);
  const flipped = new Uint8ClampedArray(pixels.length), stride = w * 4;
  for (let y = 0; y < h; y++) flipped.set(pixels.subarray(y * stride, (y + 1) * stride), (h - 1 - y) * stride);
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext("2d").putImageData(new ImageData(flipped, w, h), 0, 0);
  canvas.convertToBlob({
    type: "image/png"
  }).then(blob => blob.arrayBuffer()).then(bytes => postMessage({
    kind: "frame",
    bytes
  }, [ bytes ]));
}

port_save_frame.sig = "v";

function port_disc_read_sync(url, data, size) {
  const bytes = Module.portDiscReadSync ? Module.portDiscReadSync(UTF8ToString(url)) : null;
  if (!bytes) return 0;
  const p = _malloc(bytes.length);
  if (!p) return 0;
  HEAPU8.set(bytes, p);
  HEAPU32[data >> 2] = p;
  HEAP32[size >> 2] = bytes.length;
  return 1;
}

port_disc_read_sync.sig = "iiii";

function port_audio_submit(data, frames) {
  if (Module.portAudioPush) Module.portAudioPush(HEAPF32.slice(data >> 2, (data >> 2) + frames * 2));
}

port_audio_submit.sig = "vii";

// end include: preamble.js
class ExitStatus {
  name="ExitStatus";
  constructor(status) {
    this.message = `Program terminated with exit(${status})`;
    this.status = status;
  }
}

var callRuntimeCallbacks = callbacks => {
  while (callbacks.length > 0) {
    // Pass the module as the first argument.
    callbacks.shift()(Module);
  }
};

var noExitRuntime = Module["noExitRuntime"] || true;

/** @suppress {duplicate } */ var syscallGetVarargI = () => {
  // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
  var ret = HEAP32[((+SYSCALLS.varargs) >> 2)];
  SYSCALLS.varargs += 4;
  return ret;
};

var syscallGetVarargP = syscallGetVarargI;

var PATH = {
  isAbs: path => path.charAt(0) === "/",
  splitPath: filename => {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  },
  normalizeArray: (parts, allowAboveRoot) => {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1);
      } else if (last === "..") {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (;up; up--) {
        parts.unshift("..");
      }
    }
    return parts;
  },
  normalize: path => {
    var isAbsolute = PATH.isAbs(path), trailingSlash = path.substr(-1) === "/";
    // Normalize the path
    path = PATH.normalizeArray(path.split("/").filter(p => !!p), !isAbsolute).join("/");
    if (!path && !isAbsolute) {
      path = ".";
    }
    if (path && trailingSlash) {
      path += "/";
    }
    return (isAbsolute ? "/" : "") + path;
  },
  dirname: path => {
    var result = PATH.splitPath(path), root = result[0], dir = result[1];
    if (!root && !dir) {
      // No dirname whatsoever
      return ".";
    }
    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1);
    }
    return root + dir;
  },
  basename: path => path && path.match(/([^\/]+|\/)\/*$/)[1],
  join: (...paths) => PATH.normalize(paths.join("/")),
  join2: (l, r) => PATH.normalize(l + "/" + r)
};

var initRandomFill = () => view => crypto.getRandomValues(view);

var randomFill = view => {
  // Lazily init on the first invocation.
  (randomFill = initRandomFill())(view);
};

var PATH_FS = {
  resolve: (...args) => {
    var resolvedPath = "", resolvedAbsolute = false;
    for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? args[i] : FS.cwd();
      // Skip empty and invalid entries
      if (typeof path != "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path) {
        return "";
      }
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = PATH.isAbs(path);
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(p => !!p), !resolvedAbsolute).join("/");
    return ((resolvedAbsolute ? "/" : "") + resolvedPath) || ".";
  },
  relative: (from, to) => {
    from = PATH_FS.resolve(from).substr(1);
    to = PATH_FS.resolve(to).substr(1);
    function trim(arr) {
      var start = 0;
      for (;start < arr.length; start++) {
        if (arr[start] !== "") break;
      }
      var end = arr.length - 1;
      for (;end >= 0; end--) {
        if (arr[end] !== "") break;
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..");
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/");
  }
};

var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder : undefined;

/**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number=} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */ var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead = NaN) => {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on
  // null terminator by itself.  Also, use the length info to avoid running tiny
  // strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation,
  // so that undefined/NaN means Infinity)
  while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
  }
  var str = "";
  // If building with TextDecoder, we have already computed the string length
  // above, so test loop end condition against that
  while (idx < endPtr) {
    // For UTF8 byte structure, see:
    // http://en.wikipedia.org/wiki/UTF-8#Description
    // https://www.ietf.org/rfc/rfc2279.txt
    // https://tools.ietf.org/html/rfc3629
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
};

var FS_stdin_getChar_buffer = [];

var lengthBytesUTF8 = str => {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var c = str.charCodeAt(i);
    // possibly a lead surrogate
    if (c <= 127) {
      len++;
    } else if (c <= 2047) {
      len += 2;
    } else if (c >= 55296 && c <= 57343) {
      len += 4;
      ++i;
    } else {
      len += 3;
    }
  }
  return len;
};

var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
  // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
  // undefined and false each don't write out any bytes.
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
    // and https://www.ietf.org/rfc/rfc2279.txt
    // and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i);
    // possibly a lead surrogate
    if (u >= 55296 && u <= 57343) {
      var u1 = str.charCodeAt(++i);
      u = 65536 + ((u & 1023) << 10) | (u1 & 1023);
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 192 | (u >> 6);
      heap[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 224 | (u >> 12);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      heap[outIdx++] = 240 | (u >> 18);
      heap[outIdx++] = 128 | ((u >> 12) & 63);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
};

/** @type {function(string, boolean=, number=)} */ function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

var FS_stdin_getChar = () => {
  if (!FS_stdin_getChar_buffer.length) {
    var result = null;
    {}
    if (!result) {
      return null;
    }
    FS_stdin_getChar_buffer = intArrayFromString(result, true);
  }
  return FS_stdin_getChar_buffer.shift();
};

var TTY = {
  ttys: [],
  init() {},
  shutdown() {},
  register(dev, ops) {
    TTY.ttys[dev] = {
      input: [],
      output: [],
      ops
    };
    FS.registerDevice(dev, TTY.stream_ops);
  },
  stream_ops: {
    open(stream) {
      var tty = TTY.ttys[stream.node.rdev];
      if (!tty) {
        throw new FS.ErrnoError(43);
      }
      stream.tty = tty;
      stream.seekable = false;
    },
    close(stream) {
      // flush any pending line data
      stream.tty.ops.fsync(stream.tty);
    },
    fsync(stream) {
      stream.tty.ops.fsync(stream.tty);
    },
    read(stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(60);
      }
      var bytesRead = 0;
      for (var i = 0; i < length; i++) {
        var result;
        try {
          result = stream.tty.ops.get_char(stream.tty);
        } catch (e) {
          throw new FS.ErrnoError(29);
        }
        if (result === undefined && bytesRead === 0) {
          throw new FS.ErrnoError(6);
        }
        if (result === null || result === undefined) break;
        bytesRead++;
        buffer[offset + i] = result;
      }
      if (bytesRead) {
        stream.node.atime = Date.now();
      }
      return bytesRead;
    },
    write(stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(60);
      }
      try {
        for (var i = 0; i < length; i++) {
          stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
        }
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
      if (length) {
        stream.node.mtime = stream.node.ctime = Date.now();
      }
      return i;
    }
  },
  default_tty_ops: {
    get_char(tty) {
      return FS_stdin_getChar();
    },
    put_char(tty, val) {
      if (val === null || val === 10) {
        out(UTF8ArrayToString(tty.output));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    fsync(tty) {
      if (tty.output && tty.output.length > 0) {
        out(UTF8ArrayToString(tty.output));
        tty.output = [];
      }
    },
    ioctl_tcgets(tty) {
      // typical setting
      return {
        c_iflag: 25856,
        c_oflag: 5,
        c_cflag: 191,
        c_lflag: 35387,
        c_cc: [ 3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
      };
    },
    ioctl_tcsets(tty, optional_actions, data) {
      // currently just ignore
      return 0;
    },
    ioctl_tiocgwinsz(tty) {
      return [ 24, 80 ];
    }
  },
  default_tty1_ops: {
    put_char(tty, val) {
      if (val === null || val === 10) {
        err(UTF8ArrayToString(tty.output));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    fsync(tty) {
      if (tty.output && tty.output.length > 0) {
        err(UTF8ArrayToString(tty.output));
        tty.output = [];
      }
    }
  }
};

var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;

var mmapAlloc = size => {
  abort();
};

var MEMFS = {
  ops_table: null,
  mount(mount) {
    return MEMFS.createNode(null, "/", 16895, 0);
  },
  createNode(parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      // no supported
      throw new FS.ErrnoError(63);
    }
    MEMFS.ops_table ||= {
      dir: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr,
          lookup: MEMFS.node_ops.lookup,
          mknod: MEMFS.node_ops.mknod,
          rename: MEMFS.node_ops.rename,
          unlink: MEMFS.node_ops.unlink,
          rmdir: MEMFS.node_ops.rmdir,
          readdir: MEMFS.node_ops.readdir,
          symlink: MEMFS.node_ops.symlink
        },
        stream: {
          llseek: MEMFS.stream_ops.llseek
        }
      },
      file: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr
        },
        stream: {
          llseek: MEMFS.stream_ops.llseek,
          read: MEMFS.stream_ops.read,
          write: MEMFS.stream_ops.write,
          allocate: MEMFS.stream_ops.allocate,
          mmap: MEMFS.stream_ops.mmap,
          msync: MEMFS.stream_ops.msync
        }
      },
      link: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr,
          readlink: MEMFS.node_ops.readlink
        },
        stream: {}
      },
      chrdev: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr
        },
        stream: FS.chrdev_stream_ops
      }
    };
    var node = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node.mode)) {
      node.node_ops = MEMFS.ops_table.dir.node;
      node.stream_ops = MEMFS.ops_table.dir.stream;
      node.contents = {};
    } else if (FS.isFile(node.mode)) {
      node.node_ops = MEMFS.ops_table.file.node;
      node.stream_ops = MEMFS.ops_table.file.stream;
      node.usedBytes = 0;
      // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
      // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
      // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
      // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
      node.contents = null;
    } else if (FS.isLink(node.mode)) {
      node.node_ops = MEMFS.ops_table.link.node;
      node.stream_ops = MEMFS.ops_table.link.stream;
    } else if (FS.isChrdev(node.mode)) {
      node.node_ops = MEMFS.ops_table.chrdev.node;
      node.stream_ops = MEMFS.ops_table.chrdev.stream;
    }
    node.atime = node.mtime = node.ctime = Date.now();
    // add the new node to the parent
    if (parent) {
      parent.contents[name] = node;
      parent.atime = parent.mtime = parent.ctime = node.atime;
    }
    return node;
  },
  getFileDataAsTypedArray(node) {
    if (!node.contents) return new Uint8Array(0);
    if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
    // Make sure to not return excess unused bytes.
    return new Uint8Array(node.contents);
  },
  expandFileStorage(node, newCapacity) {
    var prevCapacity = node.contents ? node.contents.length : 0;
    if (prevCapacity >= newCapacity) return;
    // No need to expand, the storage was already large enough.
    // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
    // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
    // avoid overshooting the allocation cap by a very large margin.
    var CAPACITY_DOUBLING_MAX = 1024 * 1024;
    newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>> 0);
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
    // At minimum allocate 256b for each file when expanding.
    var oldContents = node.contents;
    node.contents = new Uint8Array(newCapacity);
    // Allocate new storage.
    if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
  },
  resizeFileStorage(node, newSize) {
    if (node.usedBytes == newSize) return;
    if (newSize == 0) {
      node.contents = null;
      // Fully decommit when requesting a resize to zero.
      node.usedBytes = 0;
    } else {
      var oldContents = node.contents;
      node.contents = new Uint8Array(newSize);
      // Allocate new storage.
      if (oldContents) {
        node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
      }
      node.usedBytes = newSize;
    }
  },
  node_ops: {
    getattr(node) {
      var attr = {};
      // device numbers reuse inode numbers.
      attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
      attr.ino = node.id;
      attr.mode = node.mode;
      attr.nlink = 1;
      attr.uid = 0;
      attr.gid = 0;
      attr.rdev = node.rdev;
      if (FS.isDir(node.mode)) {
        attr.size = 4096;
      } else if (FS.isFile(node.mode)) {
        attr.size = node.usedBytes;
      } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length;
      } else {
        attr.size = 0;
      }
      attr.atime = new Date(node.atime);
      attr.mtime = new Date(node.mtime);
      attr.ctime = new Date(node.ctime);
      // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
      //       but this is not required by the standard.
      attr.blksize = 4096;
      attr.blocks = Math.ceil(attr.size / attr.blksize);
      return attr;
    },
    setattr(node, attr) {
      for (const key of [ "mode", "atime", "mtime", "ctime" ]) {
        if (attr[key] != null) {
          node[key] = attr[key];
        }
      }
      if (attr.size !== undefined) {
        MEMFS.resizeFileStorage(node, attr.size);
      }
    },
    lookup(parent, name) {
      throw MEMFS.doesNotExistError;
    },
    mknod(parent, name, mode, dev) {
      return MEMFS.createNode(parent, name, mode, dev);
    },
    rename(old_node, new_dir, new_name) {
      var new_node;
      try {
        new_node = FS.lookupNode(new_dir, new_name);
      } catch (e) {}
      if (new_node) {
        if (FS.isDir(old_node.mode)) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          for (var i in new_node.contents) {
            throw new FS.ErrnoError(55);
          }
        }
        FS.hashRemoveNode(new_node);
      }
      // do the internal rewiring
      delete old_node.parent.contents[old_node.name];
      new_dir.contents[new_name] = old_node;
      old_node.name = new_name;
      new_dir.ctime = new_dir.mtime = old_node.parent.ctime = old_node.parent.mtime = Date.now();
    },
    unlink(parent, name) {
      delete parent.contents[name];
      parent.ctime = parent.mtime = Date.now();
    },
    rmdir(parent, name) {
      var node = FS.lookupNode(parent, name);
      for (var i in node.contents) {
        throw new FS.ErrnoError(55);
      }
      delete parent.contents[name];
      parent.ctime = parent.mtime = Date.now();
    },
    readdir(node) {
      return [ ".", "..", ...Object.keys(node.contents) ];
    },
    symlink(parent, newname, oldpath) {
      var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
      node.link = oldpath;
      return node;
    },
    readlink(node) {
      if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(28);
      }
      return node.link;
    }
  },
  stream_ops: {
    read(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= stream.node.usedBytes) return 0;
      var size = Math.min(stream.node.usedBytes - position, length);
      if (size > 8 && contents.subarray) {
        // non-trivial, and typed array
        buffer.set(contents.subarray(position, position + size), offset);
      } else {
        for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
      }
      return size;
    },
    write(stream, buffer, offset, length, position, canOwn) {
      // If the buffer is located in main memory (HEAP), and if
      // memory can grow, we can't hold on to references of the
      // memory buffer, as they may get invalidated. That means we
      // need to do copy its contents.
      if (buffer.buffer === HEAP8.buffer) {
        canOwn = false;
      }
      if (!length) return 0;
      var node = stream.node;
      node.mtime = node.ctime = Date.now();
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        // This write is from a typed array to a typed array?
        if (canOwn) {
          node.contents = buffer.subarray(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (node.usedBytes === 0 && position === 0) {
          // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
          node.contents = buffer.slice(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (position + length <= node.usedBytes) {
          // Writing to an already allocated and used subrange of the file?
          node.contents.set(buffer.subarray(offset, offset + length), position);
          return length;
        }
      }
      // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
      MEMFS.expandFileStorage(node, position + length);
      if (node.contents.subarray && buffer.subarray) {
        // Use typed array write which is available.
        node.contents.set(buffer.subarray(offset, offset + length), position);
      } else {
        for (var i = 0; i < length; i++) {
          node.contents[position + i] = buffer[offset + i];
        }
      }
      node.usedBytes = Math.max(node.usedBytes, position + length);
      return length;
    },
    llseek(stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position;
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.usedBytes;
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(28);
      }
      return position;
    },
    allocate(stream, offset, length) {
      MEMFS.expandFileStorage(stream.node, offset + length);
      stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
    },
    mmap(stream, length, position, prot, flags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(43);
      }
      var ptr;
      var allocated;
      var contents = stream.node.contents;
      // Only make a new copy when MAP_PRIVATE is specified.
      if (!(flags & 2) && contents && contents.buffer === HEAP8.buffer) {
        // We can't emulate MAP_SHARED when the file is not backed by the
        // buffer we're mapping to (e.g. the HEAP buffer).
        allocated = false;
        ptr = contents.byteOffset;
      } else {
        allocated = true;
        ptr = mmapAlloc(length);
        if (!ptr) {
          throw new FS.ErrnoError(48);
        }
        if (contents) {
          // Try to avoid unnecessary slices.
          if (position > 0 || position + length < contents.length) {
            if (contents.subarray) {
              contents = contents.subarray(position, position + length);
            } else {
              contents = Array.prototype.slice.call(contents, position, position + length);
            }
          }
          HEAP8.set(contents, ptr);
        }
      }
      return {
        ptr,
        allocated
      };
    },
    msync(stream, buffer, offset, length, mmapFlags) {
      MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
      // should we check if bytesWritten and length are the same?
      return 0;
    }
  }
};

var asyncLoad = async url => {
  var arrayBuffer = await readAsync(url);
  return new Uint8Array(arrayBuffer);
};

asyncLoad.isAsync = true;

var FS_createDataFile = (parent, name, fileData, canRead, canWrite, canOwn) => {
  FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
};

var preloadPlugins = Module["preloadPlugins"] || [];

var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
  // Ensure plugins are ready.
  if (typeof Browser != "undefined") Browser.init();
  var handled = false;
  preloadPlugins.forEach(plugin => {
    if (handled) return;
    if (plugin["canHandle"](fullname)) {
      plugin["handle"](byteArray, fullname, finish, onerror);
      handled = true;
    }
  });
  return handled;
};

var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
  // TODO we should allow people to just pass in a complete filename instead
  // of parent and name being that we just join them anyways
  var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency(`cp ${fullname}`);
  // might have several active requests for the same fullname
  function processData(byteArray) {
    function finish(byteArray) {
      preFinish?.();
      if (!dontCreateFile) {
        FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
      }
      onload?.();
      removeRunDependency(dep);
    }
    if (FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
      onerror?.();
      removeRunDependency(dep);
    })) {
      return;
    }
    finish(byteArray);
  }
  addRunDependency(dep);
  if (typeof url == "string") {
    asyncLoad(url).then(processData, onerror);
  } else {
    processData(url);
  }
};

var FS_modeStringToFlags = str => {
  var flagModes = {
    "r": 0,
    "r+": 2,
    "w": 512 | 64 | 1,
    "w+": 512 | 64 | 2,
    "a": 1024 | 64 | 1,
    "a+": 1024 | 64 | 2
  };
  var flags = flagModes[str];
  if (typeof flags == "undefined") {
    throw new Error(`Unknown file open mode: ${str}`);
  }
  return flags;
};

var FS_getMode = (canRead, canWrite) => {
  var mode = 0;
  if (canRead) mode |= 292 | 73;
  if (canWrite) mode |= 146;
  return mode;
};

var FS = {
  root: null,
  mounts: [],
  devices: {},
  streams: [],
  nextInode: 1,
  nameTable: null,
  currentPath: "/",
  initialized: false,
  ignorePermissions: true,
  ErrnoError: class {
    name="ErrnoError";
    // We set the `name` property to be able to identify `FS.ErrnoError`
    // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
    // - when using PROXYFS, an error can come from an underlying FS
    // as different FS objects have their own FS.ErrnoError each,
    // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
    // we'll use the reliable test `err.name == "ErrnoError"` instead
    constructor(errno) {
      this.errno = errno;
    }
  },
  filesystems: null,
  syncFSRequests: 0,
  readFiles: {},
  FSStream: class {
    shared={};
    get object() {
      return this.node;
    }
    set object(val) {
      this.node = val;
    }
    get isRead() {
      return (this.flags & 2097155) !== 1;
    }
    get isWrite() {
      return (this.flags & 2097155) !== 0;
    }
    get isAppend() {
      return (this.flags & 1024);
    }
    get flags() {
      return this.shared.flags;
    }
    set flags(val) {
      this.shared.flags = val;
    }
    get position() {
      return this.shared.position;
    }
    set position(val) {
      this.shared.position = val;
    }
  },
  FSNode: class {
    node_ops={};
    stream_ops={};
    readMode=292 | 73;
    writeMode=146;
    mounted=null;
    constructor(parent, name, mode, rdev) {
      if (!parent) {
        parent = this;
      }
      this.parent = parent;
      this.mount = parent.mount;
      this.id = FS.nextInode++;
      this.name = name;
      this.mode = mode;
      this.rdev = rdev;
      this.atime = this.mtime = this.ctime = Date.now();
    }
    get read() {
      return (this.mode & this.readMode) === this.readMode;
    }
    set read(val) {
      val ? this.mode |= this.readMode : this.mode &= ~this.readMode;
    }
    get write() {
      return (this.mode & this.writeMode) === this.writeMode;
    }
    set write(val) {
      val ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
    }
    get isFolder() {
      return FS.isDir(this.mode);
    }
    get isDevice() {
      return FS.isChrdev(this.mode);
    }
  },
  lookupPath(path, opts = {}) {
    if (!path) {
      throw new FS.ErrnoError(44);
    }
    opts.follow_mount ??= true;
    if (!PATH.isAbs(path)) {
      path = FS.cwd() + "/" + path;
    }
    // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
    linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
      // split the absolute path
      var parts = path.split("/").filter(p => !!p);
      // start at the root
      var current = FS.root;
      var current_path = "/";
      for (var i = 0; i < parts.length; i++) {
        var islast = (i === parts.length - 1);
        if (islast && opts.parent) {
          // stop resolving
          break;
        }
        if (parts[i] === ".") {
          continue;
        }
        if (parts[i] === "..") {
          current_path = PATH.dirname(current_path);
          current = current.parent;
          continue;
        }
        current_path = PATH.join2(current_path, parts[i]);
        try {
          current = FS.lookupNode(current, parts[i]);
        } catch (e) {
          // if noent_okay is true, suppress a ENOENT in the last component
          // and return an object with an undefined node. This is needed for
          // resolving symlinks in the path when creating a file.
          if ((e?.errno === 44) && islast && opts.noent_okay) {
            return {
              path: current_path
            };
          }
          throw e;
        }
        // jump to the mount's root node if this is a mountpoint
        if (FS.isMountpoint(current) && (!islast || opts.follow_mount)) {
          current = current.mounted.root;
        }
        // by default, lookupPath will not follow a symlink if it is the final path component.
        // setting opts.follow = true will override this behavior.
        if (FS.isLink(current.mode) && (!islast || opts.follow)) {
          if (!current.node_ops.readlink) {
            throw new FS.ErrnoError(52);
          }
          var link = current.node_ops.readlink(current);
          if (!PATH.isAbs(link)) {
            link = PATH.dirname(current_path) + "/" + link;
          }
          path = link + "/" + parts.slice(i + 1).join("/");
          continue linkloop;
        }
      }
      return {
        path: current_path,
        node: current
      };
    }
    throw new FS.ErrnoError(32);
  },
  getPath(node) {
    var path;
    while (true) {
      if (FS.isRoot(node)) {
        var mount = node.mount.mountpoint;
        if (!path) return mount;
        return mount[mount.length - 1] !== "/" ? `${mount}/${path}` : mount + path;
      }
      path = path ? `${node.name}/${path}` : node.name;
      node = node.parent;
    }
  },
  hashName(parentid, name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return ((parentid + hash) >>> 0) % FS.nameTable.length;
  },
  hashAddNode(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    node.name_next = FS.nameTable[hash];
    FS.nameTable[hash] = node;
  },
  hashRemoveNode(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    if (FS.nameTable[hash] === node) {
      FS.nameTable[hash] = node.name_next;
    } else {
      var current = FS.nameTable[hash];
      while (current) {
        if (current.name_next === node) {
          current.name_next = node.name_next;
          break;
        }
        current = current.name_next;
      }
    }
  },
  lookupNode(parent, name) {
    var errCode = FS.mayLookup(parent);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    var hash = FS.hashName(parent.id, name);
    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
      var nodeName = node.name;
      if (node.parent.id === parent.id && nodeName === name) {
        return node;
      }
    }
    // if we failed to find it in the cache, call into the VFS
    return FS.lookup(parent, name);
  },
  createNode(parent, name, mode, rdev) {
    var node = new FS.FSNode(parent, name, mode, rdev);
    FS.hashAddNode(node);
    return node;
  },
  destroyNode(node) {
    FS.hashRemoveNode(node);
  },
  isRoot(node) {
    return node === node.parent;
  },
  isMountpoint(node) {
    return !!node.mounted;
  },
  isFile(mode) {
    return (mode & 61440) === 32768;
  },
  isDir(mode) {
    return (mode & 61440) === 16384;
  },
  isLink(mode) {
    return (mode & 61440) === 40960;
  },
  isChrdev(mode) {
    return (mode & 61440) === 8192;
  },
  isBlkdev(mode) {
    return (mode & 61440) === 24576;
  },
  isFIFO(mode) {
    return (mode & 61440) === 4096;
  },
  isSocket(mode) {
    return (mode & 49152) === 49152;
  },
  flagsToPermissionString(flag) {
    var perms = [ "r", "w", "rw" ][flag & 3];
    if ((flag & 512)) {
      perms += "w";
    }
    return perms;
  },
  nodePermissions(node, perms) {
    if (FS.ignorePermissions) {
      return 0;
    }
    // return 0 if any user, group or owner bits are set.
    if (perms.includes("r") && !(node.mode & 292)) {
      return 2;
    } else if (perms.includes("w") && !(node.mode & 146)) {
      return 2;
    } else if (perms.includes("x") && !(node.mode & 73)) {
      return 2;
    }
    return 0;
  },
  mayLookup(dir) {
    if (!FS.isDir(dir.mode)) return 54;
    var errCode = FS.nodePermissions(dir, "x");
    if (errCode) return errCode;
    if (!dir.node_ops.lookup) return 2;
    return 0;
  },
  mayCreate(dir, name) {
    if (!FS.isDir(dir.mode)) {
      return 54;
    }
    try {
      var node = FS.lookupNode(dir, name);
      return 20;
    } catch (e) {}
    return FS.nodePermissions(dir, "wx");
  },
  mayDelete(dir, name, isdir) {
    var node;
    try {
      node = FS.lookupNode(dir, name);
    } catch (e) {
      return e.errno;
    }
    var errCode = FS.nodePermissions(dir, "wx");
    if (errCode) {
      return errCode;
    }
    if (isdir) {
      if (!FS.isDir(node.mode)) {
        return 54;
      }
      if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
        return 10;
      }
    } else {
      if (FS.isDir(node.mode)) {
        return 31;
      }
    }
    return 0;
  },
  mayOpen(node, flags) {
    if (!node) {
      return 44;
    }
    if (FS.isLink(node.mode)) {
      return 32;
    } else if (FS.isDir(node.mode)) {
      if (FS.flagsToPermissionString(flags) !== "r" || (flags & (512 | 64))) {
        // TODO: check for O_SEARCH? (== search for dir only)
        return 31;
      }
    }
    return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
  },
  checkOpExists(op, err) {
    if (!op) {
      throw new FS.ErrnoError(err);
    }
    return op;
  },
  MAX_OPEN_FDS: 4096,
  nextfd() {
    for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
      if (!FS.streams[fd]) {
        return fd;
      }
    }
    throw new FS.ErrnoError(33);
  },
  getStreamChecked(fd) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(8);
    }
    return stream;
  },
  getStream: fd => FS.streams[fd],
  createStream(stream, fd = -1) {
    // clone it, so we can return an instance of FSStream
    stream = Object.assign(new FS.FSStream, stream);
    if (fd == -1) {
      fd = FS.nextfd();
    }
    stream.fd = fd;
    FS.streams[fd] = stream;
    return stream;
  },
  closeStream(fd) {
    FS.streams[fd] = null;
  },
  dupStream(origStream, fd = -1) {
    var stream = FS.createStream(origStream, fd);
    stream.stream_ops?.dup?.(stream);
    return stream;
  },
  chrdev_stream_ops: {
    open(stream) {
      var device = FS.getDevice(stream.node.rdev);
      // override node's stream ops with the device's
      stream.stream_ops = device.stream_ops;
      // forward the open call
      stream.stream_ops.open?.(stream);
    },
    llseek() {
      throw new FS.ErrnoError(70);
    }
  },
  major: dev => ((dev) >> 8),
  minor: dev => ((dev) & 255),
  makedev: (ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
    FS.devices[dev] = {
      stream_ops: ops
    };
  },
  getDevice: dev => FS.devices[dev],
  getMounts(mount) {
    var mounts = [];
    var check = [ mount ];
    while (check.length) {
      var m = check.pop();
      mounts.push(m);
      check.push(...m.mounts);
    }
    return mounts;
  },
  syncfs(populate, callback) {
    if (typeof populate == "function") {
      callback = populate;
      populate = false;
    }
    FS.syncFSRequests++;
    if (FS.syncFSRequests > 1) {
      err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
    }
    var mounts = FS.getMounts(FS.root.mount);
    var completed = 0;
    function doCallback(errCode) {
      FS.syncFSRequests--;
      return callback(errCode);
    }
    function done(errCode) {
      if (errCode) {
        if (!done.errored) {
          done.errored = true;
          return doCallback(errCode);
        }
        return;
      }
      if (++completed >= mounts.length) {
        doCallback(null);
      }
    }
    // sync all mounts
    mounts.forEach(mount => {
      if (!mount.type.syncfs) {
        return done(null);
      }
      mount.type.syncfs(mount, populate, done);
    });
  },
  mount(type, opts, mountpoint) {
    var root = mountpoint === "/";
    var pseudo = !mountpoint;
    var node;
    if (root && FS.root) {
      throw new FS.ErrnoError(10);
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, {
        follow_mount: false
      });
      mountpoint = lookup.path;
      // use the absolute path
      node = lookup.node;
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(10);
      }
      if (!FS.isDir(node.mode)) {
        throw new FS.ErrnoError(54);
      }
    }
    var mount = {
      type,
      opts,
      mountpoint,
      mounts: []
    };
    // create a root node for the fs
    var mountRoot = type.mount(mount);
    mountRoot.mount = mount;
    mount.root = mountRoot;
    if (root) {
      FS.root = mountRoot;
    } else if (node) {
      // set as a mountpoint
      node.mounted = mount;
      // add the new mount to the current mount's children
      if (node.mount) {
        node.mount.mounts.push(mount);
      }
    }
    return mountRoot;
  },
  unmount(mountpoint) {
    var lookup = FS.lookupPath(mountpoint, {
      follow_mount: false
    });
    if (!FS.isMountpoint(lookup.node)) {
      throw new FS.ErrnoError(28);
    }
    // destroy the nodes for this mount, and all its child mounts
    var node = lookup.node;
    var mount = node.mounted;
    var mounts = FS.getMounts(mount);
    Object.keys(FS.nameTable).forEach(hash => {
      var current = FS.nameTable[hash];
      while (current) {
        var next = current.name_next;
        if (mounts.includes(current.mount)) {
          FS.destroyNode(current);
        }
        current = next;
      }
    });
    // no longer a mountpoint
    node.mounted = null;
    // remove this mount from the child mounts
    var idx = node.mount.mounts.indexOf(mount);
    node.mount.mounts.splice(idx, 1);
  },
  lookup(parent, name) {
    return parent.node_ops.lookup(parent, name);
  },
  mknod(path, mode, dev) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    if (!name) {
      throw new FS.ErrnoError(28);
    }
    if (name === "." || name === "..") {
      throw new FS.ErrnoError(20);
    }
    var errCode = FS.mayCreate(parent, name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.mknod) {
      throw new FS.ErrnoError(63);
    }
    return parent.node_ops.mknod(parent, name, mode, dev);
  },
  statfs(path) {
    return FS.statfsNode(FS.lookupPath(path, {
      follow: true
    }).node);
  },
  statfsStream(stream) {
    // We keep a separate statfsStream function because noderawfs overrides
    // it. In noderawfs, stream.node is sometimes null. Instead, we need to
    // look at stream.path.
    return FS.statfsNode(stream.node);
  },
  statfsNode(node) {
    // NOTE: None of the defaults here are true. We're just returning safe and
    //       sane values. Currently nodefs and rawfs replace these defaults,
    //       other file systems leave them alone.
    var rtn = {
      bsize: 4096,
      frsize: 4096,
      blocks: 1e6,
      bfree: 5e5,
      bavail: 5e5,
      files: FS.nextInode,
      ffree: FS.nextInode - 1,
      fsid: 42,
      flags: 2,
      namelen: 255
    };
    if (node.node_ops.statfs) {
      Object.assign(rtn, node.node_ops.statfs(node.mount.opts.root));
    }
    return rtn;
  },
  create(path, mode = 438) {
    mode &= 4095;
    mode |= 32768;
    return FS.mknod(path, mode, 0);
  },
  mkdir(path, mode = 511) {
    mode &= 511 | 512;
    mode |= 16384;
    return FS.mknod(path, mode, 0);
  },
  mkdirTree(path, mode) {
    var dirs = path.split("/");
    var d = "";
    for (var i = 0; i < dirs.length; ++i) {
      if (!dirs[i]) continue;
      d += "/" + dirs[i];
      try {
        FS.mkdir(d, mode);
      } catch (e) {
        if (e.errno != 20) throw e;
      }
    }
  },
  mkdev(path, mode, dev) {
    if (typeof dev == "undefined") {
      dev = mode;
      mode = 438;
    }
    mode |= 8192;
    return FS.mknod(path, mode, dev);
  },
  symlink(oldpath, newpath) {
    if (!PATH_FS.resolve(oldpath)) {
      throw new FS.ErrnoError(44);
    }
    var lookup = FS.lookupPath(newpath, {
      parent: true
    });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44);
    }
    var newname = PATH.basename(newpath);
    var errCode = FS.mayCreate(parent, newname);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.symlink) {
      throw new FS.ErrnoError(63);
    }
    return parent.node_ops.symlink(parent, newname, oldpath);
  },
  rename(old_path, new_path) {
    var old_dirname = PATH.dirname(old_path);
    var new_dirname = PATH.dirname(new_path);
    var old_name = PATH.basename(old_path);
    var new_name = PATH.basename(new_path);
    // parents must exist
    var lookup, old_dir, new_dir;
    // let the errors from non existent directories percolate up
    lookup = FS.lookupPath(old_path, {
      parent: true
    });
    old_dir = lookup.node;
    lookup = FS.lookupPath(new_path, {
      parent: true
    });
    new_dir = lookup.node;
    if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
    // need to be part of the same mount
    if (old_dir.mount !== new_dir.mount) {
      throw new FS.ErrnoError(75);
    }
    // source must exist
    var old_node = FS.lookupNode(old_dir, old_name);
    // old path should not be an ancestor of the new path
    var relative = PATH_FS.relative(old_path, new_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(28);
    }
    // new path should not be an ancestor of the old path
    relative = PATH_FS.relative(new_path, old_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(55);
    }
    // see if the new path already exists
    var new_node;
    try {
      new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {}
    // early out if nothing needs to change
    if (old_node === new_node) {
      return;
    }
    // we'll need to delete the old entry
    var isdir = FS.isDir(old_node.mode);
    var errCode = FS.mayDelete(old_dir, old_name, isdir);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    // need delete permissions if we'll be overwriting.
    // need create permissions if new doesn't already exist.
    errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
      throw new FS.ErrnoError(10);
    }
    // if we are going to change the parent, check write permissions
    if (new_dir !== old_dir) {
      errCode = FS.nodePermissions(old_dir, "w");
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
    }
    // remove the node from the lookup hash
    FS.hashRemoveNode(old_node);
    // do the underlying fs rename
    try {
      old_dir.node_ops.rename(old_node, new_dir, new_name);
      // update old node (we do this here to avoid each backend
      // needing to)
      old_node.parent = new_dir;
    } catch (e) {
      throw e;
    } finally {
      // add the node back to the hash (in case node_ops.rename
      // changed its name)
      FS.hashAddNode(old_node);
    }
  },
  rmdir(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var errCode = FS.mayDelete(parent, name, true);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.rmdir) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10);
    }
    parent.node_ops.rmdir(parent, name);
    FS.destroyNode(node);
  },
  readdir(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    var readdir = FS.checkOpExists(node.node_ops.readdir, 54);
    return readdir(node);
  },
  unlink(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44);
    }
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var errCode = FS.mayDelete(parent, name, false);
    if (errCode) {
      // According to POSIX, we should map EISDIR to EPERM, but
      // we instead do what Linux does (and we must, as we use
      // the musl linux libc).
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.unlink) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10);
    }
    parent.node_ops.unlink(parent, name);
    FS.destroyNode(node);
  },
  readlink(path) {
    var lookup = FS.lookupPath(path);
    var link = lookup.node;
    if (!link) {
      throw new FS.ErrnoError(44);
    }
    if (!link.node_ops.readlink) {
      throw new FS.ErrnoError(28);
    }
    return link.node_ops.readlink(link);
  },
  stat(path, dontFollow) {
    var lookup = FS.lookupPath(path, {
      follow: !dontFollow
    });
    var node = lookup.node;
    var getattr = FS.checkOpExists(node.node_ops.getattr, 63);
    return getattr(node);
  },
  lstat(path) {
    return FS.stat(path, true);
  },
  chmod(path, mode, dontFollow) {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node;
    } else {
      node = path;
    }
    var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
    setattr(node, {
      mode: (mode & 4095) | (node.mode & ~4095),
      ctime: Date.now(),
      dontFollow
    });
  },
  lchmod(path, mode) {
    FS.chmod(path, mode, true);
  },
  fchmod(fd, mode) {
    var stream = FS.getStreamChecked(fd);
    FS.chmod(stream.node, mode);
  },
  chown(path, uid, gid, dontFollow) {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node;
    } else {
      node = path;
    }
    var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
    setattr(node, {
      timestamp: Date.now(),
      dontFollow
    });
  },
  lchown(path, uid, gid) {
    FS.chown(path, uid, gid, true);
  },
  fchown(fd, uid, gid) {
    var stream = FS.getStreamChecked(fd);
    FS.chown(stream.node, uid, gid);
  },
  truncate(path, len) {
    if (len < 0) {
      throw new FS.ErrnoError(28);
    }
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: true
      });
      node = lookup.node;
    } else {
      node = path;
    }
    if (FS.isDir(node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!FS.isFile(node.mode)) {
      throw new FS.ErrnoError(28);
    }
    var errCode = FS.nodePermissions(node, "w");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
    setattr(node, {
      size: len,
      timestamp: Date.now()
    });
  },
  ftruncate(fd, len) {
    var stream = FS.getStreamChecked(fd);
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(28);
    }
    FS.truncate(stream.node, len);
  },
  utime(path, atime, mtime) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
    setattr(node, {
      atime,
      mtime
    });
  },
  open(path, flags, mode = 438) {
    if (path === "") {
      throw new FS.ErrnoError(44);
    }
    flags = typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
    if ((flags & 64)) {
      mode = (mode & 4095) | 32768;
    } else {
      mode = 0;
    }
    var node;
    var isDirPath;
    if (typeof path == "object") {
      node = path;
    } else {
      isDirPath = path.endsWith("/");
      // noent_okay makes it so that if the final component of the path
      // doesn't exist, lookupPath returns `node: undefined`. `path` will be
      // updated to point to the target of all symlinks.
      var lookup = FS.lookupPath(path, {
        follow: !(flags & 131072),
        noent_okay: true
      });
      node = lookup.node;
      path = lookup.path;
    }
    // perhaps we need to create the node
    var created = false;
    if ((flags & 64)) {
      if (node) {
        // if O_CREAT and O_EXCL are set, error out if the node already exists
        if ((flags & 128)) {
          throw new FS.ErrnoError(20);
        }
      } else if (isDirPath) {
        throw new FS.ErrnoError(31);
      } else {
        // node doesn't exist, try to create it
        // Ignore the permission bits here to ensure we can `open` this new
        // file below. We use chmod below the apply the permissions once the
        // file is open.
        node = FS.mknod(path, mode | 511, 0);
        created = true;
      }
    }
    if (!node) {
      throw new FS.ErrnoError(44);
    }
    // can't truncate a device
    if (FS.isChrdev(node.mode)) {
      flags &= ~512;
    }
    // if asked only for a directory, then this must be one
    if ((flags & 65536) && !FS.isDir(node.mode)) {
      throw new FS.ErrnoError(54);
    }
    // check permissions, if this is not a file we just created now (it is ok to
    // create and write to a file with read-only permissions; it is read-only
    // for later use)
    if (!created) {
      var errCode = FS.mayOpen(node, flags);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
    }
    // do truncation if necessary
    if ((flags & 512) && !created) {
      FS.truncate(node, 0);
    }
    // we've already handled these, don't pass down to the underlying vfs
    flags &= ~(128 | 512 | 131072);
    // register the stream with the filesystem
    var stream = FS.createStream({
      node,
      path: FS.getPath(node),
      // we want the absolute path to the node
      flags,
      seekable: true,
      position: 0,
      stream_ops: node.stream_ops,
      // used by the file family libc calls (fopen, fwrite, ferror, etc.)
      ungotten: [],
      error: false
    });
    // call the new stream's open function
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream);
    }
    if (created) {
      FS.chmod(node, mode & 511);
    }
    if (Module["logReadFiles"] && !(flags & 1)) {
      if (!(path in FS.readFiles)) {
        FS.readFiles[path] = 1;
      }
    }
    return stream;
  },
  close(stream) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (stream.getdents) stream.getdents = null;
    // free readdir state
    try {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream);
      }
    } catch (e) {
      throw e;
    } finally {
      FS.closeStream(stream.fd);
    }
    stream.fd = null;
  },
  isClosed(stream) {
    return stream.fd === null;
  },
  llseek(stream, offset, whence) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (!stream.seekable || !stream.stream_ops.llseek) {
      throw new FS.ErrnoError(70);
    }
    if (whence != 0 && whence != 1 && whence != 2) {
      throw new FS.ErrnoError(28);
    }
    stream.position = stream.stream_ops.llseek(stream, offset, whence);
    stream.ungotten = [];
    return stream.position;
  },
  read(stream, buffer, offset, length, position) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(8);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!stream.stream_ops.read) {
      throw new FS.ErrnoError(28);
    }
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
    if (!seeking) stream.position += bytesRead;
    return bytesRead;
  },
  write(stream, buffer, offset, length, position, canOwn) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!stream.stream_ops.write) {
      throw new FS.ErrnoError(28);
    }
    if (stream.seekable && stream.flags & 1024) {
      // seek to the end before writing in append mode
      FS.llseek(stream, 0, 2);
    }
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
    if (!seeking) stream.position += bytesWritten;
    return bytesWritten;
  },
  allocate(stream, offset, length) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (offset < 0 || length <= 0) {
      throw new FS.ErrnoError(28);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8);
    }
    if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(43);
    }
    if (!stream.stream_ops.allocate) {
      throw new FS.ErrnoError(138);
    }
    stream.stream_ops.allocate(stream, offset, length);
  },
  mmap(stream, length, position, prot, flags) {
    // User requests writing to file (prot & PROT_WRITE != 0).
    // Checking if we have permissions to write to the file unless
    // MAP_PRIVATE flag is set. According to POSIX spec it is possible
    // to write to file opened in read-only mode with MAP_PRIVATE flag,
    // as all modifications will be visible only in the memory of
    // the current process.
    if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
      throw new FS.ErrnoError(2);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(2);
    }
    if (!stream.stream_ops.mmap) {
      throw new FS.ErrnoError(43);
    }
    if (!length) {
      throw new FS.ErrnoError(28);
    }
    return stream.stream_ops.mmap(stream, length, position, prot, flags);
  },
  msync(stream, buffer, offset, length, mmapFlags) {
    if (!stream.stream_ops.msync) {
      return 0;
    }
    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
  },
  ioctl(stream, cmd, arg) {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(59);
    }
    return stream.stream_ops.ioctl(stream, cmd, arg);
  },
  readFile(path, opts = {}) {
    opts.flags = opts.flags || 0;
    opts.encoding = opts.encoding || "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error(`Invalid encoding type "${opts.encoding}"`);
    }
    var ret;
    var stream = FS.open(path, opts.flags);
    var stat = FS.stat(path);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === "utf8") {
      ret = UTF8ArrayToString(buf);
    } else if (opts.encoding === "binary") {
      ret = buf;
    }
    FS.close(stream);
    return ret;
  },
  writeFile(path, data, opts = {}) {
    opts.flags = opts.flags || 577;
    var stream = FS.open(path, opts.flags, opts.mode);
    if (typeof data == "string") {
      var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
      var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
      FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
    } else if (ArrayBuffer.isView(data)) {
      FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
    } else {
      throw new Error("Unsupported data type");
    }
    FS.close(stream);
  },
  cwd: () => FS.currentPath,
  chdir(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    if (lookup.node === null) {
      throw new FS.ErrnoError(44);
    }
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(54);
    }
    var errCode = FS.nodePermissions(lookup.node, "x");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    FS.currentPath = lookup.path;
  },
  createDefaultDirectories() {
    FS.mkdir("/tmp");
    FS.mkdir("/home");
    FS.mkdir("/home/web_user");
  },
  createDefaultDevices() {
    // create /dev
    FS.mkdir("/dev");
    // setup /dev/null
    FS.registerDevice(FS.makedev(1, 3), {
      read: () => 0,
      write: (stream, buffer, offset, length, pos) => length,
      llseek: () => 0
    });
    FS.mkdev("/dev/null", FS.makedev(1, 3));
    // setup /dev/tty and /dev/tty1
    // stderr needs to print output using err() rather than out()
    // so we register a second tty just for it.
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev("/dev/tty", FS.makedev(5, 0));
    FS.mkdev("/dev/tty1", FS.makedev(6, 0));
    // setup /dev/[u]random
    // use a buffer to avoid overhead of individual crypto calls per byte
    var randomBuffer = new Uint8Array(1024), randomLeft = 0;
    var randomByte = () => {
      if (randomLeft === 0) {
        randomFill(randomBuffer);
        randomLeft = randomBuffer.byteLength;
      }
      return randomBuffer[--randomLeft];
    };
    FS.createDevice("/dev", "random", randomByte);
    FS.createDevice("/dev", "urandom", randomByte);
    // we're not going to emulate the actual shm device,
    // just create the tmp dirs that reside in it commonly
    FS.mkdir("/dev/shm");
    FS.mkdir("/dev/shm/tmp");
  },
  createSpecialDirectories() {
    // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
    // name of the stream for fd 6 (see test_unistd_ttyname)
    FS.mkdir("/proc");
    var proc_self = FS.mkdir("/proc/self");
    FS.mkdir("/proc/self/fd");
    FS.mount({
      mount() {
        var node = FS.createNode(proc_self, "fd", 16895, 73);
        node.stream_ops = {
          llseek: MEMFS.stream_ops.llseek
        };
        node.node_ops = {
          lookup(parent, name) {
            var fd = +name;
            var stream = FS.getStreamChecked(fd);
            var ret = {
              parent: null,
              mount: {
                mountpoint: "fake"
              },
              node_ops: {
                readlink: () => stream.path
              },
              id: fd + 1
            };
            ret.parent = ret;
            // make it look like a simple root node
            return ret;
          },
          readdir() {
            return Array.from(FS.streams.entries()).filter(([k, v]) => v).map(([k, v]) => k.toString());
          }
        };
        return node;
      }
    }, {}, "/proc/self/fd");
  },
  createStandardStreams(input, output, error) {
    // TODO deprecate the old functionality of a single
    // input / output callback and that utilizes FS.createDevice
    // and instead require a unique set of stream ops
    // by default, we symlink the standard streams to the
    // default tty devices. however, if the standard streams
    // have been overwritten we create a unique device for
    // them instead.
    if (input) {
      FS.createDevice("/dev", "stdin", input);
    } else {
      FS.symlink("/dev/tty", "/dev/stdin");
    }
    if (output) {
      FS.createDevice("/dev", "stdout", null, output);
    } else {
      FS.symlink("/dev/tty", "/dev/stdout");
    }
    if (error) {
      FS.createDevice("/dev", "stderr", null, error);
    } else {
      FS.symlink("/dev/tty1", "/dev/stderr");
    }
    // open default streams for the stdin, stdout and stderr devices
    var stdin = FS.open("/dev/stdin", 0);
    var stdout = FS.open("/dev/stdout", 1);
    var stderr = FS.open("/dev/stderr", 1);
  },
  staticInit() {
    FS.nameTable = new Array(4096);
    FS.mount(MEMFS, {}, "/");
    FS.createDefaultDirectories();
    FS.createDefaultDevices();
    FS.createSpecialDirectories();
    FS.filesystems = {
      "MEMFS": MEMFS
    };
  },
  init(input, output, error) {
    FS.initialized = true;
    // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
    input ??= Module["stdin"];
    output ??= Module["stdout"];
    error ??= Module["stderr"];
    FS.createStandardStreams(input, output, error);
  },
  quit() {
    FS.initialized = false;
    // force-flush all streams, so we get musl std streams printed out
    // close all of our streams
    for (var i = 0; i < FS.streams.length; i++) {
      var stream = FS.streams[i];
      if (!stream) {
        continue;
      }
      FS.close(stream);
    }
  },
  findObject(path, dontResolveLastLink) {
    var ret = FS.analyzePath(path, dontResolveLastLink);
    if (!ret.exists) {
      return null;
    }
    return ret.object;
  },
  analyzePath(path, dontResolveLastLink) {
    // operate from within the context of the symlink's target
    try {
      var lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      path = lookup.path;
    } catch (e) {}
    var ret = {
      isRoot: false,
      exists: false,
      error: 0,
      name: null,
      path: null,
      object: null,
      parentExists: false,
      parentPath: null,
      parentObject: null
    };
    try {
      var lookup = FS.lookupPath(path, {
        parent: true
      });
      ret.parentExists = true;
      ret.parentPath = lookup.path;
      ret.parentObject = lookup.node;
      ret.name = PATH.basename(path);
      lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      ret.exists = true;
      ret.path = lookup.path;
      ret.object = lookup.node;
      ret.name = lookup.node.name;
      ret.isRoot = lookup.path === "/";
    } catch (e) {
      ret.error = e.errno;
    }
    return ret;
  },
  createPath(parent, path, canRead, canWrite) {
    parent = typeof parent == "string" ? parent : FS.getPath(parent);
    var parts = path.split("/").reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part) continue;
      var current = PATH.join2(parent, part);
      try {
        FS.mkdir(current);
      } catch (e) {}
      parent = current;
    }
    return current;
  },
  createFile(parent, name, properties, canRead, canWrite) {
    var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
    var mode = FS_getMode(canRead, canWrite);
    return FS.create(path, mode);
  },
  createDataFile(parent, name, data, canRead, canWrite, canOwn) {
    var path = name;
    if (parent) {
      parent = typeof parent == "string" ? parent : FS.getPath(parent);
      path = name ? PATH.join2(parent, name) : parent;
    }
    var mode = FS_getMode(canRead, canWrite);
    var node = FS.create(path, mode);
    if (data) {
      if (typeof data == "string") {
        var arr = new Array(data.length);
        for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
        data = arr;
      }
      // make sure we can write to the file
      FS.chmod(node, mode | 146);
      var stream = FS.open(node, 577);
      FS.write(stream, data, 0, data.length, 0, canOwn);
      FS.close(stream);
      FS.chmod(node, mode);
    }
  },
  createDevice(parent, name, input, output) {
    var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
    var mode = FS_getMode(!!input, !!output);
    FS.createDevice.major ??= 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    // Create a fake device that a set of stream ops to emulate
    // the old behavior.
    FS.registerDevice(dev, {
      open(stream) {
        stream.seekable = false;
      },
      close(stream) {
        // flush any pending line data
        if (output?.buffer?.length) {
          output(10);
        }
      },
      read(stream, buffer, offset, length, pos) {
        var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = input();
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(6);
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result;
        }
        if (bytesRead) {
          stream.node.atime = Date.now();
        }
        return bytesRead;
      },
      write(stream, buffer, offset, length, pos) {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i]);
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        }
        if (length) {
          stream.node.mtime = stream.node.ctime = Date.now();
        }
        return i;
      }
    });
    return FS.mkdev(path, mode, dev);
  },
  forceLoadFile(obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    if (typeof XMLHttpRequest != "undefined") {
      throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
    } else {
      // Command-line.
      try {
        obj.contents = readBinary(obj.url);
        obj.usedBytes = obj.contents.length;
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
    }
  },
  createLazyFile(parent, name, url, canRead, canWrite) {
    // Lazy chunked Uint8Array (implements get and length from Uint8Array).
    // Actual getting is abstracted away for eventual reuse.
    class LazyUint8Array {
      lengthKnown=false;
      chunks=[];
      // Loaded chunks. Index is the chunk number
      get(idx) {
        if (idx > this.length - 1 || idx < 0) {
          return undefined;
        }
        var chunkOffset = idx % this.chunkSize;
        var chunkNum = (idx / this.chunkSize) | 0;
        return this.getter(chunkNum)[chunkOffset];
      }
      setDataGetter(getter) {
        this.getter = getter;
      }
      cacheLength() {
        // Find length
        var xhr = new XMLHttpRequest;
        xhr.open("HEAD", url, false);
        xhr.send(null);
        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
        var datalength = Number(xhr.getResponseHeader("Content-length"));
        var header;
        var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
        var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
        var chunkSize = 1024 * 1024;
        // Chunk size in bytes
        if (!hasByteServing) chunkSize = datalength;
        // Function to get a range from the remote URL.
        var doXHR = (from, to) => {
          if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
          if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
          // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, false);
          if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
          // Some hints to the browser that we want binary data.
          xhr.responseType = "arraybuffer";
          if (xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
          }
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          if (xhr.response !== undefined) {
            return new Uint8Array(/** @type{Array<number>} */ (xhr.response || []));
          }
          return intArrayFromString(xhr.responseText || "", true);
        };
        var lazyArray = this;
        lazyArray.setDataGetter(chunkNum => {
          var start = chunkNum * chunkSize;
          var end = (chunkNum + 1) * chunkSize - 1;
          // including this byte
          end = Math.min(end, datalength - 1);
          // if datalength-1 is selected, this is the last block
          if (typeof lazyArray.chunks[chunkNum] == "undefined") {
            lazyArray.chunks[chunkNum] = doXHR(start, end);
          }
          if (typeof lazyArray.chunks[chunkNum] == "undefined") throw new Error("doXHR failed!");
          return lazyArray.chunks[chunkNum];
        });
        if (usesGzip || !datalength) {
          // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
          chunkSize = datalength = 1;
          // this will force getter(0)/doXHR do download the whole file
          datalength = this.getter(0).length;
          chunkSize = datalength;
          out("LazyFiles on gzip forces download of the whole file when length is accessed");
        }
        this._length = datalength;
        this._chunkSize = chunkSize;
        this.lengthKnown = true;
      }
      get length() {
        if (!this.lengthKnown) {
          this.cacheLength();
        }
        return this._length;
      }
      get chunkSize() {
        if (!this.lengthKnown) {
          this.cacheLength();
        }
        return this._chunkSize;
      }
    }
    if (typeof XMLHttpRequest != "undefined") {
      if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
      var lazyArray = new LazyUint8Array;
      var properties = {
        isDevice: false,
        contents: lazyArray
      };
    } else {
      var properties = {
        isDevice: false,
        url
      };
    }
    var node = FS.createFile(parent, name, properties, canRead, canWrite);
    // This is a total hack, but I want to get this lazy file code out of the
    // core of MEMFS. If we want to keep this lazy file concept I feel it should
    // be its own thin LAZYFS proxying calls to MEMFS.
    if (properties.contents) {
      node.contents = properties.contents;
    } else if (properties.url) {
      node.contents = null;
      node.url = properties.url;
    }
    // Add a function that defers querying the file size until it is asked the first time.
    Object.defineProperties(node, {
      usedBytes: {
        get: function() {
          return this.contents.length;
        }
      }
    });
    // override each stream op with one that tries to force load the lazy file first
    var stream_ops = {};
    var keys = Object.keys(node.stream_ops);
    keys.forEach(key => {
      var fn = node.stream_ops[key];
      stream_ops[key] = (...args) => {
        FS.forceLoadFile(node);
        return fn(...args);
      };
    });
    function writeChunks(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= contents.length) return 0;
      var size = Math.min(contents.length - position, length);
      if (contents.slice) {
        // normal array
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents[position + i];
        }
      } else {
        for (var i = 0; i < size; i++) {
          // LazyUint8Array from sync binary XHR
          buffer[offset + i] = contents.get(position + i);
        }
      }
      return size;
    }
    // use a custom read function
    stream_ops.read = (stream, buffer, offset, length, position) => {
      FS.forceLoadFile(node);
      return writeChunks(stream, buffer, offset, length, position);
    };
    // use a custom mmap function
    stream_ops.mmap = (stream, length, position, prot, flags) => {
      FS.forceLoadFile(node);
      var ptr = mmapAlloc(length);
      if (!ptr) {
        throw new FS.ErrnoError(48);
      }
      writeChunks(stream, HEAP8, ptr, length, position);
      return {
        ptr,
        allocated: true
      };
    };
    node.stream_ops = stream_ops;
    return node;
  }
};

/**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index (i.e. maxBytesToRead will not
     *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
     *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
     *   JS JIT optimizations off, so it is worth to consider consistently using one
     * @return {string}
     */ var UTF8ToString = (ptr, maxBytesToRead) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";

var SYSCALLS = {
  DEFAULT_POLLMASK: 5,
  calculateAt(dirfd, path, allowEmpty) {
    if (PATH.isAbs(path)) {
      return path;
    }
    // relative path
    var dir;
    if (dirfd === -100) {
      dir = FS.cwd();
    } else {
      var dirstream = SYSCALLS.getStreamFromFD(dirfd);
      dir = dirstream.path;
    }
    if (path.length == 0) {
      if (!allowEmpty) {
        throw new FS.ErrnoError(44);
      }
      return dir;
    }
    return dir + "/" + path;
  },
  writeStat(buf, stat) {
    HEAP32[((buf) >> 2)] = stat.dev;
    HEAP32[(((buf) + (4)) >> 2)] = stat.mode;
    HEAPU32[(((buf) + (8)) >> 2)] = stat.nlink;
    HEAP32[(((buf) + (12)) >> 2)] = stat.uid;
    HEAP32[(((buf) + (16)) >> 2)] = stat.gid;
    HEAP32[(((buf) + (20)) >> 2)] = stat.rdev;
    HEAP64[(((buf) + (24)) >> 3)] = BigInt(stat.size);
    HEAP32[(((buf) + (32)) >> 2)] = 4096;
    HEAP32[(((buf) + (36)) >> 2)] = stat.blocks;
    var atime = stat.atime.getTime();
    var mtime = stat.mtime.getTime();
    var ctime = stat.ctime.getTime();
    HEAP64[(((buf) + (40)) >> 3)] = BigInt(Math.floor(atime / 1e3));
    HEAPU32[(((buf) + (48)) >> 2)] = (atime % 1e3) * 1e3 * 1e3;
    HEAP64[(((buf) + (56)) >> 3)] = BigInt(Math.floor(mtime / 1e3));
    HEAPU32[(((buf) + (64)) >> 2)] = (mtime % 1e3) * 1e3 * 1e3;
    HEAP64[(((buf) + (72)) >> 3)] = BigInt(Math.floor(ctime / 1e3));
    HEAPU32[(((buf) + (80)) >> 2)] = (ctime % 1e3) * 1e3 * 1e3;
    HEAP64[(((buf) + (88)) >> 3)] = BigInt(stat.ino);
    return 0;
  },
  writeStatFs(buf, stats) {
    HEAP32[(((buf) + (4)) >> 2)] = stats.bsize;
    HEAP32[(((buf) + (40)) >> 2)] = stats.bsize;
    HEAP32[(((buf) + (8)) >> 2)] = stats.blocks;
    HEAP32[(((buf) + (12)) >> 2)] = stats.bfree;
    HEAP32[(((buf) + (16)) >> 2)] = stats.bavail;
    HEAP32[(((buf) + (20)) >> 2)] = stats.files;
    HEAP32[(((buf) + (24)) >> 2)] = stats.ffree;
    HEAP32[(((buf) + (28)) >> 2)] = stats.fsid;
    HEAP32[(((buf) + (44)) >> 2)] = stats.flags;
    // ST_NOSUID
    HEAP32[(((buf) + (36)) >> 2)] = stats.namelen;
  },
  doMsync(addr, stream, len, flags, offset) {
    if (!FS.isFile(stream.node.mode)) {
      throw new FS.ErrnoError(43);
    }
    if (flags & 2) {
      // MAP_PRIVATE calls need not to be synced back to underlying fs
      return 0;
    }
    var buffer = HEAPU8.slice(addr, addr + len);
    FS.msync(stream, buffer, offset, len, flags);
  },
  getStreamFromFD(fd) {
    var stream = FS.getStreamChecked(fd);
    return stream;
  },
  varargs: undefined,
  getStr(ptr) {
    var ret = UTF8ToString(ptr);
    return ret;
  }
};

function ___syscall_fcntl64(fd, cmd, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    switch (cmd) {
     case 0:
      {
        var arg = syscallGetVarargI();
        if (arg < 0) {
          return -28;
        }
        while (FS.streams[arg]) {
          arg++;
        }
        var newStream;
        newStream = FS.dupStream(stream, arg);
        return newStream.fd;
      }

     case 1:
     case 2:
      return 0;

     // FD_CLOEXEC makes no sense for a single process.
      case 3:
      return stream.flags;

     case 4:
      {
        var arg = syscallGetVarargI();
        stream.flags |= arg;
        return 0;
      }

     case 12:
      {
        var arg = syscallGetVarargP();
        var offset = 0;
        // We're always unlocked.
        HEAP16[(((arg) + (offset)) >> 1)] = 2;
        return 0;
      }

     case 13:
     case 14:
      return 0;
    }
    return -28;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_ioctl(fd, op, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    switch (op) {
     case 21509:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     case 21505:
      {
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tcgets) {
          var termios = stream.tty.ops.ioctl_tcgets(stream);
          var argp = syscallGetVarargP();
          HEAP32[((argp) >> 2)] = termios.c_iflag || 0;
          HEAP32[(((argp) + (4)) >> 2)] = termios.c_oflag || 0;
          HEAP32[(((argp) + (8)) >> 2)] = termios.c_cflag || 0;
          HEAP32[(((argp) + (12)) >> 2)] = termios.c_lflag || 0;
          for (var i = 0; i < 32; i++) {
            HEAP8[(argp + i) + (17)] = termios.c_cc[i] || 0;
          }
          return 0;
        }
        return 0;
      }

     case 21510:
     case 21511:
     case 21512:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     case 21506:
     case 21507:
     case 21508:
      {
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tcsets) {
          var argp = syscallGetVarargP();
          var c_iflag = HEAP32[((argp) >> 2)];
          var c_oflag = HEAP32[(((argp) + (4)) >> 2)];
          var c_cflag = HEAP32[(((argp) + (8)) >> 2)];
          var c_lflag = HEAP32[(((argp) + (12)) >> 2)];
          var c_cc = [];
          for (var i = 0; i < 32; i++) {
            c_cc.push(HEAP8[(argp + i) + (17)]);
          }
          return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
            c_iflag,
            c_oflag,
            c_cflag,
            c_lflag,
            c_cc
          });
        }
        return 0;
      }

     case 21519:
      {
        if (!stream.tty) return -59;
        var argp = syscallGetVarargP();
        HEAP32[((argp) >> 2)] = 0;
        return 0;
      }

     case 21520:
      {
        if (!stream.tty) return -59;
        return -28;
      }

     case 21531:
      {
        var argp = syscallGetVarargP();
        return FS.ioctl(stream, op, argp);
      }

     case 21523:
      {
        // TODO: in theory we should write to the winsize struct that gets
        // passed in, but for now musl doesn't read anything on it
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tiocgwinsz) {
          var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
          var argp = syscallGetVarargP();
          HEAP16[((argp) >> 1)] = winsize[0];
          HEAP16[(((argp) + (2)) >> 1)] = winsize[1];
        }
        return 0;
      }

     case 21524:
      {
        // TODO: technically, this ioctl call should change the window size.
        // but, since emscripten doesn't have any concept of a terminal window
        // yet, we'll just silently throw it away as we do TIOCGWINSZ
        if (!stream.tty) return -59;
        return 0;
      }

     case 21515:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     default:
      return -28;
    }
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_openat(dirfd, path, flags, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    var mode = varargs ? syscallGetVarargI() : 0;
    return FS.open(path, flags, mode).fd;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

var __abort_js = () => abort("");

var __emscripten_fs_load_embedded_files = ptr => {
  do {
    var name_addr = HEAPU32[((ptr) >> 2)];
    ptr += 4;
    var len = HEAPU32[((ptr) >> 2)];
    ptr += 4;
    var content = HEAPU32[((ptr) >> 2)];
    ptr += 4;
    var name = UTF8ToString(name_addr);
    FS.createPath("/", PATH.dirname(name), true, true);
    // canOwn this data in the filesystem, it is a slice of wasm memory that will never change
    FS.createDataFile(name, null, HEAP8.subarray(content, content + len), true, true, true);
  } while (HEAPU32[((ptr) >> 2)]);
};

var isLeapYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

var MONTH_DAYS_LEAP_CUMULATIVE = [ 0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335 ];

var MONTH_DAYS_REGULAR_CUMULATIVE = [ 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 ];

var ydayFromDate = date => {
  var leap = isLeapYear(date.getFullYear());
  var monthDaysCumulative = (leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE);
  var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
  // -1 since it's days since Jan 1
  return yday;
};

var INT53_MAX = 9007199254740992;

var INT53_MIN = -9007199254740992;

var bigintToI53Checked = num => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);

function __localtime_js(time, tmPtr) {
  time = bigintToI53Checked(time);
  var date = new Date(time * 1e3);
  HEAP32[((tmPtr) >> 2)] = date.getSeconds();
  HEAP32[(((tmPtr) + (4)) >> 2)] = date.getMinutes();
  HEAP32[(((tmPtr) + (8)) >> 2)] = date.getHours();
  HEAP32[(((tmPtr) + (12)) >> 2)] = date.getDate();
  HEAP32[(((tmPtr) + (16)) >> 2)] = date.getMonth();
  HEAP32[(((tmPtr) + (20)) >> 2)] = date.getFullYear() - 1900;
  HEAP32[(((tmPtr) + (24)) >> 2)] = date.getDay();
  var yday = ydayFromDate(date) | 0;
  HEAP32[(((tmPtr) + (28)) >> 2)] = yday;
  HEAP32[(((tmPtr) + (36)) >> 2)] = -(date.getTimezoneOffset() * 60);
  // Attention: DST is in December in South, and some regions don't have DST at all.
  var start = new Date(date.getFullYear(), 0, 1);
  var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  var winterOffset = start.getTimezoneOffset();
  var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
  HEAP32[(((tmPtr) + (32)) >> 2)] = dst;
}

var __mktime_js = function(tmPtr) {
  var ret = (() => {
    var date = new Date(HEAP32[(((tmPtr) + (20)) >> 2)] + 1900, HEAP32[(((tmPtr) + (16)) >> 2)], HEAP32[(((tmPtr) + (12)) >> 2)], HEAP32[(((tmPtr) + (8)) >> 2)], HEAP32[(((tmPtr) + (4)) >> 2)], HEAP32[((tmPtr) >> 2)], 0);
    // There's an ambiguous hour when the time goes back; the tm_isdst field is
    // used to disambiguate it.  Date() basically guesses, so we fix it up if it
    // guessed wrong, or fill in tm_isdst with the guess if it's -1.
    var dst = HEAP32[(((tmPtr) + (32)) >> 2)];
    var guessedOffset = date.getTimezoneOffset();
    var start = new Date(date.getFullYear(), 0, 1);
    var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    var winterOffset = start.getTimezoneOffset();
    var dstOffset = Math.min(winterOffset, summerOffset);
    // DST is in December in South
    if (dst < 0) {
      // Attention: some regions don't have DST at all.
      HEAP32[(((tmPtr) + (32)) >> 2)] = Number(summerOffset != winterOffset && dstOffset == guessedOffset);
    } else if ((dst > 0) != (dstOffset == guessedOffset)) {
      var nonDstOffset = Math.max(winterOffset, summerOffset);
      var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
      // Don't try setMinutes(date.getMinutes() + ...) -- it's messed up.
      date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4);
    }
    HEAP32[(((tmPtr) + (24)) >> 2)] = date.getDay();
    var yday = ydayFromDate(date) | 0;
    HEAP32[(((tmPtr) + (28)) >> 2)] = yday;
    // To match expected behavior, update fields from date
    HEAP32[((tmPtr) >> 2)] = date.getSeconds();
    HEAP32[(((tmPtr) + (4)) >> 2)] = date.getMinutes();
    HEAP32[(((tmPtr) + (8)) >> 2)] = date.getHours();
    HEAP32[(((tmPtr) + (12)) >> 2)] = date.getDate();
    HEAP32[(((tmPtr) + (16)) >> 2)] = date.getMonth();
    HEAP32[(((tmPtr) + (20)) >> 2)] = date.getYear();
    var timeMs = date.getTime();
    if (isNaN(timeMs)) {
      return -1;
    }
    // Return time in microseconds
    return timeMs / 1e3;
  })();
  return BigInt(ret);
};

var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);

var __tzset_js = (timezone, daylight, std_name, dst_name) => {
  // TODO: Use (malleable) environment variables instead of system settings.
  var currentYear = (new Date).getFullYear();
  var winter = new Date(currentYear, 0, 1);
  var summer = new Date(currentYear, 6, 1);
  var winterOffset = winter.getTimezoneOffset();
  var summerOffset = summer.getTimezoneOffset();
  // Local standard timezone offset. Local standard time is not adjusted for
  // daylight savings.  This code uses the fact that getTimezoneOffset returns
  // a greater value during Standard Time versus Daylight Saving Time (DST).
  // Thus it determines the expected output during Standard Time, and it
  // compares whether the output of the given date the same (Standard) or less
  // (DST).
  var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
  // timezone is specified as seconds west of UTC ("The external variable
  // `timezone` shall be set to the difference, in seconds, between
  // Coordinated Universal Time (UTC) and local standard time."), the same
  // as returned by stdTimezoneOffset.
  // See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
  HEAPU32[((timezone) >> 2)] = stdTimezoneOffset * 60;
  HEAP32[((daylight) >> 2)] = Number(winterOffset != summerOffset);
  var extractZone = timezoneOffset => {
    // Why inverse sign?
    // Read here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
    var sign = timezoneOffset >= 0 ? "-" : "+";
    var absOffset = Math.abs(timezoneOffset);
    var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
    var minutes = String(absOffset % 60).padStart(2, "0");
    return `UTC${sign}${hours}${minutes}`;
  };
  var winterName = extractZone(winterOffset);
  var summerName = extractZone(summerOffset);
  if (summerOffset < winterOffset) {
    // Northern hemisphere
    stringToUTF8(winterName, std_name, 17);
    stringToUTF8(summerName, dst_name, 17);
  } else {
    stringToUTF8(winterName, dst_name, 17);
    stringToUTF8(summerName, std_name, 17);
  }
};

var _emscripten_date_now = () => Date.now();

var JSEvents = {
  memcpy(target, src, size) {
    HEAP8.set(HEAP8.subarray(src, src + size), target);
  },
  removeAllEventListeners() {
    while (JSEvents.eventHandlers.length) {
      JSEvents._removeHandler(JSEvents.eventHandlers.length - 1);
    }
    JSEvents.deferredCalls = [];
  },
  inEventHandler: 0,
  deferredCalls: [],
  deferCall(targetFunction, precedence, argsList) {
    function arraysHaveEqualContent(arrA, arrB) {
      if (arrA.length != arrB.length) return false;
      for (var i in arrA) {
        if (arrA[i] != arrB[i]) return false;
      }
      return true;
    }
    // Test if the given call was already queued, and if so, don't add it again.
    for (var call of JSEvents.deferredCalls) {
      if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
        return;
      }
    }
    JSEvents.deferredCalls.push({
      targetFunction,
      precedence,
      argsList
    });
    JSEvents.deferredCalls.sort((x, y) => x.precedence < y.precedence);
  },
  removeDeferredCalls(targetFunction) {
    JSEvents.deferredCalls = JSEvents.deferredCalls.filter(call => call.targetFunction != targetFunction);
  },
  canPerformEventHandlerRequests() {
    if (navigator.userActivation) {
      // Verify against transient activation status from UserActivation API
      // whether it is possible to perform a request here without needing to defer. See
      // https://developer.mozilla.org/en-US/docs/Web/Security/User_activation#transient_activation
      // and https://caniuse.com/mdn-api_useractivation
      // At the time of writing, Firefox does not support this API: https://bugzilla.mozilla.org/show_bug.cgi?id=1791079
      return navigator.userActivation.isActive;
    }
    return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls;
  },
  runDeferredCalls() {
    if (!JSEvents.canPerformEventHandlerRequests()) {
      return;
    }
    var deferredCalls = JSEvents.deferredCalls;
    JSEvents.deferredCalls = [];
    for (var call of deferredCalls) {
      call.targetFunction(...call.argsList);
    }
  },
  eventHandlers: [],
  removeAllHandlersOnTarget: (target, eventTypeString) => {
    for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
      if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
        JSEvents._removeHandler(i--);
      }
    }
  },
  _removeHandler(i) {
    var h = JSEvents.eventHandlers[i];
    h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
    JSEvents.eventHandlers.splice(i, 1);
  },
  registerOrRemoveHandler(eventHandler) {
    if (!eventHandler.target) {
      return -4;
    }
    if (eventHandler.callbackfunc) {
      eventHandler.eventListenerFunc = function(event) {
        // Increment nesting count for the event handler.
        ++JSEvents.inEventHandler;
        JSEvents.currentEventHandler = eventHandler;
        // Process any old deferred calls the user has placed.
        JSEvents.runDeferredCalls();
        // Process the actual event, calls back to user C code handler.
        eventHandler.handlerFunc(event);
        // Process any new deferred calls that were placed right now from this event handler.
        JSEvents.runDeferredCalls();
        // Out of event handler - restore nesting count.
        --JSEvents.inEventHandler;
      };
      eventHandler.target.addEventListener(eventHandler.eventTypeString, eventHandler.eventListenerFunc, eventHandler.useCapture);
      JSEvents.eventHandlers.push(eventHandler);
    } else {
      for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
        if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
          JSEvents._removeHandler(i--);
        }
      }
    }
    return 0;
  },
  getNodeNameForTarget(target) {
    if (!target) return "";
    if (target == window) return "#window";
    if (target == screen) return "#screen";
    return target?.nodeName || "";
  },
  fullscreenEnabled() {
    return document.fullscreenEnabled || document.webkitFullscreenEnabled;
  }
};

var GLctx;

var webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance = ctx => // Closure is expected to be allowed to minify the '.dibvbi' property, so not accessing it quoted.
!!(ctx.dibvbi = ctx.getExtension("WEBGL_draw_instanced_base_vertex_base_instance"));

var webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance = ctx => !!(ctx.mdibvbi = ctx.getExtension("WEBGL_multi_draw_instanced_base_vertex_base_instance"));

var webgl_enable_EXT_polygon_offset_clamp = ctx => !!(ctx.extPolygonOffsetClamp = ctx.getExtension("EXT_polygon_offset_clamp"));

var webgl_enable_EXT_clip_control = ctx => !!(ctx.extClipControl = ctx.getExtension("EXT_clip_control"));

var webgl_enable_WEBGL_polygon_mode = ctx => !!(ctx.webglPolygonMode = ctx.getExtension("WEBGL_polygon_mode"));

var webgl_enable_WEBGL_multi_draw = ctx => // Closure is expected to be allowed to minify the '.multiDrawWebgl' property, so not accessing it quoted.
!!(ctx.multiDrawWebgl = ctx.getExtension("WEBGL_multi_draw"));

var getEmscriptenSupportedExtensions = ctx => {
  // Restrict the list of advertised extensions to those that we actually
  // support.
  var supportedExtensions = [ // WebGL 2 extensions
  "EXT_color_buffer_float", "EXT_conservative_depth", "EXT_disjoint_timer_query_webgl2", "EXT_texture_norm16", "NV_shader_noperspective_interpolation", "WEBGL_clip_cull_distance", // WebGL 1 and WebGL 2 extensions
  "EXT_clip_control", "EXT_color_buffer_half_float", "EXT_depth_clamp", "EXT_float_blend", "EXT_polygon_offset_clamp", "EXT_texture_compression_bptc", "EXT_texture_compression_rgtc", "EXT_texture_filter_anisotropic", "KHR_parallel_shader_compile", "OES_texture_float_linear", "WEBGL_blend_func_extended", "WEBGL_compressed_texture_astc", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_etc1", "WEBGL_compressed_texture_s3tc", "WEBGL_compressed_texture_s3tc_srgb", "WEBGL_debug_renderer_info", "WEBGL_debug_shaders", "WEBGL_lose_context", "WEBGL_multi_draw", "WEBGL_polygon_mode" ];
  // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
  return (ctx.getSupportedExtensions() || []).filter(ext => supportedExtensions.includes(ext));
};

var GL = {
  counter: 1,
  buffers: [],
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  shaders: [],
  vaos: [],
  contexts: [],
  offscreenCanvases: {},
  queries: [],
  samplers: [],
  transformFeedbacks: [],
  syncs: [],
  stringCache: {},
  stringiCache: {},
  unpackAlignment: 4,
  unpackRowLength: 0,
  recordError: errorCode => {
    if (!GL.lastError) {
      GL.lastError = errorCode;
    }
  },
  getNewId: table => {
    var ret = GL.counter++;
    for (var i = table.length; i < ret; i++) {
      table[i] = null;
    }
    return ret;
  },
  genObject: (n, buffers, createFunction, objectTable) => {
    for (var i = 0; i < n; i++) {
      var buffer = GLctx[createFunction]();
      var id = buffer && GL.getNewId(objectTable);
      if (buffer) {
        buffer.name = id;
        objectTable[id] = buffer;
      } else {
        GL.recordError(1282);
      }
      HEAP32[(((buffers) + (i * 4)) >> 2)] = id;
    }
  },
  getSource: (shader, count, string, length) => {
    var source = "";
    for (var i = 0; i < count; ++i) {
      var len = length ? HEAPU32[(((length) + (i * 4)) >> 2)] : undefined;
      source += UTF8ToString(HEAPU32[(((string) + (i * 4)) >> 2)], len);
    }
    return source;
  },
  createContext: (/** @type {HTMLCanvasElement} */ canvas, webGLContextAttributes) => {
    // BUG: Workaround Safari WebGL issue: After successfully acquiring WebGL
    // context on a canvas, calling .getContext() will always return that
    // context independent of which 'webgl' or 'webgl2'
    // context version was passed. See:
    //   https://bugs.webkit.org/show_bug.cgi?id=222758
    // and:
    //   https://github.com/emscripten-core/emscripten/issues/13295.
    // TODO: Once the bug is fixed and shipped in Safari, adjust the Safari
    // version field in above check.
    if (!canvas.getContextSafariWebGL2Fixed) {
      canvas.getContextSafariWebGL2Fixed = canvas.getContext;
      /** @type {function(this:HTMLCanvasElement, string, (Object|null)=): (Object|null)} */ function fixedGetContext(ver, attrs) {
        var gl = canvas.getContextSafariWebGL2Fixed(ver, attrs);
        return ((ver == "webgl") == (gl instanceof WebGLRenderingContext)) ? gl : null;
      }
      canvas.getContext = fixedGetContext;
    }
    var ctx = canvas.getContext("webgl2", webGLContextAttributes);
    if (!ctx) return 0;
    var handle = GL.registerContext(ctx, webGLContextAttributes);
    return handle;
  },
  registerContext: (ctx, webGLContextAttributes) => {
    // without pthreads a context is just an integer ID
    var handle = GL.getNewId(GL.contexts);
    var context = {
      handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes.majorVersion,
      GLctx: ctx
    };
    // Store the created context object so that we can access the context
    // given a canvas without having to pass the parameters again.
    if (ctx.canvas) ctx.canvas.GLctxObject = context;
    GL.contexts[handle] = context;
    if (typeof webGLContextAttributes.enableExtensionsByDefault == "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
      GL.initExtensions(context);
    }
    return handle;
  },
  makeContextCurrent: contextHandle => {
    // Active Emscripten GL layer context object.
    GL.currentContext = GL.contexts[contextHandle];
    // Active WebGL context object.
    Module["ctx"] = GLctx = GL.currentContext?.GLctx;
    return !(contextHandle && !GLctx);
  },
  getContext: contextHandle => GL.contexts[contextHandle],
  deleteContext: contextHandle => {
    if (GL.currentContext === GL.contexts[contextHandle]) {
      GL.currentContext = null;
    }
    if (typeof JSEvents == "object") {
      // Release all JS event handlers on the DOM element that the GL context is
      // associated with since the context is now deleted.
      JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
    }
    // Make sure the canvas object no longer refers to the context object so
    // there are no GC surprises.
    if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) {
      GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
    }
    GL.contexts[contextHandle] = null;
  },
  initExtensions: context => {
    // If this function is called without a specific context object, init the
    // extensions of the currently active context.
    context ||= GL.currentContext;
    if (context.initExtensionsDone) return;
    context.initExtensionsDone = true;
    var GLctx = context.GLctx;
    // Detect the presence of a few extensions manually, ction GL interop
    // layer itself will need to know if they exist.
    // Extensions that are available in both WebGL 1 and WebGL 2
    webgl_enable_WEBGL_multi_draw(GLctx);
    webgl_enable_EXT_polygon_offset_clamp(GLctx);
    webgl_enable_EXT_clip_control(GLctx);
    webgl_enable_WEBGL_polygon_mode(GLctx);
    // Extensions that are available from WebGL >= 2 (no-op if called on a WebGL 1 context active)
    webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(GLctx);
    webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance(GLctx);
    // On WebGL 2, EXT_disjoint_timer_query is replaced with an alternative
    // that's based on core APIs, and exposes only the queryCounterEXT()
    // entrypoint.
    if (context.version >= 2) {
      GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query_webgl2");
    }
    // However, Firefox exposes the WebGL 1 version on WebGL 2 as well and
    // thus we look for the WebGL 1 version again if the WebGL 2 version
    // isn't present. https://bugzilla.mozilla.org/show_bug.cgi?id=1328882
    if (context.version < 2 || !GLctx.disjointTimerQueryExt) {
      GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
    }
    getEmscriptenSupportedExtensions(GLctx).forEach(ext => {
      // WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders
      // are not enabled by default.
      if (!ext.includes("lose_context") && !ext.includes("debug")) {
        // Call .getExtension() to enable that extension permanently.
        GLctx.getExtension(ext);
      }
    });
  }
};

var maybeCStringToJsString = cString => cString > 2 ? UTF8ToString(cString) : cString;

var findCanvasEventTarget = target => {
  target = maybeCStringToJsString(target);
  // When compiling with OffscreenCanvas support and looking up a canvas to target,
  // we first look up if the target Canvas has been transferred to OffscreenCanvas use.
  // These transfers are represented/tracked by GL.offscreenCanvases object, which contain
  // the OffscreenCanvas element for each regular Canvas element that has been transferred.
  // Note that each pthread/worker have their own set of GL.offscreenCanvases. That is,
  // when an OffscreenCanvas is transferred from a pthread/main thread to another pthread,
  // it will move in the GL.offscreenCanvases array between threads. Hence GL.offscreenCanvases
  // represents the set of OffscreenCanvases owned by the current calling thread.
  // First check out the list of OffscreenCanvases by CSS selector ID ('#myCanvasID')
  return GL.offscreenCanvases[target.substr(1)] || (target == "canvas" && Object.keys(GL.offscreenCanvases)[0]) || document.querySelector(target);
};

var _emscripten_get_canvas_element_size = (target, width, height) => {
  var canvas = findCanvasEventTarget(target);
  if (!canvas) return -4;
  HEAP32[((width) >> 2)] = canvas.width;
  HEAP32[((height) >> 2)] = canvas.height;
};

var _emscripten_get_now = () => performance.now();

var getHeapMax = () => // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
// full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
// for any code that deals with heap sizes, which would require special
// casing all heap size related code to treat 0 specially.
1073741824;

var growMemory = size => {
  var b = wasmMemory.buffer;
  var pages = ((size - b.byteLength + 65535) / 65536) | 0;
  try {
    // round size grow request up to wasm page size (fixed 64KB per spec)
    wasmMemory.grow(pages);
    // .grow() takes a delta compared to the previous size
    updateMemoryViews();
    return 1;
  } catch (e) {}
};

var _emscripten_resize_heap = requestedSize => {
  var oldSize = HEAPU8.length;
  // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
  requestedSize >>>= 0;
  // With multithreaded builds, races can happen (another thread might increase the size
  // in between), so return a failure, and let the caller retry.
  // Memory resize rules:
  // 1.  Always increase heap size to at least the requested size, rounded up
  //     to next page multiple.
  // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
  //     geometrically: increase the heap size according to
  //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
  //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
  // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
  //     linearly: increase the heap size by at least
  //     MEMORY_GROWTH_LINEAR_STEP bytes.
  // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
  //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
  // 4.  If we were unable to allocate as much memory, it may be due to
  //     over-eager decision to excessively reserve due to (3) above.
  //     Hence if an allocation fails, cut down on the amount of excess
  //     growth, in an attempt to succeed to perform a smaller allocation.
  // A limit is set for how much we can grow. We should not exceed that
  // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
  var maxHeapSize = getHeapMax();
  if (requestedSize > maxHeapSize) {
    return false;
  }
  // Loop through potential heap size increases. If we attempt a too eager
  // reservation that fails, cut down on the attempted size and reserve a
  // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
  for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
    var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
    // ensure geometric growth
    // but limit overreserving (default to capping at +96MB overgrowth at most)
    overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
    var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
    var replacement = growMemory(newSize);
    if (replacement) {
      return true;
    }
  }
  return false;
};

var _emscripten_set_canvas_element_size = (target, width, height) => {
  var canvas = findCanvasEventTarget(target);
  if (!canvas) return -4;
  canvas.width = width;
  canvas.height = height;
  return 0;
};

var registerPreMainLoop = f => {
  // Does nothing unless $MainLoop is included/used.
  typeof MainLoop != "undefined" && MainLoop.preMainLoop.push(f);
};

var _emscripten_supports_offscreencanvas = () => // TODO: Add a new build mode, e.g. OFFSCREENCANVAS_SUPPORT=2, which
// necessitates OffscreenCanvas support at build time, and "return 1;" here in that build mode.
typeof OffscreenCanvas != "undefined";

var webglPowerPreferences = [ "default", "low-power", "high-performance" ];

/** @type {Object} */ var specialHTMLTargets = [ 0, typeof document != "undefined" ? document : 0, typeof window != "undefined" ? window : 0 ];

/** @suppress {duplicate } */ var _emscripten_webgl_do_create_context = (target, attributes) => {
  var attr32 = ((attributes) >> 2);
  var powerPreference = HEAP32[attr32 + (8 >> 2)];
  var contextAttributes = {
    "alpha": !!HEAP8[attributes + 0],
    "depth": !!HEAP8[attributes + 1],
    "stencil": !!HEAP8[attributes + 2],
    "antialias": !!HEAP8[attributes + 3],
    "premultipliedAlpha": !!HEAP8[attributes + 4],
    "preserveDrawingBuffer": !!HEAP8[attributes + 5],
    "powerPreference": webglPowerPreferences[powerPreference],
    "failIfMajorPerformanceCaveat": !!HEAP8[attributes + 12],
    // The following are not predefined WebGL context attributes in the WebGL specification, so the property names can be minified by Closure.
    majorVersion: HEAP32[attr32 + (16 >> 2)],
    minorVersion: HEAP32[attr32 + (20 >> 2)],
    enableExtensionsByDefault: HEAP8[attributes + 24],
    explicitSwapControl: HEAP8[attributes + 25],
    proxyContextToMainThread: HEAP32[attr32 + (28 >> 2)],
    renderViaOffscreenBackBuffer: HEAP8[attributes + 32]
  };
  var canvas = findCanvasEventTarget(target);
  if (!canvas) {
    return 0;
  }
  if (canvas.offscreenCanvas) canvas = canvas.offscreenCanvas;
  if (contextAttributes.explicitSwapControl) {
    var supportsOffscreenCanvas = canvas.transferControlToOffscreen || (_emscripten_supports_offscreencanvas() && canvas instanceof OffscreenCanvas);
    if (!supportsOffscreenCanvas) {
      return 0;
    }
    if (canvas.transferControlToOffscreen) {
      if (!canvas.controlTransferredOffscreen) {
        GL.offscreenCanvases[canvas.id] = {
          canvas: canvas.transferControlToOffscreen(),
          canvasSharedPtr: _malloc(12),
          id: canvas.id
        };
        canvas.controlTransferredOffscreen = true;
      } else if (!GL.offscreenCanvases[canvas.id]) {
        return 0;
      }
      canvas = GL.offscreenCanvases[canvas.id].canvas;
    }
  }
  var contextHandle = GL.createContext(canvas, contextAttributes);
  return contextHandle;
};

var _emscripten_webgl_create_context = _emscripten_webgl_do_create_context;

var _emscripten_webgl_destroy_context = contextHandle => {
  if (GL.currentContext == contextHandle) GL.currentContext = 0;
  GL.deleteContext(contextHandle);
};

var _emscripten_webgl_make_context_current = contextHandle => {
  var success = GL.makeContextCurrent(contextHandle);
  return success ? 0 : -5;
};

var _emscripten_wget_data = (url, pbuffer, pnum, perror) => Asyncify.handleSleep(wakeUp => {
  /* no need for run dependency, this is async but will not do any prepare etc. step */ asyncLoad(UTF8ToString(url)).then(byteArray => {
    // can only allocate the buffer after the wakeUp, not during an asyncing
    var buffer = _malloc(byteArray.length);
    // must be freed by caller!
    HEAPU8.set(byteArray, buffer);
    HEAPU32[((pbuffer) >> 2)] = buffer;
    HEAP32[((pnum) >> 2)] = byteArray.length;
    HEAP32[((perror) >> 2)] = 0;
    wakeUp();
  }, () => {
    HEAP32[((perror) >> 2)] = 1;
    wakeUp();
  });
});

_emscripten_wget_data.isAsync = true;

var ENV = {};

var getExecutableName = () => thisProgram || "./this.program";

var getEnvStrings = () => {
  if (!getEnvStrings.strings) {
    // Default values.
    // Browser language detection #8751
    var lang = ((typeof navigator == "object" && navigator.languages && navigator.languages[0]) || "C").replace("-", "_") + ".UTF-8";
    var env = {
      "USER": "web_user",
      "LOGNAME": "web_user",
      "PATH": "/",
      "PWD": "/",
      "HOME": "/home/web_user",
      "LANG": lang,
      "_": getExecutableName()
    };
    // Apply the user-provided values, if any.
    for (var x in ENV) {
      // x is a key in ENV; if ENV[x] is undefined, that means it was
      // explicitly set to be so. We allow user code to do that to
      // force variables with default values to remain unset.
      if (ENV[x] === undefined) delete env[x]; else env[x] = ENV[x];
    }
    var strings = [];
    for (var x in env) {
      strings.push(`${x}=${env[x]}`);
    }
    getEnvStrings.strings = strings;
  }
  return getEnvStrings.strings;
};

var stringToAscii = (str, buffer) => {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[buffer++] = str.charCodeAt(i);
  }
  // Null-terminate the string
  HEAP8[buffer] = 0;
};

var _environ_get = (__environ, environ_buf) => {
  var bufSize = 0;
  getEnvStrings().forEach((string, i) => {
    var ptr = environ_buf + bufSize;
    HEAPU32[(((__environ) + (i * 4)) >> 2)] = ptr;
    stringToAscii(string, ptr);
    bufSize += string.length + 1;
  });
  return 0;
};

var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
  var strings = getEnvStrings();
  HEAPU32[((penviron_count) >> 2)] = strings.length;
  var bufSize = 0;
  strings.forEach(string => bufSize += string.length + 1);
  HEAPU32[((penviron_buf_size) >> 2)] = bufSize;
  return 0;
};

var runtimeKeepaliveCounter = 0;

var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

var _proc_exit = code => {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    Module["onExit"]?.(code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
};

/** @suppress {duplicate } */ /** @param {boolean|number=} implicit */ var exitJS = (status, implicit) => {
  EXITSTATUS = status;
  _proc_exit(status);
};

var _exit = exitJS;

function _fd_close(fd) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.close(stream);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

/** @param {number=} offset */ var doReadv = (stream, iov, iovcnt, offset) => {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[((iov) >> 2)];
    var len = HEAPU32[(((iov) + (4)) >> 2)];
    iov += 8;
    var curr = FS.read(stream, HEAP8, ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) break;
    // nothing more to read
    if (typeof offset != "undefined") {
      offset += curr;
    }
  }
  return ret;
};

function _fd_read(fd, iov, iovcnt, pnum) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doReadv(stream, iov, iovcnt);
    HEAPU32[((pnum) >> 2)] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

function _fd_seek(fd, offset, whence, newOffset) {
  offset = bigintToI53Checked(offset);
  try {
    if (isNaN(offset)) return 61;
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.llseek(stream, offset, whence);
    HEAP64[((newOffset) >> 3)] = BigInt(stream.position);
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
    // reset readdir state
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

/** @param {number=} offset */ var doWritev = (stream, iov, iovcnt, offset) => {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[((iov) >> 2)];
    var len = HEAPU32[(((iov) + (4)) >> 2)];
    iov += 8;
    var curr = FS.write(stream, HEAP8, ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) {
      // No more space to write.
      break;
    }
    if (typeof offset != "undefined") {
      offset += curr;
    }
  }
  return ret;
};

function _fd_write(fd, iov, iovcnt, pnum) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doWritev(stream, iov, iovcnt);
    HEAPU32[((pnum) >> 2)] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

var _glActiveTexture = x0 => GLctx.activeTexture(x0);

var _glAttachShader = (program, shader) => {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
};

var _glBindBuffer = (target, buffer) => {
  if (target == 35051) {
    // In WebGL 2 glReadPixels entry point, we need to use a different WebGL 2
    // API function call when a buffer is bound to
    // GL_PIXEL_PACK_BUFFER_BINDING point, so must keep track whether that
    // binding point is non-null to know what is the proper API function to
    // call.
    GLctx.currentPixelPackBufferBinding = buffer;
  } else if (target == 35052) {
    // In WebGL 2 gl(Compressed)Tex(Sub)Image[23]D entry points, we need to
    // use a different WebGL 2 API function call when a buffer is bound to
    // GL_PIXEL_UNPACK_BUFFER_BINDING point, so must keep track whether that
    // binding point is non-null to know what is the proper API function to
    // call.
    GLctx.currentPixelUnpackBufferBinding = buffer;
  }
  GLctx.bindBuffer(target, GL.buffers[buffer]);
};

var _glBindTexture = (target, texture) => {
  GLctx.bindTexture(target, GL.textures[texture]);
};

var _glBindVertexArray = vao => {
  GLctx.bindVertexArray(GL.vaos[vao]);
};

var _glBlendFunc = (x0, x1) => GLctx.blendFunc(x0, x1);

var _glBufferData = (target, size, data, usage) => {
  if (true) {
    // If size is zero, WebGL would interpret uploading the whole input
    // arraybuffer (starting from given offset), which would not make sense in
    // WebAssembly, so avoid uploading if size is zero. However we must still
    // call bufferData to establish a backing storage of zero bytes.
    if (data && size) {
      GLctx.bufferData(target, HEAPU8, usage, data, size);
    } else {
      GLctx.bufferData(target, size, usage);
    }
    return;
  }
};

var _glBufferSubData = (target, offset, size, data) => {
  if (true) {
    size && GLctx.bufferSubData(target, offset, HEAPU8, data, size);
    return;
  }
};

var _glClear = x0 => GLctx.clear(x0);

var _glClearColor = (x0, x1, x2, x3) => GLctx.clearColor(x0, x1, x2, x3);

var _glClearDepthf = x0 => GLctx.clearDepth(x0);

var _glClientWaitSync = (sync, flags, timeout) => {
  // WebGL2 vs GLES3 differences: in GLES3, the timeout parameter is a uint64, where 0xFFFFFFFFFFFFFFFFULL means GL_TIMEOUT_IGNORED.
  // In JS, there's no 64-bit value types, so instead timeout is taken to be signed, and GL_TIMEOUT_IGNORED is given value -1.
  // Inherently the value accepted in the timeout is lossy, and can't take in arbitrary u64 bit pattern (but most likely doesn't matter)
  // See https://www.khronos.org/registry/webgl/specs/latest/2.0/#5.15
  timeout = Number(timeout);
  return GLctx.clientWaitSync(GL.syncs[sync], flags, timeout);
};

var _glCompileShader = shader => {
  GLctx.compileShader(GL.shaders[shader]);
};

var _glCreateProgram = () => {
  var id = GL.getNewId(GL.programs);
  var program = GLctx.createProgram();
  // Store additional information needed for each shader program:
  program.name = id;
  // Lazy cache results of
  // glGetProgramiv(GL_ACTIVE_UNIFORM_MAX_LENGTH/GL_ACTIVE_ATTRIBUTE_MAX_LENGTH/GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH)
  program.maxUniformLength = program.maxAttributeLength = program.maxUniformBlockNameLength = 0;
  program.uniformIdCounter = 1;
  GL.programs[id] = program;
  return id;
};

var _glCreateShader = shaderType => {
  var id = GL.getNewId(GL.shaders);
  GL.shaders[id] = GLctx.createShader(shaderType);
  return id;
};

var _glDeleteBuffers = (n, buffers) => {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(((buffers) + (i * 4)) >> 2)];
    var buffer = GL.buffers[id];
    // From spec: "glDeleteBuffers silently ignores 0's and names that do not
    // correspond to existing buffer objects."
    if (!buffer) continue;
    GLctx.deleteBuffer(buffer);
    buffer.name = 0;
    GL.buffers[id] = null;
    if (id == GLctx.currentPixelPackBufferBinding) GLctx.currentPixelPackBufferBinding = 0;
    if (id == GLctx.currentPixelUnpackBufferBinding) GLctx.currentPixelUnpackBufferBinding = 0;
  }
};

var _glDeleteProgram = id => {
  if (!id) return;
  var program = GL.programs[id];
  if (!program) {
    // glDeleteProgram actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(1281);
    return;
  }
  GLctx.deleteProgram(program);
  program.name = 0;
  GL.programs[id] = null;
};

var _glDeleteShader = id => {
  if (!id) return;
  var shader = GL.shaders[id];
  if (!shader) {
    // glDeleteShader actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(1281);
    return;
  }
  GLctx.deleteShader(shader);
  GL.shaders[id] = null;
};

var _glDeleteSync = id => {
  if (!id) return;
  var sync = GL.syncs[id];
  if (!sync) {
    // glDeleteSync signals an error when deleting a nonexisting object, unlike some other GL delete functions.
    GL.recordError(1281);
    return;
  }
  GLctx.deleteSync(sync);
  sync.name = 0;
  GL.syncs[id] = null;
};

var _glDeleteTextures = (n, textures) => {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(((textures) + (i * 4)) >> 2)];
    var texture = GL.textures[id];
    // GL spec: "glDeleteTextures silently ignores 0s and names that do not
    // correspond to existing textures".
    if (!texture) continue;
    GLctx.deleteTexture(texture);
    texture.name = 0;
    GL.textures[id] = null;
  }
};

var _glDeleteVertexArrays = (n, vaos) => {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(((vaos) + (i * 4)) >> 2)];
    GLctx.deleteVertexArray(GL.vaos[id]);
    GL.vaos[id] = null;
  }
};

var _glDepthFunc = x0 => GLctx.depthFunc(x0);

var _glDepthMask = flag => {
  GLctx.depthMask(!!flag);
};

var _glDisable = x0 => GLctx.disable(x0);

var _glDrawArrays = (mode, first, count) => {
  GLctx.drawArrays(mode, first, count);
};

var _glDrawElements = (mode, count, type, indices) => {
  GLctx.drawElements(mode, count, type, indices);
};

var _glEnable = x0 => GLctx.enable(x0);

var _glEnableVertexAttribArray = index => {
  GLctx.enableVertexAttribArray(index);
};

var _glFenceSync = (condition, flags) => {
  var sync = GLctx.fenceSync(condition, flags);
  if (sync) {
    var id = GL.getNewId(GL.syncs);
    sync.name = id;
    GL.syncs[id] = sync;
    return id;
  }
  return 0;
};

var _glFlush = () => GLctx.flush();

var _glGenBuffers = (n, buffers) => {
  GL.genObject(n, buffers, "createBuffer", GL.buffers);
};

var _glGenTextures = (n, textures) => {
  GL.genObject(n, textures, "createTexture", GL.textures);
};

var _glGenVertexArrays = (n, arrays) => {
  GL.genObject(n, arrays, "createVertexArray", GL.vaos);
};

var _glGetProgramInfoLog = (program, maxLength, length, infoLog) => {
  var log = GLctx.getProgramInfoLog(GL.programs[program]);
  if (log === null) log = "(unknown error)";
  var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
  if (length) HEAP32[((length) >> 2)] = numBytesWrittenExclNull;
};

var _glGetProgramiv = (program, pname, p) => {
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  if (program >= GL.counter) {
    GL.recordError(1281);
    return;
  }
  program = GL.programs[program];
  if (pname == 35716) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getProgramInfoLog(program);
    if (log === null) log = "(unknown error)";
    HEAP32[((p) >> 2)] = log.length + 1;
  } else if (pname == 35719) {
    if (!program.maxUniformLength) {
      var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
      for (var i = 0; i < numActiveUniforms; ++i) {
        program.maxUniformLength = Math.max(program.maxUniformLength, GLctx.getActiveUniform(program, i).name.length + 1);
      }
    }
    HEAP32[((p) >> 2)] = program.maxUniformLength;
  } else if (pname == 35722) {
    if (!program.maxAttributeLength) {
      var numActiveAttributes = GLctx.getProgramParameter(program, 35721);
      for (var i = 0; i < numActiveAttributes; ++i) {
        program.maxAttributeLength = Math.max(program.maxAttributeLength, GLctx.getActiveAttrib(program, i).name.length + 1);
      }
    }
    HEAP32[((p) >> 2)] = program.maxAttributeLength;
  } else if (pname == 35381) {
    if (!program.maxUniformBlockNameLength) {
      var numActiveUniformBlocks = GLctx.getProgramParameter(program, 35382);
      for (var i = 0; i < numActiveUniformBlocks; ++i) {
        program.maxUniformBlockNameLength = Math.max(program.maxUniformBlockNameLength, GLctx.getActiveUniformBlockName(program, i).length + 1);
      }
    }
    HEAP32[((p) >> 2)] = program.maxUniformBlockNameLength;
  } else {
    HEAP32[((p) >> 2)] = GLctx.getProgramParameter(program, pname);
  }
};

var _glGetShaderInfoLog = (shader, maxLength, length, infoLog) => {
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = "(unknown error)";
  var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
  if (length) HEAP32[((length) >> 2)] = numBytesWrittenExclNull;
};

var _glGetShaderiv = (shader, pname, p) => {
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  if (pname == 35716) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null) log = "(unknown error)";
    // The GLES2 specification says that if the shader has an empty info log,
    // a value of 0 is returned. Otherwise the log has a null char appended.
    // (An empty string is falsey, so we can just check that instead of
    // looking at log.length.)
    var logLength = log ? log.length + 1 : 0;
    HEAP32[((p) >> 2)] = logLength;
  } else if (pname == 35720) {
    // GL_SHADER_SOURCE_LENGTH
    var source = GLctx.getShaderSource(GL.shaders[shader]);
    // source may be a null, or the empty string, both of which are falsey
    // values that we report a 0 length for.
    var sourceLength = source ? source.length + 1 : 0;
    HEAP32[((p) >> 2)] = sourceLength;
  } else {
    HEAP32[((p) >> 2)] = GLctx.getShaderParameter(GL.shaders[shader], pname);
  }
};

var stringToNewUTF8 = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8(str, ret, size);
  return ret;
};

var webglGetExtensions = () => {
  var exts = getEmscriptenSupportedExtensions(GLctx);
  exts = exts.concat(exts.map(e => "GL_" + e));
  return exts;
};

var _glGetString = name_ => {
  var ret = GL.stringCache[name_];
  if (!ret) {
    switch (name_) {
     case 7939:
      ret = stringToNewUTF8(webglGetExtensions().join(" "));
      break;

     case 7936:
     case 7937:
     case 37445:
     case 37446:
      var s = GLctx.getParameter(name_);
      if (!s) {
        GL.recordError(1280);
      }
      ret = s ? stringToNewUTF8(s) : 0;
      break;

     case 7938:
      var webGLVersion = GLctx.getParameter(7938);
      // return GLES version string corresponding to the version of the WebGL context
      var glVersion = `OpenGL ES 2.0 (${webGLVersion})`;
      if (true) glVersion = `OpenGL ES 3.0 (${webGLVersion})`;
      ret = stringToNewUTF8(glVersion);
      break;

     case 35724:
      var glslVersion = GLctx.getParameter(35724);
      // extract the version number 'N.M' from the string 'WebGL GLSL ES N.M ...'
      var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
      var ver_num = glslVersion.match(ver_re);
      if (ver_num !== null) {
        if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + "0";
        // ensure minor version has 2 digits
        glslVersion = `OpenGL ES GLSL ES ${ver_num[1]} (${glslVersion})`;
      }
      ret = stringToNewUTF8(glslVersion);
      break;

     default:
      GL.recordError(1280);
    }
    GL.stringCache[name_] = ret;
  }
  return ret;
};

/** @suppress {checkTypes} */ var jstoi_q = str => parseInt(str);

/** @noinline */ var webglGetLeftBracePos = name => name.slice(-1) == "]" && name.lastIndexOf("[");

var webglPrepareUniformLocationsBeforeFirstUse = program => {
  var uniformLocsById = program.uniformLocsById, // Maps GLuint -> WebGLUniformLocation
  uniformSizeAndIdsByName = program.uniformSizeAndIdsByName, // Maps name -> [uniform array length, GLuint]
  i, j;
  // On the first time invocation of glGetUniformLocation on this shader program:
  // initialize cache data structures and discover which uniforms are arrays.
  if (!uniformLocsById) {
    // maps GLint integer locations to WebGLUniformLocations
    program.uniformLocsById = uniformLocsById = {};
    // maps integer locations back to uniform name strings, so that we can lazily fetch uniform array locations
    program.uniformArrayNamesById = {};
    var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
    for (i = 0; i < numActiveUniforms; ++i) {
      var u = GLctx.getActiveUniform(program, i);
      var nm = u.name;
      var sz = u.size;
      var lb = webglGetLeftBracePos(nm);
      var arrayName = lb > 0 ? nm.slice(0, lb) : nm;
      // Assign a new location.
      var id = program.uniformIdCounter;
      program.uniformIdCounter += sz;
      // Eagerly get the location of the uniformArray[0] base element.
      // The remaining indices >0 will be left for lazy evaluation to
      // improve performance. Those may never be needed to fetch, if the
      // application fills arrays always in full starting from the first
      // element of the array.
      uniformSizeAndIdsByName[arrayName] = [ sz, id ];
      // Store placeholder integers in place that highlight that these
      // >0 index locations are array indices pending population.
      for (j = 0; j < sz; ++j) {
        uniformLocsById[id] = j;
        program.uniformArrayNamesById[id++] = arrayName;
      }
    }
  }
};

var _glGetUniformLocation = (program, name) => {
  name = UTF8ToString(name);
  if (program = GL.programs[program]) {
    webglPrepareUniformLocationsBeforeFirstUse(program);
    var uniformLocsById = program.uniformLocsById;
    // Maps GLuint -> WebGLUniformLocation
    var arrayIndex = 0;
    var uniformBaseName = name;
    // Invariant: when populating integer IDs for uniform locations, we must
    // maintain the precondition that arrays reside in contiguous addresses,
    // i.e. for a 'vec4 colors[10];', colors[4] must be at location
    // colors[0]+4.  However, user might call glGetUniformLocation(program,
    // "colors") for an array, so we cannot discover based on the user input
    // arguments whether the uniform we are dealing with is an array. The only
    // way to discover which uniforms are arrays is to enumerate over all the
    // active uniforms in the program.
    var leftBrace = webglGetLeftBracePos(name);
    // If user passed an array accessor "[index]", parse the array index off the accessor.
    if (leftBrace > 0) {
      arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0;
      // "index]", coerce parseInt(']') with >>>0 to treat "foo[]" as "foo[0]" and foo[-1] as unsigned out-of-bounds.
      uniformBaseName = name.slice(0, leftBrace);
    }
    // Have we cached the location of this uniform before?
    // A pair [array length, GLint of the uniform location]
    var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName];
    // If an uniform with this name exists, and if its index is within the
    // array limits (if it's even an array), query the WebGLlocation, or
    // return an existing cached location.
    if (sizeAndId && arrayIndex < sizeAndId[0]) {
      arrayIndex += sizeAndId[1];
      // Add the base location of the uniform to the array index offset.
      if ((uniformLocsById[arrayIndex] = uniformLocsById[arrayIndex] || GLctx.getUniformLocation(program, name))) {
        return arrayIndex;
      }
    }
  } else {
    // N.b. we are currently unable to distinguish between GL program IDs that
    // never existed vs GL program IDs that have been deleted, so report
    // GL_INVALID_VALUE in both cases.
    GL.recordError(1281);
  }
  return -1;
};

var _glLinkProgram = program => {
  program = GL.programs[program];
  GLctx.linkProgram(program);
  // Invalidate earlier computed uniform->ID mappings, those have now become stale
  program.uniformLocsById = 0;
  // Mark as null-like so that glGetUniformLocation() knows to populate this again.
  program.uniformSizeAndIdsByName = {};
};

var _glPixelStorei = (pname, param) => {
  if (pname == 3317) {
    GL.unpackAlignment = param;
  } else if (pname == 3314) {
    GL.unpackRowLength = param;
  }
  GLctx.pixelStorei(pname, param);
};

var computeUnpackAlignedImageSize = (width, height, sizePerPixel) => {
  function roundedToNextMultipleOf(x, y) {
    return (x + y - 1) & -y;
  }
  var plainRowSize = (GL.unpackRowLength || width) * sizePerPixel;
  var alignedRowSize = roundedToNextMultipleOf(plainRowSize, GL.unpackAlignment);
  return height * alignedRowSize;
};

var colorChannelsInGlTextureFormat = format => {
  // Micro-optimizations for size: map format to size by subtracting smallest
  // enum value (0x1902) from all values first.  Also omit the most common
  // size value (1) from the list, which is assumed by formats not on the
  // list.
  var colorChannels = {
    // 0x1902 /* GL_DEPTH_COMPONENT */ - 0x1902: 1,
    // 0x1906 /* GL_ALPHA */ - 0x1902: 1,
    5: 3,
    6: 4,
    // 0x1909 /* GL_LUMINANCE */ - 0x1902: 1,
    8: 2,
    29502: 3,
    29504: 4,
    // 0x1903 /* GL_RED */ - 0x1902: 1,
    26917: 2,
    26918: 2,
    // 0x8D94 /* GL_RED_INTEGER */ - 0x1902: 1,
    29846: 3,
    29847: 4
  };
  return colorChannels[format - 6402] || 1;
};

var heapObjectForWebGLType = type => {
  // Micro-optimization for size: Subtract lowest GL enum number (0x1400/* GL_BYTE */) from type to compare
  // smaller values for the heap, for shorter generated code size.
  // Also the type HEAPU16 is not tested for explicitly, but any unrecognized type will return out HEAPU16.
  // (since most types are HEAPU16)
  type -= 5120;
  if (type == 0) return HEAP8;
  if (type == 1) return HEAPU8;
  if (type == 2) return HEAP16;
  if (type == 4) return HEAP32;
  if (type == 6) return HEAPF32;
  if (type == 5 || type == 28922 || type == 28520 || type == 30779 || type == 30782) return HEAPU32;
  return HEAPU16;
};

var toTypedArrayIndex = (pointer, heap) => pointer >>> (31 - Math.clz32(heap.BYTES_PER_ELEMENT));

var emscriptenWebGLGetTexPixelData = (type, format, width, height, pixels, internalFormat) => {
  var heap = heapObjectForWebGLType(type);
  var sizePerPixel = colorChannelsInGlTextureFormat(format) * heap.BYTES_PER_ELEMENT;
  var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel);
  return heap.subarray(toTypedArrayIndex(pixels, heap), toTypedArrayIndex(pixels + bytes, heap));
};

var _glReadPixels = (x, y, width, height, format, type, pixels) => {
  if (true) {
    if (GLctx.currentPixelPackBufferBinding) {
      GLctx.readPixels(x, y, width, height, format, type, pixels);
      return;
    }
    var heap = heapObjectForWebGLType(type);
    var target = toTypedArrayIndex(pixels, heap);
    GLctx.readPixels(x, y, width, height, format, type, heap, target);
    return;
  }
};

var _glShaderSource = (shader, count, string, length) => {
  var source = GL.getSource(shader, count, string, length);
  GLctx.shaderSource(GL.shaders[shader], source);
};

var _glTexImage2D = (target, level, internalFormat, width, height, border, format, type, pixels) => {
  if (true) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels);
      return;
    }
    if (pixels) {
      var heap = heapObjectForWebGLType(type);
      var index = toTypedArrayIndex(pixels, heap);
      GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, heap, index);
      return;
    }
  }
  var pixelData = pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null;
  GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixelData);
};

var _glTexParameteri = (x0, x1, x2) => GLctx.texParameteri(x0, x1, x2);

var _glTexStorage3D = (x0, x1, x2, x3, x4, x5) => GLctx.texStorage3D(x0, x1, x2, x3, x4, x5);

var _glTexSubImage3D = (target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, pixels) => {
  if (GLctx.currentPixelUnpackBufferBinding) {
    GLctx.texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, pixels);
  } else if (pixels) {
    var heap = heapObjectForWebGLType(type);
    GLctx.texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, heap, toTypedArrayIndex(pixels, heap));
  } else {
    GLctx.texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, null);
  }
};

var webglGetUniformLocation = location => {
  var p = GLctx.currentProgram;
  if (p) {
    var webglLoc = p.uniformLocsById[location];
    // p.uniformLocsById[location] stores either an integer, or a
    // WebGLUniformLocation.
    // If an integer, we have not yet bound the location, so do it now. The
    // integer value specifies the array index we should bind to.
    if (typeof webglLoc == "number") {
      p.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(p, p.uniformArrayNamesById[location] + (webglLoc > 0 ? `[${webglLoc}]` : ""));
    }
    // Else an already cached WebGLUniformLocation, return it.
    return webglLoc;
  } else {
    GL.recordError(1282);
  }
};

var _glUniform1i = (location, v0) => {
  GLctx.uniform1i(webglGetUniformLocation(location), v0);
};

var _glUniform2f = (location, v0, v1) => {
  GLctx.uniform2f(webglGetUniformLocation(location), v0, v1);
};

var _glUseProgram = program => {
  program = GL.programs[program];
  GLctx.useProgram(program);
  // Record the currently active program so that we can access the uniform
  // mapping table of that program.
  GLctx.currentProgram = program;
};

var _glVertexAttribIPointer = (index, size, type, stride, ptr) => {
  GLctx.vertexAttribIPointer(index, size, type, stride, ptr);
};

var _glVertexAttribPointer = (index, size, type, normalized, stride, ptr) => {
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
};

var _glViewport = (x0, x1, x2, x3) => GLctx.viewport(x0, x1, x2, x3);

var handleException = e => {
  // Certain exception types we do not treat as errors since they are used for
  // internal control flow.
  // 1. ExitStatus, which is thrown by exit()
  // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
  //    that wish to return to JS event loop.
  if (e instanceof ExitStatus || e == "unwind") {
    return EXITSTATUS;
  }
  quit_(1, e);
};

var maybeExit = () => {
  if (!keepRuntimeAlive()) {
    try {
      _exit(EXITSTATUS);
    } catch (e) {
      handleException(e);
    }
  }
};

var Asyncify = {
  instrumentWasmImports(imports) {
    var importPattern = /^(invoke_.*|__asyncjs__.*)$/;
    for (let [x, original] of Object.entries(imports)) {
      if (typeof original == "function") {
        let isAsyncifyImport = original.isAsync || importPattern.test(x);
        // Wrap async imports with a suspending WebAssembly function.
        if (isAsyncifyImport) {
          imports[x] = original = new WebAssembly.Suspending(original);
        }
      }
    }
  },
  instrumentWasmExports(exports) {
    var exportPattern = /^(main|__main_argc_argv)$/;
    Asyncify.asyncExports = new Set;
    var ret = {};
    for (let [x, original] of Object.entries(exports)) {
      if (typeof original == "function") {
        // Wrap all exports with a promising WebAssembly function.
        let isAsyncifyExport = exportPattern.test(x);
        if (isAsyncifyExport) {
          Asyncify.asyncExports.add(original);
          original = Asyncify.makeAsyncFunction(original);
        }
        ret[x] = (...args) => original(...args);
      } else {
        ret[x] = original;
      }
    }
    return ret;
  },
  asyncExports: null,
  isAsyncExport(func) {
    return Asyncify.asyncExports?.has(func);
  },
  handleAsync: async startAsync => {
    try {
      return await startAsync();
    } finally {}
  },
  handleSleep(startAsync) {
    return Asyncify.handleAsync(() => new Promise(startAsync));
  },
  makeAsyncFunction(original) {
    return WebAssembly.promising(original);
  }
};

var FS_createPath = FS.createPath;

var FS_unlink = path => FS.unlink(path);

var FS_createLazyFile = FS.createLazyFile;

var FS_createDevice = FS.createDevice;

FS.createPreloadedFile = FS_createPreloadedFile;

FS.staticInit();

// Set module methods based on EXPORTED_RUNTIME_METHODS
Module["FS_createPath"] = FS.createPath;

Module["FS_createDataFile"] = FS.createDataFile;

Module["FS_createPreloadedFile"] = FS.createPreloadedFile;

Module["FS_unlink"] = FS.unlink;

Module["FS_createLazyFile"] = FS.createLazyFile;

Module["FS_createDevice"] = FS.createDevice;

// This error may happen quite a bit. To avoid overhead we reuse it (and
// suffer a lack of stack info).
MEMFS.doesNotExistError = new FS.ErrnoError(44);

/** @suppress {checkTypes} */ MEMFS.doesNotExistError.stack = "<generic error, no stack>";

registerPreMainLoop(() => {
  // If the current GL context is an OffscreenCanvas, but it was initialized
  // with implicit swap mode, perform the swap on behalf of the user.
  if (GL.currentContext && !GL.currentContextIsProxied && !GL.currentContext.attributes.explicitSwapControl && GL.currentContext.GLctx.commit) {
    GL.currentContext.GLctx.commit();
  }
});

var wasmImports = {
  /** @export */ __asyncjs__load_image_async,
  /** @export */ __asyncjs__port_browser_idle_yield,
  /** @export */ __asyncjs__port_browser_yield,
  /** @export */ __asyncjs__save_phase_async,
  /** @export */ __syscall_fcntl64: ___syscall_fcntl64,
  /** @export */ __syscall_ioctl: ___syscall_ioctl,
  /** @export */ __syscall_openat: ___syscall_openat,
  /** @export */ _abort_js: __abort_js,
  /** @export */ _emscripten_fs_load_embedded_files: __emscripten_fs_load_embedded_files,
  /** @export */ _localtime_js: __localtime_js,
  /** @export */ _mktime_js: __mktime_js,
  /** @export */ _tzset_js: __tzset_js,
  /** @export */ emscripten_date_now: _emscripten_date_now,
  /** @export */ emscripten_get_canvas_element_size: _emscripten_get_canvas_element_size,
  /** @export */ emscripten_get_now: _emscripten_get_now,
  /** @export */ emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */ emscripten_set_canvas_element_size: _emscripten_set_canvas_element_size,
  /** @export */ emscripten_webgl_create_context: _emscripten_webgl_create_context,
  /** @export */ emscripten_webgl_destroy_context: _emscripten_webgl_destroy_context,
  /** @export */ emscripten_webgl_make_context_current: _emscripten_webgl_make_context_current,
  /** @export */ emscripten_wget_data: _emscripten_wget_data,
  /** @export */ environ_get: _environ_get,
  /** @export */ environ_sizes_get: _environ_sizes_get,
  /** @export */ exit: _exit,
  /** @export */ fd_close: _fd_close,
  /** @export */ fd_read: _fd_read,
  /** @export */ fd_seek: _fd_seek,
  /** @export */ fd_write: _fd_write,
  /** @export */ glActiveTexture: _glActiveTexture,
  /** @export */ glAttachShader: _glAttachShader,
  /** @export */ glBindBuffer: _glBindBuffer,
  /** @export */ glBindTexture: _glBindTexture,
  /** @export */ glBindVertexArray: _glBindVertexArray,
  /** @export */ glBlendFunc: _glBlendFunc,
  /** @export */ glBufferData: _glBufferData,
  /** @export */ glBufferSubData: _glBufferSubData,
  /** @export */ glClear: _glClear,
  /** @export */ glClearColor: _glClearColor,
  /** @export */ glClearDepthf: _glClearDepthf,
  /** @export */ glClientWaitSync: _glClientWaitSync,
  /** @export */ glCompileShader: _glCompileShader,
  /** @export */ glCreateProgram: _glCreateProgram,
  /** @export */ glCreateShader: _glCreateShader,
  /** @export */ glDeleteBuffers: _glDeleteBuffers,
  /** @export */ glDeleteProgram: _glDeleteProgram,
  /** @export */ glDeleteShader: _glDeleteShader,
  /** @export */ glDeleteSync: _glDeleteSync,
  /** @export */ glDeleteTextures: _glDeleteTextures,
  /** @export */ glDeleteVertexArrays: _glDeleteVertexArrays,
  /** @export */ glDepthFunc: _glDepthFunc,
  /** @export */ glDepthMask: _glDepthMask,
  /** @export */ glDisable: _glDisable,
  /** @export */ glDrawArrays: _glDrawArrays,
  /** @export */ glDrawElements: _glDrawElements,
  /** @export */ glEnable: _glEnable,
  /** @export */ glEnableVertexAttribArray: _glEnableVertexAttribArray,
  /** @export */ glFenceSync: _glFenceSync,
  /** @export */ glFlush: _glFlush,
  /** @export */ glGenBuffers: _glGenBuffers,
  /** @export */ glGenTextures: _glGenTextures,
  /** @export */ glGenVertexArrays: _glGenVertexArrays,
  /** @export */ glGetProgramInfoLog: _glGetProgramInfoLog,
  /** @export */ glGetProgramiv: _glGetProgramiv,
  /** @export */ glGetShaderInfoLog: _glGetShaderInfoLog,
  /** @export */ glGetShaderiv: _glGetShaderiv,
  /** @export */ glGetString: _glGetString,
  /** @export */ glGetUniformLocation: _glGetUniformLocation,
  /** @export */ glLinkProgram: _glLinkProgram,
  /** @export */ glPixelStorei: _glPixelStorei,
  /** @export */ glReadPixels: _glReadPixels,
  /** @export */ glShaderSource: _glShaderSource,
  /** @export */ glTexImage2D: _glTexImage2D,
  /** @export */ glTexParameteri: _glTexParameteri,
  /** @export */ glTexStorage3D: _glTexStorage3D,
  /** @export */ glTexSubImage3D: _glTexSubImage3D,
  /** @export */ glUniform1i: _glUniform1i,
  /** @export */ glUniform2f: _glUniform2f,
  /** @export */ glUseProgram: _glUseProgram,
  /** @export */ glVertexAttribIPointer: _glVertexAttribIPointer,
  /** @export */ glVertexAttribPointer: _glVertexAttribPointer,
  /** @export */ glViewport: _glViewport,
  /** @export */ load_image_ready,
  /** @export */ port_audio_submit,
  /** @export */ port_disc_read_sync,
  /** @export */ port_gpu_begin,
  /** @export */ port_gpu_end,
  /** @export */ port_save_frame,
  /** @export */ port_save_snapshot,
  /** @export */ port_save_vram,
  /** @export */ port_yield_allowed,
  /** @export */ save_phase_queued,
  /** @export */ show_lcd
};

var wasmExports;

createWasm();

var ___wasm_call_ctors = () => (___wasm_call_ctors = wasmExports["__wasm_call_ctors"])();

var _port_set_rc_verify = Module["_port_set_rc_verify"] = a0 => (_port_set_rc_verify = Module["_port_set_rc_verify"] = wasmExports["port_set_rc_verify"])(a0);

var _free = a0 => (_free = wasmExports["free"])(a0);

var _port_button = Module["_port_button"] = (a0, a1) => (_port_button = Module["_port_button"] = wasmExports["port_button"])(a0, a1);

var _port_axes = Module["_port_axes"] = (a0, a1, a2, a3) => (_port_axes = Module["_port_axes"] = wasmExports["port_axes"])(a0, a1, a2, a3);

var _port_input = Module["_port_input"] = (a0, a1, a2, a3, a4) => (_port_input = Module["_port_input"] = wasmExports["port_input"])(a0, a1, a2, a3, a4);

var _main = Module["_main"] = (a0, a1) => (_main = Module["_main"] = wasmExports["main"])(a0, a1);

var _malloc = a0 => (_malloc = wasmExports["malloc"])(a0);

var _port_render_snapshot = Module["_port_render_snapshot"] = () => (_port_render_snapshot = Module["_port_render_snapshot"] = wasmExports["port_render_snapshot"])();

var _port_render_mode = Module["_port_render_mode"] = a0 => (_port_render_mode = Module["_port_render_mode"] = wasmExports["port_render_mode"])(a0);

var _port_render_capture = Module["_port_render_capture"] = () => (_port_render_capture = Module["_port_render_capture"] = wasmExports["port_render_capture"])();

var _port_vram_capture = Module["_port_vram_capture"] = () => (_port_vram_capture = Module["_port_vram_capture"] = wasmExports["port_vram_capture"])();

var _port_frame_count = Module["_port_frame_count"] = () => (_port_frame_count = Module["_port_frame_count"] = wasmExports["port_frame_count"])();

var _port_frame_capture = Module["_port_frame_capture"] = () => (_port_frame_capture = Module["_port_frame_capture"] = wasmExports["port_frame_capture"])();

var __emscripten_stack_restore = a0 => (__emscripten_stack_restore = wasmExports["_emscripten_stack_restore"])(a0);

var __emscripten_stack_alloc = a0 => (__emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"])(a0);

var _emscripten_stack_get_current = () => (_emscripten_stack_get_current = wasmExports["emscripten_stack_get_current"])();

var ___emscripten_embedded_file_data = Module["___emscripten_embedded_file_data"] = 1910716;

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===
Module["addRunDependency"] = addRunDependency;

Module["removeRunDependency"] = removeRunDependency;

Module["FS_createPreloadedFile"] = FS_createPreloadedFile;

Module["FS_unlink"] = FS_unlink;

Module["FS_createPath"] = FS_createPath;

Module["FS_createDevice"] = FS_createDevice;

Module["FS_createDataFile"] = FS_createDataFile;

Module["FS_createLazyFile"] = FS_createLazyFile;

async function callMain() {
  var entryFunction = _main;
  var argc = 0;
  var argv = 0;
  try {
    var ret = entryFunction(argc, argv);
    // The current spec of JSPI returns a promise only if the function suspends
    // and a plain value otherwise. This will likely change:
    // https://github.com/WebAssembly/js-promise-integration/issues/11
    ret = await ret;
    // if we're not running an evented main loop, it's time to exit
    exitJS(ret, /* implicit = */ true);
    return ret;
  } catch (e) {
    return handleException(e);
  }
}

function run() {
  if (runDependencies > 0) {
    dependenciesFulfilled = run;
    return;
  }
  preRun();
  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    dependenciesFulfilled = run;
    return;
  }
  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    Module["calledRun"] = true;
    if (ABORT) return;
    initRuntime();
    preMain();
    Module["onRuntimeInitialized"]?.();
    var noInitialRun = Module["noInitialRun"];
    if (!noInitialRun) callMain();
    postRun();
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(() => {
      setTimeout(() => Module["setStatus"](""), 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}

if (Module["preInit"]) {
  if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
  while (Module["preInit"].length > 0) {
    Module["preInit"].pop()();
  }
}

run();
