import fs from 'fs';
import path from 'path';
import { execa } from 'execa';
import semver from 'semver';
import { download } from './downloader.js';
import { getPathInHome } from './home_path.js';
import { getBinaryExtension } from './platform.js';
const DENO_VERSION_FILE = 'version.txt';
const DENO_VERSION_RANGE = '^1.17.2';
class DenoBridge {
    constructor(options = {}) {
        var _a, _b, _c;
        this.cacheDirectory = (_a = options.cacheDirectory) !== null && _a !== void 0 ? _a : getPathInHome('deno-cli');
        this.onAfterDownload = options.onAfterDownload;
        this.onBeforeDownload = options.onBeforeDownload;
        this.useGlobal = (_b = options.useGlobal) !== null && _b !== void 0 ? _b : true;
        this.versionRange = (_c = options.versionRange) !== null && _c !== void 0 ? _c : DENO_VERSION_RANGE;
    }
    static async getBinaryVersion(binaryPath) {
        try {
            const { stdout } = await execa(binaryPath, ['--version']);
            const version = stdout.match(/^deno ([\d.]+)/);
            if (!version) {
                return;
            }
            return version[1];
        }
        catch {
            // no-op
        }
    }
    async getCachedBinary() {
        const versionFilePath = path.join(this.cacheDirectory, DENO_VERSION_FILE);
        let cachedVersion;
        try {
            cachedVersion = await fs.promises.readFile(versionFilePath, 'utf8');
        }
        catch {
            return;
        }
        if (!semver.satisfies(cachedVersion, this.versionRange)) {
            return;
        }
        const binaryName = `deno${getBinaryExtension()}`;
        return path.join(this.cacheDirectory, binaryName);
    }
    async getGlobalBinary() {
        if (!this.useGlobal) {
            return;
        }
        const globalBinaryName = 'deno';
        const globalVersion = await DenoBridge.getBinaryVersion(globalBinaryName);
        if (globalVersion === undefined || !semver.satisfies(globalVersion, this.versionRange)) {
            return;
        }
        return globalBinaryName;
    }
    async getRemoteBinary() {
        if (this.onBeforeDownload) {
            this.onBeforeDownload();
        }
        await fs.promises.mkdir(this.cacheDirectory, { recursive: true });
        const binaryPath = await download(this.cacheDirectory);
        const version = await DenoBridge.getBinaryVersion(binaryPath);
        if (version === undefined) {
            throw new Error('Could not read downloaded binary');
        }
        await this.writeVersionFile(version);
        if (this.onAfterDownload) {
            this.onAfterDownload();
        }
        return binaryPath;
    }
    async getBinaryPath() {
        const globalPath = await this.getGlobalBinary();
        if (globalPath !== undefined) {
            return globalPath;
        }
        const cachedPath = await this.getCachedBinary();
        if (cachedPath !== undefined) {
            return cachedPath;
        }
        return this.getRemoteBinary();
    }
    async run(args) {
        const binaryPath = await this.getBinaryPath();
        return await execa(binaryPath, args);
    }
    async writeVersionFile(version) {
        const versionFilePath = path.join(this.cacheDirectory, DENO_VERSION_FILE);
        await fs.promises.writeFile(versionFilePath, version);
    }
}
export { DenoBridge };
