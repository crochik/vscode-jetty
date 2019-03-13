'use strict';

import * as child_process from "child_process";
import * as fse from 'fs-extra';
import * as ini from 'ini';
import * as os from 'os';
import * as path from 'path';
import * as vscode from "vscode";

export async function validateInstallPath(installPath: string): Promise<boolean> {
    const startJarFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'start.jar'));
    const startInIFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'start.ini'));

    return await startJarFileExists && await startInIFileExists;
}

export async function execute(outputChannel: vscode.OutputChannel, prefix: string, command: string, options: child_process.SpawnOptions, ...args: string[]): Promise<void> {
    await new Promise((resolve: () => void, reject: (e: Error) => void): void => {
        outputChannel.show();
        let str: string = `${command}`;
        if (args && args.length > 0) {
            args.forEach((arg: string) => str += ` ${arg}`);
        }
        outputChannel.appendLine('-'.repeat(str.length));
        outputChannel.appendLine(str);
        outputChannel.appendLine('-'.repeat(str.length));

        let stderr: string = '';
        const p: child_process.ChildProcess = child_process.spawn(command, args, options);
        p.stdout.on('data', (data: string | Buffer): void =>
            outputChannel.append(`[${prefix}]: ${data.toString()}`));
        p.stderr.on('data', (data: string | Buffer) => {
            stderr = stderr.concat(data.toString());
            outputChannel.append(`[${prefix}]: ${data.toString()}`);
        });
        p.on('error', (err: Error) => {
            reject(err);
        });
        p.on('exit', (code: number) => {
            if (code !== 0) {
                reject(new Error(`Command failed with exit code ${code}`));
            }
            resolve();
        });
    });
}

export async function getConfig(storagePath: string, file: string, key: string): Promise<string> {
    // tslint:disable-next-line:no-any
    let config: any = ini.parse(await fse.readFile(path.join(storagePath, 'start.d', file), 'utf-8'));
    let result: string = config[key];
    if (!result && await fse.pathExists(path.join(storagePath, 'start.ini'))) {
        config = ini.parse(await fse.readFile(path.join(storagePath, 'start.ini'), 'utf-8'));
        result = config[key];
    }
    return result ? result : '8080';
}

export function getTempStoragePath(): string {
    const chars: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
    let result: string = '';
    for (let i: number = 0; i < 5; i += 1) {
        // tslint:disable-next-line:insecure-random
        const idx: number = Math.floor(chars.length * Math.random());
        result += chars[idx];
    }
    return path.resolve(os.tmpdir(), `vscodejetty_${result}`);
}
