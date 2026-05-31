# pict-cruisecontrol

> **[&#9654; Read the Pict-Cruisecontrol Documentation](https://fable-retold.github.io/pict-cruisecontrol/)** &mdash; interactive docs with the full API reference.

Automated and user-assisted web-page navigation and data marshaling for browser automation, built on the [Pict](https://fable-retold.github.io/pict/) MVC framework.

Pict-Cruisecontrol drives a web page the way a script (or a guided user) would: it advances through an ordered list of **workflow steps**, checks **assertions** about the current page along the way, and persists its progress so a workflow can survive a full page navigation. Because it is composed of ordinary Pict views and Fable services, it runs anywhere Pict runs &mdash; including injected into a third-party page inside an Electron shell (see the `easy_cruiser` example).

## What It Provides

- **A workflow engine** (`FableCruiseControl`) &mdash; runs an ordered chain of steps, each with optional pre/post hooks and an inter-step delay, advancing automatically from one step to the next.
- **Persistent workflow state** (`FableCruiseControlBrowserStateManagement`) &mdash; stores the current workflow in browser `localStorage` so it can be resumed after the page reloads or navigates.
- **Extensible workflow steps** (`WorkflowStep`) &mdash; subclass to define what a step does; a generic `Wait` step ships built in.
- **Extensible assertions** (`AssertCondition`) &mdash; subclass to check a page condition; `TitleContains` and `ElementExists` ship built in.
- **Navigation and location views** (`PictCruiseControl`) &mdash; a Pict view that hosts two child views, `LocationDetection` and `NavigationPilot`, as the seams where an application supplies its own page-detection and navigation logic.

## Status

This is an early-stage (1.0.x) module. The workflow engine, state management, the `Wait` step, and the two built-in assertions are implemented. The `LocationDetection` and `NavigationPilot` view methods are defined as extension points but ship as stubs &mdash; a consuming application is expected to subclass or override them with site-specific logic. See the [Architecture](https://fable-retold.github.io/pict-cruisecontrol/#/architecture.md) doc for exactly what is and is not implemented.

## Installation

```bash
npm install pict-cruisecontrol
```

`pict-cruisecontrol` depends on `pict-view`; a host application also brings in `pict`.

## Quick Look

Register the workflow engine and its state-management service against a Pict instance, then start a workflow:

```javascript
const libCruiseControl = require('pict-cruisecontrol');

// libPict is an existing Pict application instance.
libPict.addServiceTypeIfNotExists('CruiseControlStateManagement', libCruiseControl.BrowserStateManagement);
let _CruiseControlState = libPict.instantiateServiceProvider('CruiseControlStateManagement', {});

let _CruiseControl = libPict.instantiateServiceProvider('CruiseControl', {});

// Start the stored workflow at the 'Wait' step.
_CruiseControl.startWorkflow('Wait',
	() =>
	{
		libPict.log.info('Workflow complete.');
	});
```

See the [Quickstart](https://fable-retold.github.io/pict-cruisecontrol/#/quickstart.md) for the full setup, custom steps, and custom assertions.

## Documentation

The full documentation site &mdash; quickstart, architecture, and an explanation of the `easy_cruiser` Electron example &mdash; is published at:

**https://fable-retold.github.io/pict-cruisecontrol/**

## Related Packages

- [pict](https://github.com/fable-retold/pict) - MVC application framework
- [pict-view](https://github.com/fable-retold/pict-view) - View base class
- [fable](https://github.com/fable-retold/fable) - Application services framework

## License

MIT

## Contributing

Pull requests are welcome. For details on our code of conduct, contribution process, and testing requirements, see the [Retold Contributing Guide](https://github.com/stevenvelozo/retold/blob/main/docs/contributing.md).
