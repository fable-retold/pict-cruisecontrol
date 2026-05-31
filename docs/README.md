# Pict-Cruisecontrol

> Automated and user-assisted web-page navigation and data marshaling.

Pict-Cruisecontrol drives a web page through an ordered sequence of steps and verifies conditions about the page as it goes. It is built entirely from [Pict](https://fable-retold.github.io/pict/) views and [Fable](https://fable-retold.github.io/fable/) services, so it runs anywhere Pict runs &mdash; in a normal browser app, or injected into a third-party page inside an Electron shell.

The name is the metaphor: you set a workflow in motion and it cruises through the steps on its own, while still leaving room for a user (or a host application) to supply the parts that are specific to a given site.

## The Big Picture

Cruise Control is made of five cooperating pieces:

| Piece | Class | Role |
|-------|-------|------|
| Workflow engine | `FableCruiseControl` | Runs an ordered chain of steps, advancing automatically from one to the next. |
| State management | `FableCruiseControlBrowserStateManagement` | Persists the current workflow to browser `localStorage` so it survives reloads. |
| Workflow step | `WorkflowStep` | Base class for a single step; subclass it to define behavior. A `Wait` step ships built in. |
| Assertion | `AssertCondition` | Base class for a page-condition check; subclass it. `TitleContains` and `ElementExists` ship built in. |
| Navigation views | `PictCruiseControl` (+ `LocationDetection`, `NavigationPilot`) | The Pict view layer where a host app supplies site-specific detection and navigation. |

A workflow is just an ordered set of step hashes plus the state that tracks where you are. Each step can run **before**, **during**, and **after** hooks, optionally wait a configured number of milliseconds, and then hand off to the next step. State is written to `localStorage` after every transition, which is what lets a workflow continue across a real page navigation.

## What Is Implemented Today

This is an early-stage (1.0.x) module. Be precise about what works:

- **Implemented:** the workflow engine and its step lifecycle, browser state persistence, the generic `Wait` step, and the `TitleContains` / `ElementExists` assertions.
- **Extension points (ship as stubs):** the `LocationDetection` methods (`isAtSite`, `isAtLocation`, `inferLocation`) and the `NavigationPilot` methods (`navigateTo`, `performAction`). These define the intended seams for site-specific logic but currently return `false` / do nothing. A consuming application is expected to subclass or override them.

The [Architecture](architecture.md) page documents every class and marks each stub explicitly.

## Documentation

- **[Quickstart](quickstart.md)** &mdash; register the services, run the built-in `Wait` step, and write your own step and assertion.
- **[Architecture](architecture.md)** &mdash; every class, the step lifecycle, the workflow-state shape, and the persistence model.
- **[Easy Cruiser Example](example-easy-cruiser.md)** &mdash; a walkthrough of the Electron example that hot-injects a Pict application into a remote page.

## Related Modules

- [Pict](https://fable-retold.github.io/pict/) &mdash; the MVC application framework Cruise Control is built on.
- [Pict-Application](https://fable-retold.github.io/pict-application/) &mdash; the application base class that hosts views and services.
