# jest-codemods

Codemods for [Jest](https://facebook.github.io/jest/) that simplify migrating to Jest. Currently we support migrating from [Tape](https://github.com/substack/tape) to Jest. But we hope to support for [AVA](https://github.com/avajs/ava) and other test runners in the future.

[![Build Status](https://travis-ci.org/skovhus/jest-codemods.svg?branch=master)](https://travis-ci.org/skovhus/jest-codemods)
[![version][version-badge]][package]
[![Tweet][twitter-badge]][twitter]

Codemods are small programs that help you automate changes to your codebase. Think of them as search and replace on steroids. They are executed by the [Facebook jscodeshift](https://github.com/facebook/jscodeshift) tool.


## Install

```
$ npm install --global jest-codemods
```

This installs a binary `jest-covemods`.


## Usage

Currently we support migrating from [Tape](https://github.com/substack/tape) to Jest.

```
$ jest-covemods --help

	Usage
	  $ jest-covemods <path> [options]

	path	Files or directory to transform. Can be a glob like src/**.test.js

	Options
	  --force, -f	Bypass Git safety checks and forcibly run codemods
	  --dry, -d		Dry run (no changes are made to files)
	  --parser		The parser to use for parsing your source files (babel | babylon | flow)  [babel]
```

To transform all test files in a directory run `jest-covemods mySrcFolder` in your terminal.

Only files requiring or importing Tape will be transformed. Notice the console output for errors, manual intervention might be required.


## Inspiration

Thanks to [ava-codemods](https://github.com/avajs/ava-codemods) for inspiration.


## Contributing

To get started, run:

	npm install

When developing:

	npm run check (lint and unit test)
	npm run test
	npm run test:cov
	npm run test:watch


## License

MIT

[version-badge]: https://img.shields.io/npm/v/jest-codemods.svg?style=flat-square
[package]: https://www.npmjs.com/package/jest-codemods
[twitter]: https://twitter.com/intent/tweet?text=Check%20out%20jest-codemods!%20https://github.com/skovhus/jest-codemods%20%F0%9F%91%8D
[twitter-badge]: https://img.shields.io/twitter/url/https/github.com/skovhus/jest-codemods.svg?style=social
