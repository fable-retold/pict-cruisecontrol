# Easy Cruiser Example

`example_applications/easy_cruiser/` is a small [Electron](https://www.electronjs.org/) application that demonstrates the host pattern Cruise Control is built for: **load a remote web page, then hot-inject a Pict application into it** so your code can read the DOM and drive the page from the inside. It is the "follow it around" harness &mdash; the metaphor in the source header is "hotload a page into another page and follow it around."

This page explains what each file does and how the injection flow works. It is a reference walkthrough of the shipped example.

## What The Example Is

A standalone Electron app, separate from Cruise Control's own package, that:

1. Opens an Electron `BrowserWindow` pointed at a remote URL.
2. Waits for that page's DOM to be ready.
3. Injects three scripts into the live page in sequence: the Pict library, a built Pict application bundle, and a small loader that boots the application.

Once the Pict application is running inside the remote page, it has full access to that page's DOM &mdash; which is exactly the context Cruise Control's views and assertions are designed to operate in.

## The Files

| File | Role |
|------|------|
| `EasyCruiser-Electron-Application.js` | The Electron main process. Creates the window, loads the remote URL, and runs the injection sequence. |
| `EasyCruiser-Electron-Browser-Injector.js` | The in-page loader. Runs inside the remote page; constructs the Pict instance and starts the injected application. |
| `EasyCruiser-Electron-Config.json` | Fable configuration: logging, dev-tools flags, the starting URL. |

## The Configuration &mdash; `EasyCruiser-Electron-Config.json`

A Fable configuration object. The keys the example reads:

| Key | Value in the example | Used for |
|-----|----------------------|----------|
| `Product` | `"EasyCruiser"` | Fable product name. |
| `LogStreams` | a `simpleflatfile` stream to `./EasyCruiser.log` | Fable logging configuration. |
| `ElectronDevToolsEnabled` | `true` | Whether the `BrowserWindow` is created with dev tools enabled. |
| `LoadDevToolsOnInitialization` | `true` | Whether to open the Chromium dev-tools pane on load. |
| `ConfigFile` | `"~/EasyCruiser.json"` | A referenced external config path (declared in the file). |
| `Starting_Site_URL` | `"https://250kb.club/"` | The remote page the window loads. |

The example targets `https://250kb.club/` &mdash; a small public site &mdash; as a harmless page to inject into.

## The Main Process &mdash; `EasyCruiser-Electron-Application.js`

This is the Electron entry point. Walking through it:

### Startup

It requires Electron and Fable, loads the config JSON, and reads three script files off disk into strings:

```javascript
const __DEFAULT_CONFIGURATION = require(`./EasyCruiser-Electron-Config.json`);
const _PictScript = libFS.readFileSync(`${__dirname}/dist/js/pict.min.js`, 'utf8');
const _ApplicationScript = libFS.readFileSync(`${__dirname}/dist/js/injected_pict_application.js`, 'utf8');
const _InjectionScript = libFS.readFileSync(`${__dirname}/EasyCruiser-Electron-Browser-Injector.js`, 'utf8');

const _Fable = new libFable(__DEFAULT_CONFIGURATION);
```

The three scripts are, in injection order: the Pict library bundle, the built Pict **application** bundle, and the in-page loader (the injector file documented below).

> **Build artifacts required:** the first two paths point into a `dist/js/` folder (`pict.min.js` and `injected_pict_application.js`). Those files are **not committed** to the repository &mdash; they are build outputs the example expects you to produce. As shipped, the example is illustrative of the pattern; running it requires building/placing those bundles first. The third script, the injector, is committed and read straight from the example directory.

### Certificate handling

A `certificate-error` handler allows self-signed certificates for `localhost` only (so you can point the example at a local dev server with a self-signed cert) and rejects them elsewhere. The source comment flags this as a develop-locally convenience.

### Creating the window

`createBrowserWindow()` constructs a `1000x650` `BrowserWindow`. The notable `webPreferences`:

| Preference | Value | Why (per source comments) |
|------------|-------|---------------------------|
| `webSecurity` | `false` | Needed when running against a local environment with a self-signed cert. |
| `allowRunningInsecureContent` | `false` | Left off. |
| `contextIsolation` | `false` | Required so an injected app can write to external APIs and read from the DOM. |
| `devTools` | `_Fable.settings.ElectronDevToolsEnabled` | Driven by config. |

It then loads the remote URL and, if `LoadDevToolsOnInitialization` is set, opens the dev-tools pane:

```javascript
tmpWindow.loadURL(_Fable.settings.Starting_Site_URL);
```

> **Note:** `contextIsolation: false` and `webSecurity: false` lower Electron's security boundaries deliberately, so the injected Pict code can reach across into the remote page's DOM and to external APIs. This is appropriate for a controlled automation/development harness, not for a general-purpose browser.

### The injection sequence

The interesting part. The example does **not** use an Electron preload script (the source notes a preload approach "did not work well" and keeps the reference commented out). Instead it waits for the `dom-ready` event on `webContents` and then injects the three scripts in order, using Fable's `Anticipate` to chain the asynchronous `executeJavaScript` calls:

```javascript
tmpWindow.webContents.on('dom-ready',
	() =>
	{
		let tmpAnticipate = new _Fable.newAnticipate();

		tmpAnticipate.anticipate(
			(fNext) =>
			{
				_Fable.electronWindows.windowObject.webContents.executeJavaScript(_PictScript).then(fNext);
			});

		tmpAnticipate.anticipate(
			(fNext) =>
			{
				_Fable.electronWindows.windowObject.webContents.executeJavaScript(_ApplicationScript).then(fNext);
			});

		tmpAnticipate.anticipate(
			(fNext) =>
			{
				_Fable.electronWindows.windowObject.webContents.executeJavaScript(_InjectionScript).then(fNext);
			});

		tmpAnticipate.wait(
			() =>
			{
				_Fable.log.trace(`...Pict code fully injected!`);
			});
	});
```

The source documents a subtlety: Electron's `did-finish-load` did not fire reliably on the `BrowserWindow`, so the example listens on `webContents` for `dom-ready` instead.

### App lifecycle

Standard Electron wiring: create the window when the app is ready, quit when all windows close, and re-create a window on `activate` (the macOS Dock-icon case).

> On macOS, the `activate` handler re-creates the window via `createBrowserWindow()` when all windows have been closed (e.g. clicking the Dock icon).

## The In-Page Loader &mdash; `EasyCruiser-Electron-Browser-Injector.js`

This is the third script injected, and it runs **inside the remote page**. Its job is to boot a Pict application once the page's document is ready.

It defines a small `onDocumentReady(fApplicationInitialize)` helper (lifted from Pict's own code, with fallbacks for older browsers), then `initializeInjectedApplication()`:

```javascript
function initializeInjectedApplication()
{
	// Create the style tag in the head for pict styles
	let tmpStyles = document.createElement("style");
	tmpStyles.id = "PICT-CSS";
	document.head.appendChild(tmpStyles);

	// Construct the pict instance and set it on the window object explicitly
	let tmpPict = new Pict(window.InjectedApplication.pict_configuration);
	window._Pict = tmpPict;
	tmpPict.log.info('Pict initialized.  Loading the application.');
	tmpPict.addApplication('EasyCruiser', window.InjectedApplication.default_configuration, window.InjectedApplication);
	tmpPict.InjectedApplication.initializeAsync(
		function (pError)
		{
			if (pError)
			{
				_Pict.log.error('Error initializing injected application: '+pError)
			}
			else
			{
				_Pict.log.info('Injected web application and associated views initialized.');
			}
		});

	return true;
}

onDocumentReady(initializeInjectedApplication);
```

Key points:

- It adds a `<style id="PICT-CSS">` element to the page head for Pict's CSS cascade.
- It constructs a `Pict` instance from `window.InjectedApplication.pict_configuration` and assigns it to `window._Pict`.
- It expects a global **`window.InjectedApplication`** to already exist &mdash; that global comes from the *second* injected script (the built application bundle, `injected_pict_application.js`), which is why injection order matters: Pict library first, application bundle second (defining `window.InjectedApplication`), loader third.
- It registers and initializes the application under the name `EasyCruiser` via `addApplication(...)` and `initializeAsync(...)`.

## How It Relates To Cruise Control

The example is the *delivery vehicle*, not a Cruise Control workflow itself. It shows how to get a Pict application &mdash; the kind that would register Cruise Control's services and views &mdash; running inside an arbitrary web page. Once that application is live in the page:

- Cruise Control's assertions can read the page (`ElementExists` via `pict.ContentAssignment`, `TitleContains` via the page title).
- Cruise Control's `LocationDetection` / `NavigationPilot` views (the [stubs](architecture.md) a host app overrides) can detect where they are and drive navigation.
- The workflow engine can persist progress to the page's `localStorage` and resume after the remote page navigates.

To go from this harness to a real automation, the injected application (`window.InjectedApplication`) would register the Cruise Control engine and state manager as shown in the [Quickstart](quickstart.md), define site-specific steps and assertions, and override the navigation/detection views for the target site.

## Running It

As shipped, the example is a code reference rather than a turnkey app: it reads `dist/js/pict.min.js` and `dist/js/injected_pict_application.js`, which are not committed. To actually run it you would need to provide those bundles (a Pict build and a built Pict application that defines `window.InjectedApplication`), install Electron, and launch the main process file with Electron. The mechanics above &mdash; the `dom-ready` injection sequence, the `webPreferences`, and the in-page loader &mdash; are the parts worth studying.
