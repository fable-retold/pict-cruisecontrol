const libElectron = require('electron');
const libBrowserWindow = libElectron.BrowserWindow;

const libFS = require('fs');
const libFable = require('fable');

const __DEFAULT_CONFIGURATION = require(`./EasyCruiser-Electron-Config.json`);
const _PictScript = libFS.readFileSync(`${__dirname}/dist/js/pict.min.js`, 'utf8');
const _ApplicationScript = libFS.readFileSync(`${__dirname}/dist/js/injected_pict_application.js`, 'utf8');
const _InjectionScript = libFS.readFileSync(`${__dirname}/EasyCruiser-Electron-Browser-Injector.js`, 'utf8');

const _Fable = new libFable(__DEFAULT_CONFIGURATION);

_Fable.log.info(`Easy Cruiser starting up; fable is initialized...`);

const electronApp = libElectron.app;

electronApp.on('certificate-error',
	(pEvent, pWebContents, pUrl, pError, pCertificate, fCallback) =>
	{
		// TODO: This isn't great but lets us develop locally.
		if (pUrl.includes('localhost'))
		{
			pEvent.preventDefault()
			return fCallback(true)
		}
		else
		{
			return fCallback(false)
		}
	});

function createBrowserWindow()
{
	_Fable.log.info(`Creating a new Electron BrowserWindow...`);
	
	// TODO: Should we build a standard way/service for initializing these?
	if (!_Fable.hasOwnProperty('electronWindows'))
	{
		_Fable.electronWindows = {};
	}

	// Create a browser window
	// https://www.electronjs.org/docs/latest/api/browser-window#window-customization
	const tmpWindow = new libBrowserWindow(
		{
			width: 1000,
			height: 650,
			webPreferences: 
				{
					// TODO: Make this come from the config file

					// webSecurity needs to be false if you're running from a local environment with a self-signed cert.
					// When running against a real environment with a real cert, this can be changed to true.
					// TODO: Change CORS on the API to accept headers; change the pattern here to send a coded header
					webSecurity: false,
					allowRunningInsecureContent: false,

					// This is necessary to allow an injected app to write to external APIs and read from the DOM
					// However there may be a better pattern (if we can get injection to happen transparently still)
					contextIsolation: false,

					devTools: _Fable.settings.ElectronDevToolsEnabled
			/* The preload script below did not work well; leaving it here for research and reference in the future.
					// The libPath.join hokey pokey is because if you don't do it as such, this error happens for security:
					// Really wanted this to allow us to get files in directly with maps, but no dice.
					// [75183:1129/102907.652130:ERROR:web_contents_preferences.cc(243)] preload script must have absolute path.
					//preload: libPath.join(__dirname, `BrowserWindow-Preload-Script.js`)
			*/
				}
		});
	// Add the window reference to the map
	_Fable.electronWindows.windowObject = tmpWindow;

	// Load the remote URL into electron.
	tmpWindow.loadURL(_Fable.settings.Starting_Site_URL);

	// Pop open the chrome dev tools tab if the configuration says to
	if (_Fable.settings.LoadDevToolsOnInitialization)
	{
		_Fable.log.info(`...opening webkit development tools pane due to LoadDevToolsOnInitialization in configuration`);
		tmpWindow.webContents.openDevTools();
	}

	// The Electron Documentation refers to an event `did-finish-load` on the 
	// BrowserWindow class that does not appear in the list of events for
	// the class elsewhere in the documentation.  We may want to research 
	// whether it's an oversight in their documentation or whether the event
	// is going away or something.
	//
	// Turns out did-finish-load doesn't seem to fire.
	// Or it does, but in the webContents subobject!
	//
	// https://www.electronjs.org/docs/latest/api/browser-window#using-the-ready-to-show-event
	//
	tmpWindow.webContents.on('dom-ready',
		() =>
		{
			_Fable.log.info(`Webkit is ready to show the page beginning injection flow.`);

			let tmpAnticipate = new _Fable.newAnticipate();

			tmpAnticipate.anticipate(
				(fNext) =>
				{
					_Fable.log.info(`Injecting Pict...`);
					_Fable.electronWindows.windowObject.webContents.executeJavaScript(_PictScript).then(fNext);
				});

			tmpAnticipate.anticipate(
				(fNext) =>
				{
					_Fable.log.trace(`Injecting the Pict Application...`);
					_Fable.electronWindows.windowObject.webContents.executeJavaScript(_ApplicationScript).then(fNext);
				});

			tmpAnticipate.anticipate(
				(fNext) =>
				{
					_Fable.log.trace(`Injecting the application loader...`);
					_Fable.electronWindows.windowObject.webContents.executeJavaScript(_InjectionScript).then(fNext);
				});

			tmpAnticipate.wait(
				()=>
				{
					_Fable.log.trace(`...Pict code fully injected!`);
				});
		});

	_Fable.log.info(`...new Electron BrowserWindow has been initialized`);
}

// Initialize the electron application
_Fable.log.info(`Initializing Electron...`);
electronApp.whenReady().then(createBrowserWindow);

// When all windows are closed, properly quit the app
electronApp.on('window-all-closed',
	() =>
	{
		electronApp.quit();
	});

// Create a new window when the app is activated if none exist (e.g., clicking the Dock icon on macOS)
electronApp.on('activate', 
	() =>
	{
		if (libBrowserWindow.getAllWindows().length === 0)
		{
			createBrowserWindow();
		}
	});
