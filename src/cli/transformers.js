import path from 'path';
import execa from 'execa';

export const transformerDirectory = path.join(__dirname, '../', 'transformers');
export const jscodeshiftExecutable = require.resolve('.bin/jscodeshift');

function executeTransformation({ files, flags, parser, transformer, transformerArgs }) {
    const transformerPath = path.join(transformerDirectory, `${transformer}.js`);

    let args = ['-t', transformerPath].concat(files);

    const { dry, ignorePattern } = flags;

    if (dry) {
        args.push('--dry');
    }

    if (ignorePattern) {
        args.push('--ignore-pattern', ignorePattern);
    }

    args.push('--parser', parser);
    if (parser === 'tsx') {
        args.push('--extensions=tsx,ts');
    }

    if (transformerArgs && transformerArgs.length > 0) {
        args = args.concat(transformerArgs);
    }

    console.log(`Executing command: jscodeshift ${args.join(' ')}`);

    const result = execa.sync(jscodeshiftExecutable, args, {
        stdio: 'inherit',
        stripEof: false,
    });

    if (result.error) {
        throw result.error;
    }
}

export function executeTransformations({
    files,
    flags,
    parser,
    transformers,
    transformerArgs,
}) {
    transformers.forEach(t => {
        executeTransformation({
            files,
            flags,
            transformer: t,
            parser,
            transformerArgs,
        });
    });
}
