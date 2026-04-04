import * as fs from 'fs';

// Read and parse a JSON file with structured error handling.
// On ENOENT, includes the hint in the error message. On SyntaxError,
// distinguishes parse failures from other read errors.
export function readJsonFile(filePath: string, hint: string): any {
    try {
        return JSON.parse(fs.readFileSync(filePath).toString());
    } catch (e: any) {
        if (e.code === 'ENOENT') {
            throw new Error(`${filePath} not found (${hint}): ${e.message}`);
        }
        const action = (e instanceof SyntaxError) ? 'parse' : 'read';
        throw new Error(`Failed to ${action} ${filePath}: ${e.message}`);
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