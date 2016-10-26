import { hasRequireOrImport } from './imports';
import logger from './logger';

export default function detectIncompatiblePackages(fileInfo, j, ast) {
    ['sinon', 'testdouble'].forEach(pkg => {
        if (hasRequireOrImport(j, ast, pkg)) {
            logger(fileInfo, `Usage of package "${pkg}" might be incompatible with Jest`);
        }
    });
}
