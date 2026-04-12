import * as fs from 'fs';

// Read a file as a string with structured error handling.
// On ENOENT, includes the hint in the error message.
export function readFileString(filePath: string, hint: string): string {
    try {
        return fs.readFileSync(filePath).toString();
    } catch (e: any) {
        if (e.code === 'ENOENT') {
            throw new Error(`${filePath} not found (${hint}): ${e.message}`, { cause: e });
        }
        throw new Error(`Failed to read ${filePath}: ${e.message}`, { cause: e });
    }
}

// Read and parse a JSON file. Delegates file I/O to readFileString;
// additionally distinguishes JSON parse failures from read errors.
export function readJsonFile(filePath: string, hint: string): any {
    const content = readFileString(filePath, hint);
    try {
        return JSON.parse(content);
    } catch (e: any) {
        throw new Error(`Failed to parse ${filePath}: ${e.message}`, { cause: e });
    }
}

export const l1keystore = "/home/user/l1keystore";
export const l1passphrase = "passphrase";
export const configpath = "/config";
export const tokenbridgedatapath = "/tokenbridge-data";
// Not secure. Do not use for production purposes
export const l1mnemonic =
  "indoor dish desk flag debris potato excuse depart ticket judge file exit";

export const ARB_OWNER = "0x0000000000000000000000000000000000000070";
