# jest-codemods

Codemods for [Jest](https://facebook.github.io/jest/) that simplify migrating to Jest. Currently only from [Tape](https://github.com/substack/tape).

[![Build Status][build-badge]][build]
[![version][version-badge]][package]
[![MIT License][license-badge]][LICENSE]
[![Tweet][twitter-badge]][twitter]

Codemods are small programs that help you automate changes to your codebase. Think of them as search and replace on steroids. They are executed by the [Facebook jscodeshift](https://github.com/facebook/jscodeshift) tool.

## Install

```
$ npm install --global jest-codemods
```

This installs a binary `tape-to-jest`.


## Tape to Jest codemod

Currently we support migrating from [Tape](https://github.com/substack/tape) to Jest.

```
$ tape-to-jest --help

	Usage
	  $ tape-to-jest <path> [options]

	path	Files or directory to transform. Can be a glob like src/**.test.js

	Options
	  --force, -f	Bypass Git safety checks and forcibly run codemods
	  --dry, -d		Dry run (no changes are made to files)
	  --parser		The parser to use for parsing your source files (babel | babylon | flow)  [babel]
```

To transform all test files in a directory run `tape-to-jest mySrcFolder` in your terminal. Only files requiring or importing tape will be transformed. Notice the console output for errors, manual intervention might be required.


## Inspiration

Thanks to [ava-codemods](https://github.com/avajs/ava-codemods) for inspiration.


## License

MIT

[build-badge]: https://img.shields.io/travis/skovhus/jest-codemods?style=flat-square
[build]: https://travis-ci.org/skovhus/jest-codemods
[version-badge]: https://img.shields.io/npm/v/jest-codemods.svg?style=flat-square
[package]: https://www.npmjs.com/package/jest-codemods
[license]: https://github.com/skovhus/jest-codemods/blob/master/LICENSE
[twitter]: https://twitter.com/intent/tweet?text=Check%20out%20jest-codemods!%20https://github.com/skovhus/jest-codemods%20%F0%9F%91%8D
[twitter-badge]: https://img.shields.io/twitter/url/https/github.com/skovhus/jest-codemods.svg?style=social
