# React Component Starter Kit

Boilerplate for creating a new React component. Contains necessary setup for easy development and publishing

## How To Use

Clone this repository, then replace things as needed to turn it into the new component repository.

Make sure to remove the `.git` directory, and then `git init` or whatever is needed to create a new Git repository for
the new component

Install anything in `package.json` under `peerDependencies`. It is expected that things like `React`, `Redux`, and other
libraries should be installed by the consuming application.

## Things To Update

### `package.json`

Ensure that you replace instances of `COMPONENT_NAME`, as well as update the package name, repository URL (and other
URLs throughout the file). Give it a good description as well

### `example` directory

Not anything critical needs to be updated here. The primary things are:

* `example/common/container.js` - update the imported component to whatever name you will be exporting
* `example/common/reducers.js` - update the Redux state slice name to whatever your component will expect

Additionally, you can update the name of the logger in `example/client/index.js`, and the example web page's title in
`example/index.html`

### `src` directory

You can basically do whatever you want in here. Just make sure that you update `src/index.js` to export whatever you
need to. It should, at the very least, export some React Component, and a `reducer` function.
