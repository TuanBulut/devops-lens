import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getKubeConfigPath } from './providers/kubernetesProvider';
import { getAwsConfigPaths } from './providers/awsProvider';
import { subscribeToGitChanges } from './providers/gitProvider';

export function setupRealtimeWatchers(onRefresh: () => void): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // Debounce helper to prevent flutter
    let debounceTimer: NodeJS.Timeout | undefined;
    const triggerDebouncedRefresh = () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            onRefresh();
        }, 200);
    };

    // 1. Watch ~/.kube/config
    try {
        const kubePath = getKubeConfigPath();
        const kubeDir = path.dirname(kubePath);
        if (fs.existsSync(kubeDir)) {
            const watcher = fs.watch(kubeDir, (eventType, filename) => {
                if (!filename || filename.includes('config')) {
                    triggerDebouncedRefresh();
                }
            });
            disposables.push({ dispose: () => watcher.close() });
        }
    } catch {
        // Fallback
    }

    // 2. Watch ~/.aws/credentials and ~/.aws/config
    try {
        const { credentialsPath, configPath } = getAwsConfigPaths();
        const awsDir = path.dirname(credentialsPath);
        if (fs.existsSync(awsDir)) {
            const watcher = fs.watch(awsDir, (eventType, filename) => {
                if (!filename || filename.includes('config') || filename.includes('credentials')) {
                    triggerDebouncedRefresh();
                }
            });
            disposables.push({ dispose: () => watcher.close() });
        }
    } catch {
        // Fallback
    }

    // 3. Watch workspace .env and .env.* files
    try {
        const envWatcher = vscode.workspace.createFileSystemWatcher('**/.env*');
        envWatcher.onDidChange(triggerDebouncedRefresh);
        envWatcher.onDidCreate(triggerDebouncedRefresh);
        envWatcher.onDidDelete(triggerDebouncedRefresh);
        disposables.push(envWatcher);
    } catch {
        // Fallback
    }

    // 4. Watch workspace .tf / .terraform files
    try {
        const tfWatcher = vscode.workspace.createFileSystemWatcher('**/*.tf*');
        tfWatcher.onDidChange(triggerDebouncedRefresh);
        tfWatcher.onDidCreate(triggerDebouncedRefresh);
        tfWatcher.onDidDelete(triggerDebouncedRefresh);
        disposables.push(tfWatcher);
    } catch {
        // Fallback
    }

    // 5. Watch Git repository changes via VS Code's native Git API
    const gitDisposables = subscribeToGitChanges(triggerDebouncedRefresh);
    disposables.push(...gitDisposables);

    // 6. Watch configuration changes (e.g. user toggles settings)
    disposables.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('devopsLens')) {
            triggerDebouncedRefresh();
        }
    }));

    // Cleanup timer on dispose
    disposables.push({
        dispose: () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        }
    });

    return disposables;
}
