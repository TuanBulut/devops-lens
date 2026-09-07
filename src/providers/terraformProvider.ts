import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TerraformStatus } from './types';

const execAsync = promisify(exec);

export async function getTerraformStatus(): Promise<TerraformStatus> {
    const config = vscode.workspace.getConfiguration('devopsLens');
    if (!config.get<boolean>('enableTerraform', true)) {
        return { detected: false, workspace: null, allWorkspaces: [] };
    }

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return { detected: false, workspace: null, allWorkspaces: [] };
    }

    // Check if workspace contains .tf files or .terraform directory
    let hasTf = false;
    let tfCwd = folders[0].uri.fsPath;

    for (const folder of folders) {
        const root = folder.uri.fsPath;
        try {
            if (fs.existsSync(path.join(root, '.terraform'))) {
                hasTf = true;
                tfCwd = root;
                break;
            }
            const files = fs.readdirSync(root);
            if (files.some(f => f.endsWith('.tf') || f.endsWith('.tfvars'))) {
                hasTf = true;
                tfCwd = root;
                break;
            }
        } catch {
            // Ignore filesystem access errors
        }
    }

    if (!hasTf) {
        return { detected: false, workspace: null, allWorkspaces: [] };
    }

    try {
        const { stdout: currentWs } = await execAsync('terraform workspace show', {
            cwd: tfCwd,
            timeout: 3000
        });
        const activeWorkspace = currentWs.trim();

        let allWorkspaces: string[] = [activeWorkspace];
        try {
            const { stdout: listWs } = await execAsync('terraform workspace list', {
                cwd: tfCwd,
                timeout: 3000
            });
            allWorkspaces = listWs
                .split('\n')
                .map(w => w.replace('*', '').trim())
                .filter(w => w.length > 0);
        } catch {
            // Ignore list error
        }

        return {
            detected: true,
            workspace: activeWorkspace,
            allWorkspaces
        };
    } catch {
        return {
            detected: true,
            workspace: 'default',
            allWorkspaces: ['default']
        };
    }
}

export async function switchTerraformWorkspace(workspaceName: string): Promise<boolean> {
    const folders = vscode.workspace.workspaceFolders;
    const cwd = folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;

    try {
        await execAsync(`terraform workspace select "${workspaceName}"`, {
            cwd,
            timeout: 5000
        });
        vscode.window.showInformationMessage(`Switched Terraform workspace to "${workspaceName}"`);
        return true;
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to switch Terraform workspace: ${error?.message || error}`);
        return false;
    }
}
