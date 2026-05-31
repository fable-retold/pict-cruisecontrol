# Quickstart

This guide walks through registering Cruise Control against a Pict application, running the built-in `Wait` step, and writing your own step and assertion. Every API used here comes from the module source.

## Prerequisites

- Node.js installed
- An existing [Pict](https://fable-retold.github.io/pict/) application instance (Cruise Control registers its services and views onto one)
- A browser context for the persistence and DOM-reading features &mdash; the state manager calls `window.localStorage`, and the built-in assertions read the DOM

## Install

```bash
npm install pict-cruisecontrol
```

The package depends on `pict-view`; your host application brings in `pict`.

## What You Get From `require`

The module's `main` entry is the navigation view, but the workflow engine is exported alongside it. The two most useful entry points are:

```javascript
const libCruiseControl = require('pict-cruisecontrol');

// libCruiseControl                       -> PictCruiseControl (the pict-view, default export)
// libCruiseControl.BrowserStateManagement -> FableCruiseControlBrowserStateManagement
// libCruiseControl.WorkflowStep           -> the WorkflowStep base class
// libCruiseControl.AssertCondition        -> the AssertCondition base class
```

The workflow engine service itself (`FableCruiseControl`) registers a service type named `CruiseControl` when its source file is loaded. The state-management service is exported as `BrowserStateManagement` and is registered by the engine under the service hash `CruiseControlStateManagement`.

> **Note:** the engine reads and writes the current workflow through `this.fable.services.CruiseControlStateManagement`. Register the state manager under exactly that service hash, or the engine will not find it.

## Step 1 &mdash; Register The Services

Cruise Control services extend `fable-serviceproviderbase`, so they register against a Fable/Pict instance the same way every Retold service does.

```javascript
const libCruiseControl = require('pict-cruisecontrol');

// _Pict is your existing Pict application instance.

// Register the state-management service under the hash the engine expects.
_Pict.addServiceTypeIfNotExists('CruiseControlStateManagement', libCruiseControl.BrowserStateManagement);
let _CruiseControlState = _Pict.instantiateServiceProvider('CruiseControlStateManagement', {});

// Instantiate the workflow engine (its service type 'CruiseControl' is
// registered when the module is required).
let _CruiseControl = _Pict.instantiateServiceProvider('CruiseControl', {});
```

When the engine is constructed it automatically:

- registers the `AssertCondition` and `WorkflowStep` service types (if not already present),
- adds the built-in `Wait` workflow step,
- adds the built-in `TitleContains` and `ElementExists` assertions.

## Step 2 &mdash; Start The Built-In Wait Workflow

The engine drives whatever workflow is currently stored in `_Pict.AppData.CurrentWorkflow`. `startWorkflow` resets and loads that stored workflow, initializes its state, and begins executing at the step hash you pass.

```javascript
_CruiseControl.startWorkflow('Wait',
	() =>
	{
		_Pict.log.info('Workflow finished.');
	});
```

The generic `Wait` step reads its duration from `AppData.CurrentWorkflowStep.WaitDuration` (in milliseconds) and defaults to `100` ms if none is set, logging a warning. It is the simplest possible step and is useful as a template for your own.

> **Note:** `startWorkflow` first calls `resetWorkflow()`, which clears any previously stored workflow. If no workflow is available after loading, the engine logs an error and returns without running. The shape of a stored workflow is documented in [Architecture](architecture.md).

## Step 3 &mdash; Write A Custom Workflow Step

A step is a subclass of the exported `WorkflowStep` base class. Override `onExecuteStep` (and optionally `onBeforeExecuteStep` / `onAfterExecuteStep`), set a human-readable `stepName`, and always end by calling the supplied callback.

```javascript
const libCruiseControl = require('pict-cruisecontrol');

class WorkflowStepClickLogin extends libCruiseControl.WorkflowStep
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this.stepName = 'Click The Login Button';
		this.stepHash = 'ClickLogin';
		// Run the next step 250ms after this one completes.
		this.nextStepDelay = 250;
		this.nextStepHash = 'Wait';
	}

	onExecuteStep(fCallback)
	{
		let tmpButton = this.pict.ContentAssignment.getElement('#LoginButton');
		if (tmpButton.length > 0)
		{
			this.log.trace('...clicking the login button.');
			// (perform the click via your application's preferred mechanism)
		}
		return fCallback();
	}
}
```

Register it with the engine's `addWorkflowStep`:

```javascript
_CruiseControl.addWorkflowStep('ClickLogin', WorkflowStepClickLogin);
```

`addWorkflowStep` instantiates the prototype as a `WorkflowStep` service and stores it on `_CruiseControl.workflowSteps` under the hash you give. If a step with that hash already exists, it is overwritten and a warning is logged.

### Step Lifecycle And Chaining

For each step the engine runs, in order: `onBeforeExecuteStep`, then `onExecuteStep`, then `onAfterExecuteStep`. If the step's `nextStepDelay` is greater than `0`, the engine waits that many milliseconds, then advances to `nextStepHash` (when one is set). A step with `nextStepHash` set to `false` (the default) ends the workflow. See [Architecture](architecture.md) for the full state diagram.

## Step 4 &mdash; Write A Custom Assertion

An assertion is a subclass of the exported `AssertCondition` base class. Override `assertCondition(pConditionDataObject)` to return a boolean.

```javascript
const libCruiseControl = require('pict-cruisecontrol');

class AssertConditionUserLoggedIn extends libCruiseControl.AssertCondition
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this.conditionName = 'Assert User Is Logged In';
		this.conditionHash = 'UserLoggedIn';
	}

	assertCondition(pConditionDataObject)
	{
		let tmpAvatar = this.pict.ContentAssignment.getElement(pConditionDataObject.ElementAddress);
		return (tmpAvatar.length > 0);
	}
}
```

Register it with `addAssertion`:

```javascript
_CruiseControl.addAssertion('UserLoggedIn', AssertConditionUserLoggedIn);
```

`addAssertion` instantiates the prototype as an `AssertCondition` service and stores it on `_CruiseControl.workflowAssertions` under the hash you give (overwriting and warning on a duplicate).

The two built-in assertions show the pattern:

- **`ElementExists`** reads `pConditionDataObject.ElementAddress` and returns whether `this.pict.ContentAssignment.getElement(...)` matched anything.
- **`TitleContains`** reads `pConditionDataObject.Text` and returns whether the page `<title>` contains that substring (it uses `window.jQuery`, so jQuery must be present on the page).

## Next Steps

- Read the [Architecture](architecture.md) page for the workflow-state shape, the persistence model, and the full list of class methods.
- Read the [Easy Cruiser Example](example-easy-cruiser.md) to see Cruise Control's host pattern &mdash; a Pict application injected into a remote page from an Electron shell.
