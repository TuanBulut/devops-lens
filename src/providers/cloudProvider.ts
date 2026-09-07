import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CloudStatus } from './types';

const execAsync = promisify(exec);

export async function getCloudStatus(): Promise<CloudStatus> {
    const config = vscode.workspace.getConfiguration('devopsLens');
    if (!config.get<boolean>('enableMultiCloud', true)) {
        return { gcpProject: null, azureSubscription: null };
    }

    let gcpProject: string | null = null;
    let azureSubscription: string | null = null;

    // Check GCP active project
    try {
        const { stdout } = await execAsync('gcloud config get-value project', { timeout: 2500 });
        const val = stdout.trim();
        if (val && !val.includes('unset') && !val.includes('WARNING')) {
            gcpProject = val;
        }
    } catch {
        // gcloud not installed or not authenticated
    }

    // Check Azure active subscription
    try {
        const { stdout } = await execAsync('az account show --query name -o tsv', { timeout: 2500 });
        const val = stdout.trim();
        if (val && !val.includes('ERROR')) {
            azureSubscription = val;
        }
    } catch {
        // az not installed or not authenticated
    }

    return {
        gcpProject,
        azureSubscription
    };
}
