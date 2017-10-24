<div align="center">
<h1> jest-codemods 👾</h1>

Codemods that simplify migrating JavaScript test files from
[AVA](https://github.com/avajs/ava),
[Chai](https://github.com/chaijs/chai),
[Expect.js (by Automattic)](https://github.com/Automattic/expect.js),
[Expect@1.x (by mjackson)](https://github.com/mjackson/expect),
[Jasmine](https://github.com/jasmine/jasmine),
[Mocha](https://github.com/mochajs/mocha),
[proxyquire](https://github.com/thlorenz/proxyquire),
[Should.js](https://github.com/tj/should.js/)
and [Tape](https://github.com/substack/tape)
to [Jest](https://facebook.github.io/jest/).

[![Build Status](https://travis-ci.org/skovhus/jest-codemods.svg?branch=master)](https://travis-ci.org/skovhus/jest-codemods)
[![version][version-badge]][package]
[![downloads](https://img.shields.io/npm/dm/jest-codemods.svg?style=flat-square)](http://npm-stat.com/charts.html?package=jest-codemods&from=2017-07-17)
[![Code Coverage](https://img.shields.io/codecov/c/github/skovhus/jest-codemods.svg?style=flat-square)](https://codecov.io/github/skovhus/jest-codemods)
[![MIT License](https://img.shields.io/npm/l/jest-codemods.svg?style=flat-square)](https://github.com/skovhus/jest-codemods/blob/master/LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Tweet][twitter-badge]][twitter]

</div>

<img src="screenshot.gif" width="300" align="right" style="margin-bottom: 1em; margin-left: 1em">

Codemods are small programs that help you automate changes to your codebase.
Think of them as search and replace on steroids.
They are executed by the [Facebook jscodeshift](https://github.com/facebook/jscodeshift) tool.

This tool is made for trying out Jest on your existing test files.
We strive to make the migration as smooth as possible, but some manual intervention
and tweaks to your tests are to be expected.


## Install

```
$ npm install -g jest-codemods
```

This installs the runner as `jest-codemods`.


## Usage (CLI)


To use the interactive CLI run

	$ jest-codemods


If you are using Flow types

	$ jest-codemods --parser flow


For more options
```
$ jest-codemods --help

    Codemods for migrating test files to Jest.

    Usage
      $ jest-codemods <path> [options]

    path	        Files or directory to transform. Can be a glob like src/**.test.js

    Options
      --force, -f	Bypass Git safety checks and forcibly run codemods
      --dry, -d		Dry run (no changes are made to files)
      --parser		The parser to use for parsing your source files (babel | babylon | flow)  [babel]
```

To transform all test files in a directory run `jest-codemods test-folder` in your terminal.

Notice the console output for errors, manual intervention and tweaks might be required.


## Usage (jscodeshift)

To make the process as simple as possible, we recommend the `jest-codemods` CLI
that wraps the `jscodeshift` executable.
But you can also run the transformations directly using `jscodeshift`.

```
$ npm install -g jscodeshift
$ npm install jest-codemods
$ jscodeshift -t node_modules/jest-codemods/dist/transformers/ava.js test-folder
$ jscodeshift -t node_modules/jest-codemods/dist/transformers/chai-assert.js test-folder
$ jscodeshift -t node_modules/jest-codemods/dist/transformers/chai-should.js test-folder
$ jscodeshift -t node_modules/jest-codemods/dist/transformers/expect-js.js test-folder
$ jscodeshift -t node_modules/jest-codemods/dist/transformers/expect.js test-folder
$ jscodeshift -t node_modules/jest-codemods/dist/transformers/mocha.js test-folder
$ jscodeshift -t node_modules/jest-codemods/dist/transformers/should.js test-folder
$ jscodeshift -t node_modules/jest-codemods/dist/transformers/tape.js test-folder
```

## Test environment: Jest on Node.js or other

If you're using Jest as your test runner and executing tests on Node.js, you'll want to use
the default option when prompted. In this case, `jest-codemods` assumes that global values
such as `expect` and `jest` are provided and will not `require()` them explicitly.

If, however, you are using a different test runner or executing Jest tests in a browser,
you may need to choose the option with explicit `require()` calls.

In the second case, after running `jest-codemods`, you might need to install a few dependencies:

    yarn -D expect jest-mock

    npm install expect jest-mock


## Transformations

If possible `import` / `require` statements determine if any transformation are carried out.
The original code quoting style is preserved.
Warnings are made if packages are used that are incompatible with Jest.


## Inspiration

Thanks to [avajs/ava-codemods](https://github.com/avajs/ava-codemods) for inspiration and CLI setup.

The Mocha and Chai assert support began its life at [paularmstrong/mocha-to-jest-codemod](https://github.com/paularmstrong/mocha-to-jest-codemod).

Chai Should/Expect came from [AlexJuarez/chai-to-jasmine](https://github.com/AlexJuarez/chai-to-jasmine).


## Contributing

To get started, run:

	yarn

When developing:

	yarn run check  # (runs lint and unit test)
	yarn run lint
	yarn run test
	yarn run test:cov
	yarn run test:watch


## License

MIT

[version-badge]: https://img.shields.io/npm/v/jest-codemods.svg?style=flat-square
[package]: https://www.npmjs.com/package/jest-codemods
[twitter]: https://twitter.com/intent/tweet?text=Check%20out%20jest-codemods!%20https://github.com/skovhus/jest-codemods%20%F0%9F%91%8D
[twitter-badge]: https://img.shields.io/twitter/url/https/github.com/skovhus/jest-codemods.svg?style=social
